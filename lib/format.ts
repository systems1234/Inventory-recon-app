/** BigQuery client wraps DATE/TIMESTAMP values as {value: "..."} — unwrap to a plain string. */
export function unwrap(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "value" in (val as any)) {
    return String((val as any).value);
  }
  return String(val);
}

export function formatDate(val: unknown): string {
  const raw = unwrap(val);
  if (raw === "") return "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function formatDateTime(val: unknown): string {
  const raw = unwrap(val);
  if (raw === "") return "";
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}
