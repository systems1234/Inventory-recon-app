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

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

/** Downloads `rows` as a CSV file, using `columns` (key, label) for header + order. */
export function downloadCsv(filename: string, columns: { key: string; label: string }[], rows: Record<string, unknown>[]) {
  const lines = [
    columns.map((c) => csvField(c.label)).join(","),
    ...rows.map((row) => columns.map((c) => csvField(unwrap(row[c.key]))).join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
