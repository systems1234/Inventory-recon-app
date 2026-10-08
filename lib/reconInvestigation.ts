import { getBigQuery, table } from "./bigquery";

export interface ReconView {
  key: string;
  label: string;
  description: string;
  view: string;
  idColumn: string;
}

/** The three views feeding the Reconciliation Investigation tab, shown as-is. */
export const RECON_VIEWS: ReconView[] = [
  {
    key: "not_in_ims",
    label: "Not in IMS, but in Recon",
    description: "Submitted in Recon, but the inventory ID does not exist in IMS.",
    view: "v_not_in_ims_but_in_recon",
    idColumn: "entry_number"
  },
  {
    key: "ims_out_of_stock",
    label: "IMS Out of Stock, but in Recon",
    description: "Marked Out of Stock in IMS, yet found during Recon.",
    view: "v_ims_out_of_stock_but_in_recon",
    idColumn: "entry_number"
  },
  {
    key: "in_ims_not_recon",
    label: "IMS Instock - Loose, but missed in Recon",
    description: "Instock - Loose in IMS, but not found during Recon.",
    view: "v_in_ims_but_not_in_recon",
    idColumn: "inventory_id"
  }
];

export const MAX_TEXT_LENGTH = 2000;

export function findView(key: string): ReconView | undefined {
  return RECON_VIEWS.find((v) => v.key === key);
}

let tableReady: Promise<void> | null = null;

/** Creates the comments table on first use so no manual migration is needed. */
function ensureCommentsTable(): Promise<void> {
  if (!tableReady) {
    tableReady = getBigQuery()
      .query({
        query: `
          CREATE TABLE IF NOT EXISTS ${table("reconciliation_comments")} (
            view_key     STRING NOT NULL,
            inventory_id STRING NOT NULL,
            comment      STRING,
            action       STRING,
            updated_by   STRING,
            updated_at   TIMESTAMP
          )
        `
      })
      .then(() => undefined)
      .catch((err) => {
        tableReady = null;
        throw err;
      });
  }
  return tableReady;
}

/** View rows as-is, plus the team's saved comment/action (NULL until reviewed). */
export async function fetchViewRows(v: ReconView): Promise<Record<string, unknown>[]> {
  await ensureCommentsTable();
  const [rows] = await getBigQuery().query({
    query: `
      SELECT v.*, c.comment AS team_comment, c.action AS team_action
      FROM ${table(v.view)} v
      LEFT JOIN ${table("reconciliation_comments")} c
        ON c.view_key = @viewKey AND c.inventory_id = CAST(v.${v.idColumn} AS STRING)
      ORDER BY CAST(v.${v.idColumn} AS STRING)
    `,
    params: { viewKey: v.key }
  });
  return rows as Record<string, unknown>[];
}

export async function saveReview(
  v: ReconView,
  inventoryId: string,
  comment: string | null,
  action: string | null,
  user: string
): Promise<void> {
  await ensureCommentsTable();
  await getBigQuery().query({
    query: `
      MERGE ${table("reconciliation_comments")} t
      USING (SELECT @viewKey AS view_key, @inventoryId AS inventory_id) s
      ON t.view_key = s.view_key AND t.inventory_id = s.inventory_id
      WHEN MATCHED THEN UPDATE SET
        comment = @comment, action = @action, updated_by = @user, updated_at = CURRENT_TIMESTAMP()
      WHEN NOT MATCHED THEN INSERT (view_key, inventory_id, comment, action, updated_by, updated_at)
        VALUES (s.view_key, s.inventory_id, @comment, @action, @user, CURRENT_TIMESTAMP())
    `,
    params: { viewKey: v.key, inventoryId, comment, action, user },
    types: { comment: "STRING", action: "STRING" }
  });
}
