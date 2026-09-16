import { v4 as uuid } from "uuid";
import { getBigQuery, table, dataset } from "./bigquery";

export interface Investigation {
  id: string;
  display_name: string;
  description: string | null;
  view_name: string;
  table_name: string;
  group_number: string;
  admin_only: boolean;
  is_active: boolean;
  sort_order: number;
  key_columns: string[];
  filter_columns: string[];
  assigned_emails: string[];
}

/** Monday of the week containing `d`, as YYYY-MM-DD. */
export function currentReconWeek(d: Date = new Date()): string {
  const day = d.getUTCDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setUTCDate(d.getUTCDate() + diffToMonday);
  const y = monday.getUTCFullYear();
  const m = String(monday.getUTCMonth() + 1).padStart(2, "0");
  const day2 = String(monday.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day2}`;
}

/**
 * view_name / table_name / key_columns come out of the investigations config
 * table and get interpolated straight into SQL. They're admin-managed, but
 * interpolated identifiers are an injection surface regardless — validate
 * before use.
 */
const SAFE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

function assertSafeIdentifier(name: string, field: string): string {
  if (!SAFE_IDENTIFIER.test(name)) {
    throw new Error(`Unsafe ${field} in investigations config: ${JSON.stringify(name)}`);
  }
  return name;
}

function normalizeArray(v: unknown): string[] {
  return Array.isArray(v) ? (v as string[]) : [];
}

export async function listInvestigations(role: string, email?: string): Promise<Investigation[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT id, display_name, description, view_name, table_name, group_number, admin_only, is_active, sort_order,
             key_columns, filter_columns, assigned_emails
      FROM ${table("investigations")}
      WHERE is_active = TRUE
        AND (admin_only = FALSE OR @role = 'admin')
      ORDER BY sort_order
    `,
    params: { role }
  });
  return (rows as any[]).map((r) => ({
    ...r,
    key_columns: normalizeArray(r.key_columns),
    filter_columns: normalizeArray(r.filter_columns),
    assigned_emails: normalizeArray(r.assigned_emails)
  }));
}

/** Can this user trigger a run for this one investigation? Admins always can. */
export function canRunInvestigation(inv: Pick<Investigation, "assigned_emails">, role: string, email?: string): boolean {
  if (role === "admin") return true;
  if (!email) return false;
  return inv.assigned_emails.includes(email);
}

interface GuardResult {
  allowed: boolean;
  reason?: string;
}

export async function checkRunGuard(role: string, reconWeek: string): Promise<GuardResult> {
  if (role === "admin") return { allowed: true };

  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT run_by, run_at
      FROM ${table("investigation_runs")}
      WHERE recon_week = CAST(@reconWeek AS DATE)
      ORDER BY run_at DESC
      LIMIT 1
    `,
    params: { reconWeek }
  });

  if (rows.length > 0) {
    const { run_by, run_at } = rows[0] as { run_by: string; run_at: { value: string } };
    const when = new Date(run_at.value ?? run_at).toLocaleString();
    return {
      allowed: false,
      reason: `Already run this week by ${run_by} on ${when}. Ask an admin to re-run if needed.`
    };
  }

  return { allowed: true };
}

/**
 * A view's own column list, excluding the 4 metadata + 6 resolution columns
 * that only exist on the target table. Fetched from INFORMATION_SCHEMA
 * rather than assumed, since we don't track each view's schema in code.
 */
async function fetchViewColumns(viewNames: string[]): Promise<Map<string, string[]>> {
  if (viewNames.length === 0) return new Map();
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT table_name, column_name
      FROM \`${process.env.GCP_PROJECT_ID}.${dataset()}.INFORMATION_SCHEMA.COLUMNS\`
      WHERE table_name IN UNNEST(@names)
      ORDER BY table_name, ordinal_position
    `,
    params: { names: viewNames }
  });
  const map = new Map<string, string[]>();
  for (const r of rows as { table_name: string; column_name: string }[]) {
    if (!map.has(r.table_name)) map.set(r.table_name, []);
    map.get(r.table_name)!.push(assertSafeIdentifier(r.column_name, "view column"));
  }
  return map;
}

/**
 * Builds one MERGE statement for a single investigation. Source is
 * deduplicated by key_columns (ROW_NUMBER, keep first) so that even if the
 * underlying view can produce duplicate keys within one run, MERGE never
 * sees more than one source row per key — BigQuery's own "must match at
 * most one source row" restriction would otherwise abort the whole script.
 *
 * Semantics (this is the piece that makes resolved rows durable across
 * re-runs):
 *   - key matches, not yet solved  -> refresh data + bookkeeping columns
 *   - key matches, already solved  -> untouched. recon_week stays wherever
 *     it was, so a resolved row quietly stops showing up as "this week's"
 *     data even if the view still flags it.
 *   - no existing row for this key -> insert fresh, resolution columns NULL
 *   - existing row, unsolved, key no longer in the view's output -> delete
 *     (the underlying issue went away on its own, nothing to preserve)
 *   - existing row, solved, key no longer in the view's output -> untouched,
 *     kept forever as history
 */
function buildMergeStatement(inv: Investigation, viewColumns: string[]): string {
  if (inv.key_columns.length === 0) {
    throw new Error(
      `Investigation ${inv.id} has no key_columns configured — set investigations.key_columns before running it.`
    );
  }
  const keyCols = inv.key_columns.map((c) => assertSafeIdentifier(c, "key_columns"));
  const tbl = table(assertSafeIdentifier(inv.table_name, "table_name"));
  const view = table(assertSafeIdentifier(inv.view_name, "view_name"));

  // Same CAST-to-STRING defense as updateResolution's WHERE clause — makes
  // the match immune to a key column's type differing (or drifting) between
  // the target table and the source view, for every investigation.
  const onClause = keyCols.map((c) => `CAST(t.${c} AS STRING) = CAST(s.${c} AS STRING)`).join(" AND ");
  const partitionBy = keyCols.join(", ");
  const updateSet = viewColumns.map((c) => `${c} = s.${c}`).join(",\n      ");
  const insertCols = ["run_id", "recon_week", "run_at", "run_by", ...viewColumns].join(", ");
  const insertVals = [
    "@runId",
    "CAST(@reconWeek AS DATE)",
    "CURRENT_TIMESTAMP()",
    "@runBy",
    ...viewColumns.map((c) => `s.${c}`)
  ].join(", ");

  return `
MERGE ${tbl} AS t
USING (
  SELECT * EXCEPT(__rn)
  FROM (
    SELECT *, ROW_NUMBER() OVER (PARTITION BY ${partitionBy}) AS __rn
    FROM ${view}
  )
  WHERE __rn = 1
) AS s
ON ${onClause}
WHEN MATCHED AND t.solved_date IS NULL THEN UPDATE SET
  run_id = @runId,
  recon_week = CAST(@reconWeek AS DATE),
  run_at = CURRENT_TIMESTAMP(),
  run_by = @runBy,
  ${updateSet}
WHEN NOT MATCHED BY TARGET THEN
  INSERT (${insertCols})
  VALUES (${insertVals})
WHEN NOT MATCHED BY SOURCE AND t.solved_date IS NULL THEN DELETE;`;
}

/**
 * Runs every active investigation for the given week as one multi-statement
 * BigQuery script (one job, not 28+ round trips — see git history for why
 * that mattered). Each investigation is now a MERGE rather than a blind
 * DELETE+INSERT, so resolution data (solved_date/action/reason/comment)
 * survives re-runs.
 */
export async function runAllInvestigations(runBy: string, role: string, reconWeek: string): Promise<string> {
  const bq = getBigQuery();
  const runId = uuid();

  const [rows] = await bq.query({
    query: `
      SELECT id, display_name, view_name, table_name, key_columns
      FROM ${table("investigations")}
      WHERE is_active = TRUE
      ORDER BY sort_order
    `
  });

  const investigations = (rows as any[]).map((r) => ({ ...r, key_columns: normalizeArray(r.key_columns) })) as Pick<
    Investigation,
    "id" | "display_name" | "view_name" | "table_name" | "key_columns"
  >[];

  if (investigations.length === 0) {
    throw new Error(
      "No active investigations in the config table — nothing to run. Seed `investigations` first."
    );
  }

  const viewColumnMap = await fetchViewColumns(investigations.map((i) => i.view_name));

  const statements = investigations.map((inv) => {
    const viewColumns = viewColumnMap.get(inv.view_name);
    if (!viewColumns || viewColumns.length === 0) {
      throw new Error(`Could not resolve columns for view ${inv.view_name} (investigation ${inv.id}).`);
    }
    return buildMergeStatement(inv as Investigation, viewColumns);
  });

  statements.push(
    [
      `INSERT INTO ${table("investigation_runs")} (run_id, recon_week, run_by, run_role, run_at)`,
      `VALUES (@runId, CAST(@reconWeek AS DATE), @runBy, @role, CURRENT_TIMESTAMP());`
    ].join("\n")
  );

  await bq.query({
    query: statements.join("\n\n"),
    params: { runId, reconWeek, runBy, role }
  });

  return runId;
}

/**
 * Runs exactly one investigation. Same MERGE shape as runAllInvestigations,
 * scoped to a single id — used by the admin/assigned-user "Run" button so
 * nobody has to wait on all 14 to check one fix.
 */
export async function runSingleInvestigation(
  id: string,
  runBy: string,
  role: string,
  reconWeek: string
): Promise<{ runId: string; displayName: string }> {
  const bq = getBigQuery();
  const runId = uuid();

  const [rows] = await bq.query({
    query: `
      SELECT id, display_name, view_name, table_name, key_columns
      FROM ${table("investigations")}
      WHERE id = @id AND is_active = TRUE
      LIMIT 1
    `,
    params: { id }
  });

  if (rows.length === 0) {
    throw new Error(`Unknown or inactive investigation: ${id}`);
  }

  const inv = { ...(rows[0] as any), key_columns: normalizeArray((rows[0] as any).key_columns) } as Investigation;
  const viewColumnMap = await fetchViewColumns([inv.view_name]);
  const viewColumns = viewColumnMap.get(inv.view_name);
  if (!viewColumns || viewColumns.length === 0) {
    throw new Error(`Could not resolve columns for view ${inv.view_name}.`);
  }

  const script = [
    buildMergeStatement(inv, viewColumns),
    [
      `INSERT INTO ${table("investigation_runs")} (run_id, recon_week, run_by, run_role, run_at)`,
      `VALUES (@runId, CAST(@reconWeek AS DATE), @runBy, @role, CURRENT_TIMESTAMP());`
    ].join("\n")
  ].join("\n\n");

  await bq.query({
    query: script,
    params: { runId, reconWeek, runBy, role }
  });

  return { runId, displayName: inv.display_name };
}

export interface ReportRow {
  [key: string]: unknown;
}

/**
 * Fetches a saved investigation's rows for a given week, with run
 * bookkeeping stripped but resolution columns kept — the UI needs those to
 * render the editable Solved Date / Action / Reason / Comment cells.
 */
export async function fetchInvestigationReport(tableName: string, reconWeek: string): Promise<ReportRow[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `SELECT * FROM ${table(assertSafeIdentifier(tableName, "table_name"))} WHERE recon_week = CAST(@reconWeek AS DATE)`,
    params: { reconWeek }
  });
  return (rows as ReportRow[]).map((row) => {
    const { run_id, recon_week, run_at, run_by, ...rest } = row;
    return rest;
  });
}

export async function listReconWeeks(): Promise<{ recon_week: string; run_by: string; run_at: string }[]> {
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT recon_week, run_by, run_at
      FROM ${table("investigation_runs")}
      QUALIFY ROW_NUMBER() OVER (PARTITION BY recon_week ORDER BY run_at DESC) = 1
      ORDER BY recon_week DESC
    `
  });
  return rows as { recon_week: string; run_by: string; run_at: string }[];
}

export interface ResolutionFields {
  solved_date: string | null; // YYYY-MM-DD or null
  action: string | null;
  reason: string | null;
  comment: string | null; // the only one allowed to stay null
}

/**
 * solved_date/action/reason must travel together — either all three are
 * present, or the row is left fully unresolved. comment is optional either
 * way. Throws on an invalid partial combination rather than silently
 * accepting it.
 */
export function assertResolutionFields(f: ResolutionFields): void {
  const trio = [f.solved_date, f.action, f.reason];
  const filled = trio.filter((v) => v !== null && v.trim() !== "").length;
  if (filled !== 0 && filled !== 3) {
    throw new Error("Solved Date, Action, and Reason must all be filled in together (Comment is optional).");
  }
}

async function lookupKeyColumns(id: string): Promise<{ table_name: string; key_columns: string[] }> {
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT table_name, key_columns
      FROM ${table("investigations")}
      WHERE id = @id AND is_active = TRUE
      LIMIT 1
    `,
    params: { id }
  });
  if (rows.length === 0) throw new Error(`Unknown or inactive investigation: ${id}`);
  const row = rows[0] as any;
  return { table_name: row.table_name, key_columns: normalizeArray(row.key_columns) };
}

/**
 * Updates the 4 resolution columns for exactly one row, identified by its
 * business key (the same key_columns MERGE matches runs on). Returns false
 * if no row matched the given key — the caller (route or bulk import) turns
 * that into a clear "not found" rather than a silent no-op.
 */
export async function updateResolution(
  investigationId: string,
  keyValues: Record<string, string>,
  fields: ResolutionFields,
  updatedBy: string
): Promise<boolean> {
  assertResolutionFields(fields);

  const { table_name, key_columns } = await lookupKeyColumns(investigationId);
  if (key_columns.length === 0) {
    throw new Error(`Investigation ${investigationId} has no key_columns configured.`);
  }
  const missing = key_columns.filter((c) => !(c in keyValues));
  if (missing.length > 0) {
    throw new Error(`Missing key value(s) for: ${missing.join(", ")}`);
  }

  const tbl = table(assertSafeIdentifier(table_name, "table_name"));
  // Cast to STRING on both sides — key_columns can be INT64, STRING, etc.
  // depending on the investigation, but keyValues always arrives as JS
  // strings (built client-side via a generic unwrap()), so an untyped param
  // is always inferred as STRING. Comparing STRING against a real INT64
  // column without a cast fails with "No matching signature for operator =".
  // Casting generically here fixes this for every investigation regardless
  // of its key columns' actual types, instead of needing a type map.
  const whereClause = key_columns
    .map((c) => `CAST(${assertSafeIdentifier(c, "key_columns")} AS STRING) = @key_${c}`)
    .join(" AND ");

  const params: Record<string, unknown> = {
    solvedDate: fields.solved_date,
    action: fields.action,
    reason: fields.reason,
    comment: fields.comment,
    updatedBy
  };
  for (const c of key_columns) params[`key_${c}`] = keyValues[c];

  const bq = getBigQuery();
  const [job] = await bq.createQueryJob({
    query: `
      UPDATE ${tbl}
      SET solved_date = ${fields.solved_date ? "CAST(@solvedDate AS DATE)" : "NULL"},
          action = @action,
          reason = @reason,
          comment = @comment,
          updated_by = @updatedBy,
          updated_at = CURRENT_TIMESTAMP()
      WHERE ${whereClause}
    `,
    params
  });
  await job.getQueryResults();
  const [metadata] = await job.getMetadata();
  const affected = Number(metadata?.statistics?.query?.numDmlAffectedRows ?? 0);
  return affected > 0;
}

export interface BulkResolutionRow {
  keyValues: Record<string, string>;
  fields: ResolutionFields;
}

export interface BulkImportResult {
  matched: number;
  unmatched: Record<string, string>[];
}

const MAX_BULK_IMPORT_ROWS = 200;

/**
 * Applies a batch of resolution updates sequentially. Sequential rather than
 * a single UNNEST-based MERGE — simpler and safe, and at the row counts a
 * CSV import realistically has (capped at 200) it stays well under the
 * function timeout. Revisit if imports start regularly running that large.
 */
export async function bulkUpsertResolutions(
  investigationId: string,
  rows: BulkResolutionRow[],
  updatedBy: string
): Promise<BulkImportResult> {
  if (rows.length > MAX_BULK_IMPORT_ROWS) {
    throw new Error(`Import is limited to ${MAX_BULK_IMPORT_ROWS} rows at a time (got ${rows.length}).`);
  }

  let matched = 0;
  const unmatched: Record<string, string>[] = [];

  for (const row of rows) {
    const ok = await updateResolution(investigationId, row.keyValues, row.fields, updatedBy);
    if (ok) matched++;
    else unmatched.push(row.keyValues);
  }

  return { matched, unmatched };
}
