import { getBigQuery, table, currentReconMonth } from "./bigquery";
import { validateNormalEntries, validateNoPktEntries } from "./validation";
import { LocationChangeError } from "./locationChange";

let tableReady: Promise<void> | null = null;

/** Audit log of every inventory ID correction; created on first use so no manual migration is needed. */
export function ensureInventoryLogTable(): Promise<void> {
  if (!tableReady) {
    tableReady = getBigQuery()
      .query({
        query: `
          CREATE TABLE IF NOT EXISTS ${table("inventory_id_changes")} (
            change_id        STRING NOT NULL,
            recon_month      DATE NOT NULL,
            source           STRING NOT NULL,
            old_entry_number STRING NOT NULL,
            new_entry_number STRING NOT NULL,
            changed_by       STRING NOT NULL,
            changed_at       TIMESTAMP NOT NULL
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

/**
 * Replaces a wrongly scanned inventory ID with the correct one in this
 * month's For Entry or No Pkt No. entries (whichever holds it). The new ID
 * goes through the same checks as a fresh submission (exists in the master,
 * not out of stock, not already saved this month, packet prefix for For
 * Entry rows), so a correction can't create a record the form would have
 * rejected. The UPDATE and its log row run as one script.
 */
export async function changeInventoryId(
  oldId: string,
  newId: string,
  changedBy: string,
  changeId: string
): Promise<{ source: string }> {
  await ensureInventoryLogTable();
  const bq = getBigQuery();
  const reconMonth = currentReconMonth();

  if (oldId === newId) throw new LocationChangeError("Current and new Inventory ID are the same.", 400);

  const [normal] = await bq.query({
    query: `SELECT entry_id, packet_no FROM ${table("normal_entries")} WHERE recon_month = @reconMonth AND entry_number = @oldId`,
    params: { reconMonth, oldId }
  });
  const [noPkt] = await bq.query({
    query: `SELECT entry_id FROM ${table("no_pkt_entries")} WHERE recon_month = @reconMonth AND entry_number = @oldId`,
    params: { reconMonth, oldId }
  });

  if (normal.length + noPkt.length === 0) {
    throw new LocationChangeError(`${oldId} has no For Entry or No Pkt No. entry this month.`, 404);
  }
  if (normal.length + noPkt.length > 1) {
    throw new LocationChangeError(
      `${oldId} appears more than once this month — fix it manually instead of through this form.`,
      409
    );
  }

  const inNormal = normal.length === 1;
  const entryId = ((inNormal ? normal[0] : noPkt[0]) as { entry_id: string }).entry_id;
  const sourceTable = inNormal ? "normal_entries" : "no_pkt_entries";
  const source = inNormal ? "For Entry" : "No Pkt No.";

  const check = inNormal
    ? (await validateNormalEntries((normal[0] as { packet_no: string }).packet_no, [newId], reconMonth))[0]
    : (await validateNoPktEntries([newId], reconMonth))[0];
  if (!check.valid) {
    throw new LocationChangeError(
      `New Inventory ID ${newId}: ${check.status}${check.detail ? ` — ${check.detail}` : ""}`,
      400
    );
  }

  try {
    await bq.query({
      query: `
        UPDATE ${table(sourceTable)} SET entry_number = @newId
        WHERE recon_month = @reconMonth AND entry_id = @entryId;

        INSERT INTO ${table("inventory_id_changes")}
          (change_id, recon_month, source, old_entry_number, new_entry_number, changed_by, changed_at)
        VALUES (@changeId, @reconMonth, @source, @oldId, @newId, @changedBy, CURRENT_TIMESTAMP());
      `,
      params: { newId, reconMonth, entryId, changeId, source, oldId, changedBy }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/streaming buffer/i.test(msg)) {
      throw new LocationChangeError(
        "This entry was submitted a few minutes ago and can't be edited yet. Try again in about 30 minutes.",
        409
      );
    }
    throw err;
  }
  return { source };
}

export async function recentInventoryChanges(limit = 100): Promise<Record<string, unknown>[]> {
  await ensureInventoryLogTable();
  const [rows] = await getBigQuery().query({
    query: `
      SELECT old_entry_number, new_entry_number, source, changed_by, changed_at
      FROM ${table("inventory_id_changes")}
      ORDER BY changed_at DESC
      LIMIT @limit
    `,
    params: { limit }
  });
  return rows as Record<string, unknown>[];
}
