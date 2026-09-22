import { BigQuery } from "@google-cloud/bigquery";

let client: BigQuery | null = null;

/**
 * Server-side only. Never import this from a "use client" component.
 * Reads credentials from GCP_SERVICE_ACCOUNT_KEY (full JSON, as a string).
 */
export function getBigQuery(): BigQuery {
  if (client) return client;

  const rawKey = process.env.GCP_SERVICE_ACCOUNT_KEY;
  if (!rawKey) {
    throw new Error("GCP_SERVICE_ACCOUNT_KEY is not set");
  }

  const credentials = JSON.parse(rawKey);

  client = new BigQuery({
    projectId: process.env.GCP_PROJECT_ID,
    credentials,
    // Pinned explicitly. Location inference is per-job and only works when
    // every referenced dataset resolves cleanly; a multi-statement script
    // spanning inventory_recon + IMS_New_Version + mtd_orders is exactly the
    // case where inference gets it wrong and the job dies with "Not found:
    // Dataset" despite the dataset plainly existing.
    location: process.env.BIGQUERY_LOCATION || "asia-south2",
    // Some IMS_New_Version tables (BOM / BOM_Prior_Date) are external tables
    // backed by a live Google Sheet, not native BQ storage. Reading through
    // those requires the Drive scope on top of the default BigQuery scope —
    // without it BigQuery itself returns "Permission denied while getting
    // Drive credentials" even when the service account's IAM roles and the
    // sheet's sharing are both correct. The service account (its
    // client_email, see the Sheet's share settings) also still needs to be
    // shared as a Viewer on each such sheet; this scope alone isn't enough.
    scopes: [
      "https://www.googleapis.com/auth/bigquery",
      "https://www.googleapis.com/auth/drive.readonly"
    ]
  });

  return client;
}

export function dataset(): string {
  const ds = process.env.BIGQUERY_DATASET;
  if (!ds) throw new Error("BIGQUERY_DATASET is not set");
  return ds;
}

export function table(name: string): string {
  return `\`${process.env.GCP_PROJECT_ID}.${dataset()}.${name}\``;
}

/**
 * Your existing BOM table lives in a different dataset (IMS_New_Version),
 * not the one this app owns. Fully qualified, set via env var so it's not
 * hardcoded across environments.
 */
export function bomTable(): string {
  const id = process.env.BOM_TABLE_ID;
  if (!id) throw new Error("BOM_TABLE_ID is not set");
  return `\`${id}\``;
}

/**
 * The real inventory master table -- IMS_New_Version.Inventory_Master,
 * column Inventory_ID. Every entry number submitted through any form must
 * exist here; anything else (e.g. Final_Inventory_Master, a derived view)
 * is not the source of truth for this check.
 */
export function inventoryMasterTable(): string {
  const id = process.env.INVENTORY_MASTER_ID;
  if (!id) throw new Error("INVENTORY_MASTER_ID is not set");
  return `\`${id}\``;
}

/**
 * HR's own employee directory (LifeCycle_FMS.Employee_Data) -- sign-in
 * access is gated on a row here whose Project_Systems column lists
 * "inventory_recon", instead of a separate allow-list this app owns.
 */
export function employeeTable(): string {
  const id = process.env.EMPLOYEE_DATA_TABLE_ID;
  if (!id) throw new Error("EMPLOYEE_DATA_TABLE_ID is not set");
  return `\`${id}\``;
}

/** First-of-month DATE string for the current recon period, e.g. "2026-09-01". */
export function currentReconMonth(): string {
  const now = new Date();
  const y = now.getUTCFullYear();
  const m = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}
