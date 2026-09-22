import { getBigQuery, table, bomTable, inventoryMasterTable, orderInOutTable } from "./bigquery";

export type EntryStatus =
  | "Valid Inventory No"
  | "Blank Inventory"
  | "Invalid No - Same as Packet No"
  | "Invalid Inventory No - More than 6 Digits"
  | "Invalid Inventory No - Not 94 or 800"
  | "Invalid Inventory No - Duplicate"
  | "Invalid Inventory No - Not Found in Inventory Master"
  | "Invalid Inventory No - Out of Stock"
  | "Invalid Inventory No - Already Present in BOM"
  | "Invalid Inventory No - Already Saved in Database"
  | "Invalid Inventory No - Not Matching Packet No";

/**
 * Order_In_Out holds one row per movement, so an Inventory_ID can appear
 * many times -- only the latest row (by Timestamp) reflects current status.
 * Anything other than "Out of Stock" (WIP, "Instock - Loose", null, or no
 * row at all) is treated as in-stock; only an exact latest status of
 * "Out of Stock" disqualifies an ID.
 */
async function fetchOutOfStockIds(ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT inv_id FROM (
        SELECT
          CAST(Inventory_ID AS STRING) AS inv_id,
          Inventory_Status,
          ROW_NUMBER() OVER (PARTITION BY Inventory_ID ORDER BY Timestamp DESC) AS rn
        FROM ${orderInOutTable()}
        WHERE CAST(Inventory_ID AS STRING) IN UNNEST(@ids)
      )
      WHERE rn = 1 AND LOWER(TRIM(Inventory_Status)) = 'out of stock'
    `,
    params: { ids }
  });
  return new Set(rows.map((r: any) => r.inv_id));
}

export interface EntryCheckResult {
  entry_number: string;
  status: EntryStatus;
  valid: boolean;
}

/**
 * Port of the Normal Entry sheet formula. Order of checks matters — first
 * match wins, same as the nested IFs in the original.
 */
export async function validateNormalEntries(
  packetNo: string,
  entryNumbers: string[],
  reconMonth: string
): Promise<EntryCheckResult[]> {
  const trimmedPacket = packetNo.trim();
  const bq = getBigQuery();

  // Duplicate-within-batch: count occurrences as we go (matches COUNTIF over the growing range).
  const seenCounts = new Map<string, number>();

  // Pre-fetch anything that requires a DB round trip, once, for the whole batch.
  const nonBlank = entryNumbers.map((e) => e.trim()).filter((e) => e !== "");

  const [bomRows] = nonBlank.length
    ? await bq.query({
        query: `
          SELECT Inv_ID AS inv_id, RTO_Mark AS status
          FROM ${bomTable()}
          WHERE Inv_ID IN UNNEST(@ids)
        `,
        params: { ids: nonBlank }
      })
    : [[]];
  const bomMap = new Map<string, string | null>(bomRows.map((r: any) => [r.inv_id, r.status]));

  const [existingRows] = nonBlank.length
    ? await bq.query({
        query: `
          SELECT entry_number
          FROM ${table("normal_entries")}
          WHERE recon_month = @reconMonth
            AND entry_number IN UNNEST(@ids)
        `,
        params: { reconMonth, ids: nonBlank }
      })
    : [[]];
  const alreadyInDatabase = new Set(existingRows.map((r: any) => r.entry_number));

  // Every entry number must be a real inventory ID. Cast to STRING:
  // Inventory_ID is INT64 in Inventory_Master, entry numbers arrive as
  // strings from the form.
  const [masterRows] = nonBlank.length
    ? await bq.query({
        query: `
          SELECT CAST(Inventory_ID AS STRING) AS inv_id
          FROM ${inventoryMasterTable()}
          WHERE CAST(Inventory_ID AS STRING) IN UNNEST(@ids)
        `,
        params: { ids: nonBlank }
      })
    : [[]];
  const inMaster = new Set(masterRows.map((r: any) => r.inv_id));

  const outOfStock = await fetchOutOfStockIds(nonBlank);

  const results: EntryCheckResult[] = [];

  for (const raw of entryNumbers) {
    const id = raw.trim();

    if (id === "") {
      results.push({ entry_number: id, status: "Blank Inventory", valid: false });
      continue;
    }

    const count = (seenCounts.get(id) ?? 0) + 1;
    seenCounts.set(id, count);

    let status: EntryStatus;

    if (id === trimmedPacket) {
      status = "Invalid No - Same as Packet No";
    } else if (id.length > 6) {
      status = "Invalid Inventory No - More than 6 Digits";
    } else if (id.length <= 3 && id !== "94" && id !== "800") {
      status = "Invalid Inventory No - Not 94 or 800";
    } else if (count > 1) {
      status = "Invalid Inventory No - Duplicate";
    } else if (!inMaster.has(id)) {
      status = "Invalid Inventory No - Not Found in Inventory Master";
    } else if (outOfStock.has(id)) {
      status = "Invalid Inventory No - Out of Stock";
    } else if (bomMap.has(id) && bomMap.get(id) !== "RTO") {
      status = "Invalid Inventory No - Already Present in BOM";
    } else if (alreadyInDatabase.has(id)) {
      status = "Invalid Inventory No - Already Saved in Database";
    } else if (id.slice(0, trimmedPacket.length) !== trimmedPacket) {
      status = "Invalid Inventory No - Not Matching Packet No";
    } else {
      status = "Valid Inventory No";
    }

    results.push({ entry_number: id, status, valid: status === "Valid Inventory No" });
  }

  return results;
}

export type NoPktStatus =
  | "Valid"
  | "Duplicate Entry"
  | "Already entered under a Packet No."
  | "Already saved in database"
  | "Not Found in Inventory Master"
  | "Out of Stock";

export interface NoPktCheckResult {
  entry_number: string;
  status: NoPktStatus;
  detail?: string; // e.g. the packet_no it was found under
  valid: boolean;
}

/**
 * Port of the "Entry where no Pkt No." sheet formula. The original also
 * looked a value up in criteria!F:I — we don't have an equivalent for that
 * lookup, so this checks duplicates + cross-reference against normal_entries
 * + cross-reference against this form's own table instead.
 */
export async function validateNoPktEntries(
  entryNumbers: string[],
  reconMonth: string
): Promise<NoPktCheckResult[]> {
  const bq = getBigQuery();
  const nonBlank = entryNumbers.map((e) => e.trim()).filter((e) => e !== "");

  const [normalRows] = nonBlank.length
    ? await bq.query({
        query: `
          SELECT entry_number, packet_no
          FROM ${table("normal_entries")}
          WHERE recon_month = @reconMonth
            AND entry_number IN UNNEST(@ids)
        `,
        params: { reconMonth, ids: nonBlank }
      })
    : [[]];
  const foundUnderPacket = new Map<string, string>(
    normalRows.map((r: any) => [r.entry_number, r.packet_no])
  );

  // Entry numbers here are meant to be real inventory IDs (just without a
  // packet number attached) -- unlike Normal Entry, nothing else in this
  // form checks that they actually exist. Cast to STRING: Inventory_ID
  // is INT64 in Inventory_Master, entry numbers arrive as strings.
  const [masterRows] = nonBlank.length
    ? await bq.query({
        query: `
          SELECT CAST(Inventory_ID AS STRING) AS inv_id
          FROM ${inventoryMasterTable()}
          WHERE CAST(Inventory_ID AS STRING) IN UNNEST(@ids)
        `,
        params: { ids: nonBlank }
      })
    : [[]];
  const inMaster = new Set(masterRows.map((r: any) => r.inv_id));

  const outOfStock = await fetchOutOfStockIds(nonBlank);

  const [noPktRows] = nonBlank.length
    ? await bq.query({
        query: `
          SELECT entry_number
          FROM ${table("no_pkt_entries")}
          WHERE recon_month = @reconMonth
            AND entry_number IN UNNEST(@ids)
        `,
        params: { reconMonth, ids: nonBlank }
      })
    : [[]];
  const alreadyInNoPktDatabase = new Set(noPktRows.map((r: any) => r.entry_number));

  const seenCounts = new Map<string, number>();
  const results: NoPktCheckResult[] = [];

  for (const raw of entryNumbers) {
    const id = raw.trim();
    if (id === "") {
      results.push({ entry_number: id, status: "Valid", valid: false });
      continue;
    }

    const count = (seenCounts.get(id) ?? 0) + 1;
    seenCounts.set(id, count);

    if (count > 1) {
      results.push({ entry_number: id, status: "Duplicate Entry", valid: false });
    } else if (!inMaster.has(id)) {
      results.push({ entry_number: id, status: "Not Found in Inventory Master", valid: false });
    } else if (outOfStock.has(id)) {
      results.push({ entry_number: id, status: "Out of Stock", valid: false });
    } else if (foundUnderPacket.has(id)) {
      results.push({
        entry_number: id,
        status: "Already entered under a Packet No.",
        detail: foundUnderPacket.get(id),
        valid: false
      });
    } else if (alreadyInNoPktDatabase.has(id)) {
      results.push({ entry_number: id, status: "Already saved in database", valid: false });
    } else {
      results.push({ entry_number: id, status: "Valid", valid: true });
    }
  }

  return results;
}
