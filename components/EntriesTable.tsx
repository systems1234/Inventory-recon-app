"use client";

import { useEffect, useState } from "react";
import { unwrap, formatDateTime } from "@/lib/format";

interface Column {
  key: string;
  label: string;
}

interface EntriesTableProps {
  rows: Record<string, unknown>[];
  columns: Column[];
  loading: boolean;
  pageSize?: number;
  /** Any value that should reset pagination back to page 1 when it changes (e.g. active filters). */
  resetSignal?: string;
}

export default function EntriesTable({ rows, columns, loading, pageSize = 50, resetSignal }: EntriesTableProps) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetSignal]);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageRows = rows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="flex flex-col h-full">
      <div className="card flex-1 overflow-auto min-h-0">
        {loading ? (
          <p className="p-8 text-center text-slate text-sm">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="p-8 text-center text-slate text-sm">No entries found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-paper z-10">
              <tr className="border-b border-line text-left">
                {columns.map((c, i) => (
                  <th
                    key={c.key}
                    className={`field-label px-4 py-3 mb-0 whitespace-nowrap ${i === 0 ? "sticky left-0 bg-paper z-20" : ""}`}
                  >
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={i} className="border-b border-line last:border-0">
                  {columns.map((c, ci) => (
                    <td
                      key={c.key}
                      className={`px-4 py-2.5 text-ink font-mono text-xs whitespace-nowrap ${
                        ci === 0 ? "sticky left-0 bg-surface z-[5]" : ""
                      }`}
                    >
                      {c.key === "submitted_at" ? formatDateTime(row[c.key]) : unwrap(row[c.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {rows.length > 0 && (
        <div className="flex items-center justify-between mt-3 text-sm text-slate shrink-0 flex-wrap gap-2">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="btn-ghost px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-1">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="btn-ghost px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
