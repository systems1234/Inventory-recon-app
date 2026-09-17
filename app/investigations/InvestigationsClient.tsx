"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";

interface Investigation {
  id: string;
  display_name: string;
  description: string | null;
  group_number: string;
  admin_only: boolean;
  sort_order: number;
  key_columns: string[];
  filter_columns: string[];
  assigned_emails: string[];
}

interface WeekOption {
  recon_week: string;
  run_by: string;
  run_at: string;
}

interface ResolutionState {
  solved_date: string;
  action: string;
  reason: string;
  comment: string;
}

const RESOLUTION_COLS: (keyof ResolutionState)[] = ["solved_date", "action", "reason", "comment"];
const HIDDEN_COLS = ["updated_by", "updated_at"]; // audit trail — not shown, still stored

const PAGE_SIZE = 50;
const MAX_IMPORT_ROWS = 200;

function unwrap(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "object" && val !== null && "value" in (val as any)) {
    return String((val as any).value);
  }
  return String(val);
}

function formatDate(val: unknown): string {
  const raw = unwrap(val);
  if (raw === "") return "";
  const d = new Date(raw);
  return isNaN(d.getTime()) ? raw : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function groupLabel(group: string): string {
  return group === "extra" ? "Admin" : `Group ${group}`;
}

function rowKey(row: Record<string, unknown>, keyColumns: string[], fallbackIndex: number): string {
  if (keyColumns.length === 0) return `__row_${fallbackIndex}`;
  return keyColumns.map((c) => unwrap(row[c])).join("__");
}

function csvField(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadCsv(filename: string, columns: string[], rows: Record<string, unknown>[]) {
  const lines = [
    columns.map(csvField).join(","),
    ...rows.map((row) => columns.map((col) => csvField(unwrap(row[col]))).join(","))
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Minimal RFC4180 CSV parser: handles quoted fields, escaped quotes, commas and newlines inside quotes. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export default function InvestigationsClient() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  const email = session?.user?.email ?? "";
  const isAdmin = role === "admin";

  const [investigations, setInvestigations] = useState<Investigation[]>([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<string>("");
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);

  const [running, setRunning] = useState(false);
  const [runMessage, setRunMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [rowRunning, setRowRunning] = useState<string | null>(null);

  const [filters, setFilters] = useState<Record<string, string>>({});
  const [page, setPage] = useState(1);

  // Inline edits, keyed by rowKey(row, keyColumns) -> partial ResolutionState.
  const [edits, setEdits] = useState<Record<string, Partial<ResolutionState>>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ key: string; text: string } | null>(null);

  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ matched: number; unmatched: number } | null>(null);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    fetch("/api/investigations/list")
      .then((r) => r.json())
      .then((data) => {
        const list: Investigation[] = data.investigations ?? [];
        setInvestigations(list);
        if (list.length > 0) {
          setSelectedId(list[0].id);
          setOpenGroups({ [list[0].group_number]: true });
        }
      });
  }, []);

  function refreshWeeks() {
    return fetch("/api/investigations/weeks")
      .then((r) => r.json())
      .then((data) => {
        const raw: WeekOption[] = data.weeks ?? [];
        const list: WeekOption[] = raw.map((w) => ({
          recon_week: unwrap(w.recon_week),
          run_by: unwrap(w.run_by),
          run_at: unwrap(w.run_at)
        }));
        setWeeks(list);
        return list;
      });
  }

  useEffect(() => {
    refreshWeeks().then((list) => {
      if (list.length > 0) setSelectedWeek(list[0].recon_week);
    });
  }, []);

  useEffect(() => {
    if (!selectedId || !selectedWeek) return;
    setLoading(true);
    setFilters({});
    setPage(1);
    setEdits({});
    setImportResult(null);
    fetch(`/api/investigations/report?id=${selectedId}&week=${selectedWeek}`)
      .then((r) => r.json())
      .then((data) => setRows(data.rows ?? []))
      .finally(() => setLoading(false));
  }, [selectedId, selectedWeek]);

  async function handleRun() {
    setRunning(true);
    setRunMessage(null);
    try {
      const res = await fetch("/api/investigations/run", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setRunMessage({ type: "error", text: data.error ?? "Something went wrong" });
      } else {
        setRunMessage({ type: "success", text: "This week's investigations are up to date." });
        await refreshWeeks();
        setSelectedWeek(data.reconWeek);
      }
    } finally {
      setRunning(false);
    }
  }

  async function handleRunOne(id: string) {
    setRowRunning(id);
    setRunMessage(null);
    try {
      const res = await fetch("/api/investigations/run-one", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      if (!res.ok) {
        setRunMessage({ type: "error", text: data.error ?? "Something went wrong" });
      } else {
        setRunMessage({ type: "success", text: `${data.displayName} was re-run.` });
        await refreshWeeks();
        if (id === selectedId) setSelectedWeek(data.reconWeek);
      }
    } finally {
      setRowRunning(null);
    }
  }

  const groups = useMemo(() => {
    const byGroup = new Map<string, Investigation[]>();
    for (const inv of investigations) {
      if (!byGroup.has(inv.group_number)) byGroup.set(inv.group_number, []);
      byGroup.get(inv.group_number)!.push(inv);
    }
    return Array.from(byGroup.entries());
  }, [investigations]);

  const allColumns = rows.length > 0 ? Object.keys(rows[0]) : [];
  const dataColumns = allColumns.filter(
    (c) => !RESOLUTION_COLS.includes(c as keyof ResolutionState) && !HIDDEN_COLS.includes(c)
  );
  const selectedInvestigation = investigations.find((i) => i.id === selectedId);
  const filterColumns = selectedInvestigation?.filter_columns ?? [];
  const keyColumns = selectedInvestigation?.key_columns ?? [];
  const canRunSelected =
    !!selectedInvestigation && (isAdmin || (selectedInvestigation.assigned_emails ?? []).includes(email));

  const filteredRows = useMemo(() => {
    const active = Object.entries(filters).filter(([, v]) => v.trim() !== "");
    if (active.length === 0) return rows;
    return rows.filter((row) => active.every(([col, val]) => unwrap(row[col]).toLowerCase().includes(val.toLowerCase())));
  }, [rows, filters]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageRows = filteredRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  function handleFilterChange(col: string, value: string) {
    setFilters((prev) => ({ ...prev, [col]: value }));
    setPage(1);
  }

  function handleExport() {
    if (allColumns.length === 0) return;
    const exportCols = [...dataColumns, ...RESOLUTION_COLS];
    const filename = `${selectedInvestigation?.display_name ?? selectedId}_${selectedWeek}.csv`.replace(/\s+/g, "_");
    downloadCsv(filename, exportCols, filteredRows);
  }

  function fieldValue(row: Record<string, unknown>, key: string, field: keyof ResolutionState): string {
    const edit = edits[key];
    if (edit && field in edit) return edit[field] ?? "";
    return unwrap(row[field]);
  }

  function handleFieldChange(key: string, field: keyof ResolutionState, value: string) {
    setEdits((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }));
    setRowError(null);
  }

  async function handleSaveRow(row: Record<string, unknown>) {
    if (!selectedInvestigation || keyColumns.length === 0) return;
    const key = rowKey(row, keyColumns, 0);
    const keyValues: Record<string, string> = {};
    for (const c of keyColumns) keyValues[c] = unwrap(row[c]);

    const payload = {
      id: selectedInvestigation.id,
      keyValues,
      solved_date: fieldValue(row, key, "solved_date") || null,
      action: fieldValue(row, key, "action") || null,
      reason: fieldValue(row, key, "reason") || null,
      comment: fieldValue(row, key, "comment") || null
    };

    setSavingKey(key);
    setRowError(null);
    try {
      const res = await fetch("/api/investigations/resolution", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) {
        setRowError({ key, text: data.error ?? "Save failed" });
        return;
      }
      setRows((prev) =>
        prev.map((r) =>
          rowKey(r, keyColumns, 0) === key
            ? { ...r, solved_date: payload.solved_date, action: payload.action, reason: payload.reason, comment: payload.comment }
            : r
        )
      );
      setEdits((prev) => {
        const { [key]: _, ...rest } = prev;
        return rest;
      });
    } finally {
      setSavingKey(null);
    }
  }

  function handleImportClick() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,text/csv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file || !selectedInvestigation) return;
      const text = await file.text();
      const parsed = parseCsv(text);
      if (parsed.length < 2) {
        setRunMessage({ type: "error", text: "CSV has no data rows." });
        return;
      }
      const header = parsed[0].map((h) => h.trim());
      const dataRows = parsed.slice(1);

      const missingKeyCols = keyColumns.filter((c) => !header.includes(c));
      if (missingKeyCols.length > 0) {
        setRunMessage({
          type: "error",
          text: `CSV is missing key column(s): ${missingKeyCols.join(", ")}. Export first to get the right format.`
        });
        return;
      }
      if (dataRows.length > MAX_IMPORT_ROWS) {
        setRunMessage({ type: "error", text: `Import is limited to ${MAX_IMPORT_ROWS} rows (file has ${dataRows.length}).` });
        return;
      }

      const idx = (name: string) => header.indexOf(name);
      const importRows = dataRows
        .filter((r) => r.length > 1 || r[0] !== "")
        .map((r) => {
          const keyValues: Record<string, string> = {};
          for (const c of keyColumns) keyValues[c] = r[idx(c)] ?? "";
          return {
            keyValues,
            fields: {
              solved_date: idx("solved_date") >= 0 ? r[idx("solved_date")]?.trim() || null : null,
              action: idx("action") >= 0 ? r[idx("action")]?.trim() || null : null,
              reason: idx("reason") >= 0 ? r[idx("reason")]?.trim() || null : null,
              comment: idx("comment") >= 0 ? r[idx("comment")]?.trim() || null : null
            }
          };
        });

      setImporting(true);
      setRunMessage(null);
      setImportResult(null);
      try {
        const res = await fetch("/api/investigations/resolution/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: selectedInvestigation.id, rows: importRows })
        });
        const data = await res.json();
        if (!res.ok) {
          setRunMessage({ type: "error", text: data.error ?? "Import failed" });
        } else {
          setImportResult({ matched: data.matched, unmatched: data.unmatched?.length ?? 0 });
          // Refresh current view so saved values show immediately.
          setLoading(true);
          fetch(`/api/investigations/report?id=${selectedInvestigation.id}&week=${selectedWeek}`)
            .then((r) => r.json())
            .then((d) => setRows(d.rows ?? []))
            .finally(() => setLoading(false));
        }
      } finally {
        setImporting(false);
      }
    };
    input.click();
  }

  return (
    <div className="h-full flex flex-col">
      {runMessage && (
        <div
          className={`card p-3 mb-4 shrink-0 ${
            runMessage.type === "error" ? "bg-ruby-light border-ruby/30" : "bg-emerald-light border-emerald/30"
          }`}
        >
          <p className={runMessage.type === "error" ? "text-ruby text-sm" : "text-emerald text-sm"}>{runMessage.text}</p>
        </div>
      )}

      {weeks.length === 0 ? (
        <div className="card p-8 text-center text-slate shrink-0">
          <p className="mb-3">No investigations have been run yet.</p>
          <button onClick={handleRun} disabled={running} className="btn-primary">
            {running ? "Running…" : "Run Now"}
          </button>
        </div>
      ) : (
        <div className="flex flex-col md:flex-row gap-0 md:gap-4 flex-1 min-h-0">
          <div className="flex md:flex-col items-center md:items-stretch gap-2 md:gap-0 mb-2 md:mb-0 shrink-0">
            <button
              onClick={() => setSidebarOpen((o) => !o)}
              title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
              className="shrink-0 h-8 w-8 flex items-center justify-center text-slate hover:text-ink border border-line rounded bg-surface transition-colors"
            >
              {sidebarOpen ? "‹" : "›"}
            </button>
          </div>

          {sidebarOpen && (
            <aside className="w-full md:w-56 shrink-0 mb-4 md:mb-0 overflow-y-auto">
              <p className="text-ink font-medium text-sm mb-2">Run this week's investigations</p>
              <button onClick={handleRun} disabled={running} className="btn-primary w-full mb-4">
                {running ? "Running…" : "Run Now"}
              </button>

              <p className="field-label mb-1.5">Week</p>
              <select className="field-input mb-4" value={selectedWeek} onChange={(e) => setSelectedWeek(e.target.value)}>
                {weeks.map((w) => (
                  <option key={w.recon_week} value={w.recon_week}>
                    {formatDate(w.recon_week)}
                  </option>
                ))}
              </select>

              <nav className="space-y-2">
                {groups.map(([group, list]) => (
                  <details key={group} open={!!openGroups[group]} className="group/details">
                    <summary
                      onClick={(e) => {
                        e.preventDefault();
                        setOpenGroups((prev) => ({ ...prev, [group]: !prev[group] }));
                      }}
                      className="field-label mb-1 cursor-pointer select-none list-none flex items-center gap-1"
                    >
                      <span className="inline-block transition-transform group-open/details:rotate-90">›</span>
                      {groupLabel(group)}
                    </summary>
                    <div className="space-y-0.5 pl-3 mt-1">
                      {list.map((inv) => {
                        const canRun = isAdmin || (inv.assigned_emails ?? []).includes(email);
                        return (
                          <div key={inv.id} className="flex items-center gap-1">
                            <button
                              onClick={() => setSelectedId(inv.id)}
                              className={`flex-1 text-left text-sm px-2 py-1 rounded transition-colors truncate ${
                                selectedId === inv.id ? "bg-sapphire/10 text-sapphire font-medium" : "text-slate hover:text-ink"
                              }`}
                            >
                              {inv.display_name}
                            </button>
                            {canRun && (
                              <button
                                onClick={() => handleRunOne(inv.id)}
                                disabled={rowRunning === inv.id}
                                title={`Run only ${inv.display_name}`}
                                className="shrink-0 text-[11px] px-1.5 py-1 rounded text-slate hover:text-sapphire hover:bg-sapphire/10 transition-colors disabled:opacity-40"
                              >
                                {rowRunning === inv.id ? "…" : "Run"}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </details>
                ))}
              </nav>
            </aside>
          )}

          <div className="flex-1 min-w-0 min-h-0 flex flex-col">
            <div className="flex items-center justify-between gap-3 mb-3 flex-wrap shrink-0">
              <div>
                <h2 className="font-sans font-bold text-lg sm:text-xl text-ink">
                  {selectedInvestigation?.display_name ?? ""}
                </h2>
                {selectedInvestigation?.description && (
                  <p className="text-slate text-sm mt-0.5 max-w-2xl">{selectedInvestigation.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {canRunSelected && selectedId && (
                  <button
                    onClick={() => handleRunOne(selectedId)}
                    disabled={rowRunning === selectedId}
                    className="btn-ghost whitespace-nowrap text-sm px-3 py-1.5"
                  >
                    {rowRunning === selectedId ? "Running…" : "Run this investigation"}
                  </button>
                )}
                <button
                  onClick={handleImportClick}
                  disabled={importing || !selectedInvestigation}
                  className="btn-ghost whitespace-nowrap text-sm px-3 py-1.5 disabled:opacity-40"
                >
                  {importing ? "Importing…" : "Import CSV"}
                </button>
                <button
                  onClick={handleExport}
                  disabled={filteredRows.length === 0}
                  className="btn-ghost whitespace-nowrap text-sm px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Export CSV
                </button>
              </div>
            </div>

            {selectedInvestigation && keyColumns.length === 0 && (
              <div className="card p-3 mb-4 bg-ruby-light border-ruby/30 shrink-0">
                <p className="text-ruby text-sm">
                  No key columns configured for this investigation — Save, Import, and Run are disabled until an
                  admin sets `key_columns` in the investigations config table.
                </p>
              </div>
            )}

            {importResult && (
              <div className="card p-3 mb-4 bg-emerald-light border-emerald/30 shrink-0">
                <p className="text-emerald text-sm">
                  {importResult.matched} row(s) updated
                  {importResult.unmatched > 0 ? `, ${importResult.unmatched} row(s) had no matching record` : ""}.
                </p>
              </div>
            )}

            {filterColumns.length > 0 && rows.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4 shrink-0">
                {filterColumns.map((col) => (
                  <input
                    key={col}
                    type="text"
                    placeholder={`Filter ${col}`}
                    value={filters[col] ?? ""}
                    onChange={(e) => handleFilterChange(col, e.target.value)}
                    className="filter-search w-full sm:w-48"
                  />
                ))}
              </div>
            )}

            {loading ? (
              <div className="card p-8 text-center text-slate">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="card p-8 text-center text-slate">No discrepancies found for this week.</div>
            ) : filteredRows.length === 0 ? (
              <div className="card p-8 text-center text-slate">No rows match the current filters.</div>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">
                <div className="card table-scroll flex-1 min-h-0">
                  <table className="cl-table">
                    <thead>
                      <tr>
                        {dataColumns.map((col, i) => (
                          <th key={col} className={i === 0 ? "sticky left-0 bg-surface z-20" : ""}>
                            {col}
                          </th>
                        ))}
                        <th>Solved Date</th>
                        <th>Action</th>
                        <th>Reason</th>
                        <th>Comment</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((row, i) => {
                        const key = rowKey(row, keyColumns, (currentPage - 1) * PAGE_SIZE + i);
                        const hasEdit = !!edits[key];
                        const isSaving = savingKey === key;
                        return (
                          <tr key={key || i} style={{ verticalAlign: "top" }}>
                            {dataColumns.map((col, ci) => {
                              const raw = unwrap(row[col]);
                              const isLong = raw.length > 60;
                              return (
                                <td
                                  key={col}
                                  className={`cell-mono max-w-xs truncate ${ci === 0 ? "sticky left-0 bg-surface z-[5]" : ""}`}
                                  title={isLong ? raw : undefined}
                                >
                                  {raw}
                                </td>
                              );
                            })}
                            <td>
                              <input
                                type="date"
                                value={fieldValue(row, key, "solved_date")}
                                onChange={(e) => handleFieldChange(key, "solved_date", e.target.value)}
                                className="field-input py-1.5 text-xs w-36"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={fieldValue(row, key, "action")}
                                onChange={(e) => handleFieldChange(key, "action", e.target.value)}
                                className="field-input py-1.5 text-xs w-32"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={fieldValue(row, key, "reason")}
                                onChange={(e) => handleFieldChange(key, "reason", e.target.value)}
                                className="field-input py-1.5 text-xs w-36"
                              />
                            </td>
                            <td>
                              <input
                                type="text"
                                value={fieldValue(row, key, "comment")}
                                onChange={(e) => handleFieldChange(key, "comment", e.target.value)}
                                className="field-input py-1.5 text-xs w-36"
                              />
                            </td>
                            <td>
                              <button
                                onClick={() => handleSaveRow(row)}
                                disabled={!hasEdit || isSaving}
                                className="btn-primary btn-sm"
                              >
                                {isSaving ? "…" : "Save"}
                              </button>
                              {rowError?.key === key && <p className="text-ruby text-[11px] mt-1 max-w-[8rem]">{rowError.text}</p>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="pagination shrink-0">
                  <span>
                    Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filteredRows.length)} of{" "}
                    {filteredRows.length}
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
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
