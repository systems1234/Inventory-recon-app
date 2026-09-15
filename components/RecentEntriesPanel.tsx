"use client";

import { useEffect, useState } from "react";

interface Column {
  key: string;
  label: string;
}

interface RecentEntriesPanelProps {
  title: string;
  fetchUrl: string;
  columns: Column[];
  /** Bump this after a successful submit to refetch. */
  refreshKey: number;
}

function unwrap(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "value" in (val as any)) {
    return String((val as any).value);
  }
  return String(val);
}

function formatTime(val: unknown): string {
  const raw = unwrap(val);
  if (raw === "") return "";
  const d = new Date(raw);
  return isNaN(d.getTime())
    ? raw
    : d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function RecentEntriesPanel({ title, fetchUrl, columns, refreshKey }: RecentEntriesPanelProps) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    fetch(fetchUrl)
      .then((r) => r.json())
      .then((data) => setRows(data.entries ?? []));
  }, [fetchUrl, refreshKey]);

  return (
    <div>
      <p className="field-label mb-3">{title}</p>
      <div className="card overflow-hidden">
        {rows === null ? (
          <p className="p-5 text-slate text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-5 text-slate text-sm">Nothing submitted yet this month.</p>
        ) : (
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-paper z-10">
                <tr className="border-b border-line text-left">
                  {columns.map((c) => (
                    <th key={c.key} className="field-label px-4 py-2.5 mb-0 whitespace-nowrap">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} className="border-b border-line last:border-0">
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-ink font-mono text-xs whitespace-nowrap">
                        {c.key === "submitted_at" ? formatTime(row[c.key]) : unwrap(row[c.key])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
