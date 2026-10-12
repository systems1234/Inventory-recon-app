import { getBigQuery, table, currentReconMonth } from "./bigquery";

let tableReady: Promise<void> | null = null;

/** Audit log of every location correction; created on first use so no manual migration is needed. */
export function ensureLogTable(): Promise<void> {
  if (!tableReady) {
    tableReady = getBigQuery()
      .query({
        query: `
          CREATE TABLE IF NOT EXISTS ${table("location_changes")} (
            change_id    STRING NOT NULL,
            entry_number STRING NOT NULL,
            recon_month  DATE NOT NULL,
            old_location STRING,
            new_location STRING NOT NULL,
            changed_by   STRING NOT NULL,
            changed_at   TIMESTAMP NOT NULL
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

export class LocationChangeError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

/**
 * Overwrites the location of one inventory ID in this month's No Pkt No.
 * entries (the only entry type that stores a location per inventory ID) and
 * logs old -> new. Both statements run as one script, so a failed UPDATE
 * never leaves a log row behind.
 */
export async function changeLocation(
  entryNumber: string,
  newLocation: string,
  changedBy: string,
  changeId: string
): Promise<{ oldLocation: string | null }> {
  await ensureLogTable();
  const bq = getBigQuery();
  const reconMonth = currentReconMonth();

  const [locs] = await bq.query({
    query: `SELECT name FROM ${table("locations")} WHERE name = @name AND is_active = TRUE LIMIT 1`,
    params: { name: newLocation }
  });
  if (locs.length === 0) throw new LocationChangeError("Pick a location from the list.", 400);

  const [found] = await bq.query({
    query: `
      SELECT entry_id, location FROM ${table("no_pkt_entries")}
      WHERE recon_month = @reconMonth AND entry_number = @entryNumber
    `,
    params: { reconMonth, entryNumber }
  });
  if (found.length === 0) {
    throw new LocationChangeError(
      `${entryNumber} has no "No Pkt No." entry this month, so there is no location to change.`,
      404
    );
  }
  const { entry_id, location: oldLocation } = found[0] as { entry_id: string; location: string | null };
  if (oldLocation === newLocation) {
    throw new LocationChangeError(`${entryNumber} is already at "${newLocation}".`, 400);
  }

  try {
    await bq.query({
      query: `
        UPDATE ${table("no_pkt_entries")} SET location = @newLocation
        WHERE recon_month = @reconMonth AND entry_id = @entryId;

        INSERT INTO ${table("location_changes")}
          (change_id, entry_number, recon_month, old_location, new_location, changed_by, changed_at)
        VALUES (@changeId, @entryNumber, @reconMonth, @oldLocation, @newLocation, @changedBy, CURRENT_TIMESTAMP());
      `,
      params: { newLocation, reconMonth, entryId: entry_id, changeId, entryNumber, oldLocation, changedBy },
      types: { oldLocation: "STRING" }
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // BigQuery blocks UPDATE on rows still in the streaming buffer (just inserted).
    if (/streaming buffer/i.test(msg)) {
      throw new LocationChangeError(
        "This entry was submitted a few minutes ago and can't be edited yet. Try again in about 30 minutes.",
        409
      );
    }
    throw err;
  }
  return { oldLocation };
}

export async function recentChanges(limit = 100): Promise<Record<string, unknown>[]> {
  await ensureLogTable();
  const [rows] = await getBigQuery().query({
    query: `
      SELECT entry_number, old_location, new_location, changed_by, changed_at
      FROM ${table("location_changes")}
      ORDER BY changed_at DESC
      LIMIT @limit
    `,
    params: { limit }
  });
  return rows as Record<string, unknown>[];
}
