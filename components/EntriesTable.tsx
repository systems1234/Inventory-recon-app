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
      <div className="card table-scroll flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="empty-state">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <div className="es-title">No entries found</div>
            <div className="es-sub">Try a different month or clear your filters.</div>
          </div>
        ) : (
          <table className="cl-table">
            <thead>
              <tr>
                {columns.map((c) => (
                  <th key={c.key}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => (
                <tr key={i}>
                  {columns.map((c) => (
                    <td key={c.key} className="cell-mono">
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
        <div className="pagination shrink-0">
          <span>
            Showing {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, rows.length)} of {rows.length}
          </span>
          <div className="page-btns">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1} className="page-btn">
              ‹
            </button>
            <span style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="page-btn"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
