"use client";

import { useEffect, useMemo, useState } from "react";
import { unwrap, downloadCsv } from "@/lib/format";

interface ViewData {
  key: string;
  label: string;
  description: string;
  idColumn: string;
  rows: Record<string, unknown>[];
}

interface Draft {
  comment: string;
  action: string;
}

const REVIEW_COLS = ["team_comment", "team_action"];
const PAGE_SIZE = 50;

function cell(val: unknown): string {
  if (typeof val === "boolean") return val ? "Yes" : "No";
  return unwrap(val);
}

function label(col: string): string {
  return col.replace(/_/g, " ");
}

export default function ReconciliationClient() {
  const [views, setViews] = useState<ViewData[]>([]);
  const [activeKey, setActiveKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ id: string; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/reconciliation-investigation")
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load");
        setViews(data.views ?? []);
        if (data.views?.length) setActiveKey(data.views[0].key);
      })
      .catch((e) => setLoadError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const active = views.find((v) => v.key === activeKey);
  const dataCols = useMemo(
    () => (active?.rows.length ? Object.keys(active.rows[0]).filter((c) => !REVIEW_COLS.includes(c)) : []),
    [active]
  );

  const filtered = useMemo(() => {
    if (!active) return [];
    const q = search.trim().toLowerCase();
    if (!q) return active.rows;
    return active.rows.filter((r) => dataCols.some((c) => cell(r[c]).toLowerCase().includes(q)));
  }, [active, dataCols, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function draftKey(id: string) {
    return `${activeKey}::${id}`;
  }

  function current(row: Record<string, unknown>, id: string): Draft {
    return (
      drafts[draftKey(id)] ?? { comment: unwrap(row.team_comment), action: unwrap(row.team_action) }
    );
  }

  function isDirty(row: Record<string, unknown>, id: string): boolean {
    const d = drafts[draftKey(id)];
    if (!d) return false;
    return d.comment !== unwrap(row.team_comment) || d.action !== unwrap(row.team_action);
  }

  function edit(row: Record<string, unknown>, id: string, field: keyof Draft, value: string) {
    setRowError(null);
    setDrafts((p) => ({ ...p, [draftKey(id)]: { ...current(row, id), [field]: value } }));
  }

  async function save(row: Record<string, unknown>, id: string) {
    if (!active) return;
    const d = current(row, id);
    setSavingId(id);
    setRowError(null);
    try {
      const res = await fetch("/api/reconciliation-investigation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ view: active.key, inventoryId: id, comment: d.comment, action: d.action })
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError({ id, text: data.error ?? "Save failed" });
        return;
      }
      const saved = { team_comment: d.comment.trim() || null, team_action: d.action.trim() || null };
      setViews((prev) =>
        prev.map((v) =>
          v.key !== active.key
            ? v
            : { ...v, rows: v.rows.map((r) => (unwrap(r[v.idColumn]) === id ? { ...r, ...saved } : r)) }
        )
      );
      setDrafts((p) => {
        const { [draftKey(id)]: _, ...rest } = p;
        return rest;
      });
    } catch (e) {
      setRowError({ id, text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSavingId(null);
    }
  }

  function handleExport() {
    if (!active) return;
    const cols = [
      ...dataCols.map((c) => ({ key: c, label: label(c) })),
      { key: "team_comment", label: "Inventory Team Comment & Reason" },
      { key: "team_action", label: "Inventory Team Action" }
    ];
    downloadCsv(`reconciliation_${active.key}.csv`, cols, filtered);
  }

  if (loading) return <div className="empty-state">Loading…</div>;
  if (loadError) return <div className="empty-state"><div className="es-title">Couldn&apos;t load data</div><div className="es-sub">{loadError}</div></div>;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="tabs">
        {views.map((v) => (
          <button
            key={v.key}
            className={`tab ${v.key === activeKey ? "active" : ""}`}
            onClick={() => {
              setActiveKey(v.key);
              setSearch("");
              setPage(1);
              setRowError(null);
            }}
          >
            {v.label} <span className="tab-count">{v.rows.length}</span>
          </button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0" }}>
        <span style={{ opacity: 0.7, fontSize: 13, flex: 1 }}>{active?.description}</span>
        <input
          type="text"
          className="filter-search"
          placeholder="Search…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <button className="btn-secondary btn-sm" onClick={handleExport} disabled={filtered.length === 0}>
          Export CSV
        </button>
      </div>

      <div className="card table-scroll flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="es-title">No cases found</div>
            <div className="es-sub">Nothing is flagged here right now.</div>
          </div>
        ) : (
          <table className="cl-table">
            <thead>
              <tr>
                {dataCols.map((c) => (
                  <th key={c}>{label(c)}</th>
                ))}
                <th style={{ minWidth: 260 }}>Inventory Team Comment &amp; Reason</th>
                <th style={{ minWidth: 220 }}>Inventory Team Action</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, i) => {
                const id = unwrap(row[active!.idColumn]);
                const d = current(row, id);
                const dirty = isDirty(row, id);
                return (
                  <tr key={`${id}-${i}`}>
                    {dataCols.map((c) => (
                      <td key={c} className="cell-mono">
                        {cell(row[c])}
                      </td>
                    ))}
                    <td>
                      <textarea
                        className="field-textarea"
                        rows={2}
                        maxLength={2000}
                        value={d.comment}
                        onChange={(e) => edit(row, id, "comment", e.target.value)}
                        placeholder="Why was this flagged?"
                      />
                    </td>
                    <td>
                      <textarea
                        className="field-textarea"
                        rows={2}
                        maxLength={2000}
                        value={d.action}
                        onChange={(e) => edit(row, id, "action", e.target.value)}
                        placeholder="Action taken / planned"
                      />
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>
                      <button className="btn-primary btn-sm" disabled={!dirty || savingId === id} onClick={() => save(row, id)}>
                        {savingId === id ? "Saving…" : "Submit"}
                      </button>
                      {rowError?.id === id && <div style={{ color: "#dc2626", fontSize: 12 }}>{rowError.text}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {filtered.length > 0 && (
        <div className="pagination shrink-0">
          <span>
            Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
          </span>
          <div className="page-btns">
            <button className="page-btn" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>
              ‹
            </button>
            <span style={{ padding: "0 8px", display: "flex", alignItems: "center" }}>
              {currentPage} / {totalPages}
            </span>
            <button
              className="page-btn"
              disabled={currentPage === totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
