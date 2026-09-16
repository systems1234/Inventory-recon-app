/** Last `count` months (including current) as YYYY-MM-01 values, newest first. */
export function recentMonths(count = 12): { value: string; label: string }[] {
  const months: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < count; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const y = d.getUTCFullYear();
    const m = String(d.getUTCMonth() + 1).padStart(2, "0");
    months.push({
      value: `${y}-${m}-01`,
      label: d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    });
  }
  return months;
}
