"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

interface RowResult {
  entry_number: string;
  status: string;
  valid: boolean;
}

export default function NormalEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [gemstones, setGemstones] = useState<string[]>([]);
  const [packetNo, setPacketNo] = useState("");
  const [gemstone, setGemstone] = useState("");
  const [entryNumbers, setEntryNumbers] = useState<string[]>([""]);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndexRef = useRef<number | null>(null);

  useEffect(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((data) => setGemstones(data.gemstones ?? []));
  }, []);

  useEffect(() => {
    if (focusIndexRef.current !== null) {
      rowRefs.current[focusIndexRef.current]?.focus();
      focusIndexRef.current = null;
    }
  }, [entryNumbers]);

  function downloadTemplate() {
    const csv = "Inventory ID\n";
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "normal-entry-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function handleCsvUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setCsvError(null);

    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      const lines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => l !== "");

      // Drop a header row like "Inventory ID" / "Entry Number" if present.
      if (lines.length > 0 && /^(inventory\s*id|entry\s*number)$/i.test(lines[0])) {
        lines.shift();
      }

      if (lines.length === 0) {
        setCsvError("That file had no inventory IDs in it.");
        return;
      }

      setEntryNumbers(lines);
      setResults(null);
      setSubmittedCount(null);
      setErrorsOnly(false);
    };
    reader.onerror = () => setCsvError("Couldn't read that file — try again.");
    reader.readAsText(file);

    // allow re-uploading the same filename later
    e.target.value = "";
  }

  function updateEntry(index: number, value: string) {
    setEntryNumbers((prev) => prev.map((v, i) => (i === index ? value : v)));
    setResults(null);
    setSubmittedCount(null);
  }

  function addRow(focus = false) {
    setEntryNumbers((prev) => {
      const next = [...prev, ""];
      if (focus) focusIndexRef.current = next.length - 1;
      return next;
    });
  }

  function removeRow(index: number) {
    setEntryNumbers((prev) => prev.filter((_, i) => i !== index));
  }

  /**
   * Scanners fill a field then send Enter. On the last row this creates and
   * focuses a new row automatically, matching how the old Google Sheet
   * behaved (Enter there just created the next row) instead of requiring a
   * manual "+ Add entry" click after every single scan. On an earlier row,
   * Enter just moves to the next field.
   */
  function handleRowKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (index === entryNumbers.length - 1) {
      addRow(true);
    } else {
      rowRefs.current[index + 1]?.focus();
    }
  }

  async function handleCheckAndSubmit() {
    setSubmitting(true);
    setSubmittedCount(null);
    try {
      const cleanEntries = entryNumbers.filter((e) => e.trim() !== "");
      const res = await fetch("/api/entries/normal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packet_no: packetNo, gemstone, entry_numbers: cleanEntries })
      });
      const data = await res.json();
      setResults(data.results ?? null);
      if (data.submitted > 0) {
        setSubmittedCount(data.submitted);
        setEntryNumbers([""]);
        setErrorsOnly(false);
        onSaved?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canCheck = packetNo.trim() && gemstone && entryNumbers.some((e) => e.trim() !== "");

  function statusFor(id: string): RowResult | undefined {
    return results?.find((r) => r.entry_number === id.trim());
  }

  /** Flags rows whose Inventory ID repeats elsewhere in this batch, live as you type — before Check & Submit ever runs. */
  const duplicateIndexes = useMemo(() => {
    const seen = new Map<string, number[]>();
    entryNumbers.forEach((v, i) => {
      const key = v.trim().toLowerCase();
      if (!key) return;
      seen.set(key, [...(seen.get(key) ?? []), i]);
    });
    const dupes = new Set<number>();
    for (const idxs of seen.values()) {
      if (idxs.length > 1) idxs.forEach((i) => dupes.add(i));
    }
    return dupes;
  }, [entryNumbers]);

  const totalCount = useMemo(() => entryNumbers.filter((e) => e.trim() !== "").length, [entryNumbers]);

  const errorCount = results ? results.filter((r) => !r.valid).length : 0;
  const visibleIndexes = entryNumbers
    .map((val, i) => i)
    .filter((i) => {
      if (!errorsOnly || !results) return true;
      const r = statusFor(entryNumbers[i]);
      return r ? !r.valid : false;
    });

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div>
          <p className="field-label">Packet No.</p>
          <input
            className="field-input"
            value={packetNo}
            onChange={(e) => {
              setPacketNo(e.target.value);
              setResults(null);
            }}
            placeholder="e.g. 1080"
          />
        </div>
        <div>
          <p className="field-label">Gemstone</p>
          <SearchableSelect
            value={gemstone}
            onChange={(v) => {
              setGemstone(v);
              setResults(null);
            }}
            options={gemstones}
            placeholder="Search gemstone…"
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="field-label mb-0">
          Inventory ID <span className="text-slate font-normal">· Count: {totalCount}</span>
        </p>
        <div className="flex gap-4 items-center">
          {duplicateIndexes.size > 0 && (
            <span className="text-xs font-medium text-topaz">{duplicateIndexes.size} duplicate{duplicateIndexes.size > 1 ? "s" : ""}</span>
          )}
          {results && errorCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
              <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
              Errors only ({errorCount})
            </label>
          )}
          <button onClick={downloadTemplate} className="text-sapphire text-xs font-medium hover:underline">
            Download template
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="text-sapphire text-xs font-medium hover:underline">
            Upload CSV
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleCsvUpload}
          />
        </div>
      </div>

      {csvError && <p className="text-ruby text-xs mb-3">{csvError}</p>}

      <div className="space-y-2 mb-4">
        {visibleIndexes.map((i) => {
          const val = entryNumbers[i];
          const result = statusFor(val);
          const isDuplicate = !result && duplicateIndexes.has(i);
          return (
            <div key={i} className="flex gap-3 items-center">
              <span className="text-slate/60 font-mono text-xs w-6 text-right">{i + 1}</span>
              <input
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className={`field-input flex-1 ${
                  result ? (result.valid ? "border-emerald" : "border-ruby") : isDuplicate ? "border-topaz" : ""
                }`}
                value={val}
                onChange={(e) => updateEntry(i, e.target.value)}
                onKeyDown={(e) => handleRowKeyDown(e, i)}
                placeholder="Inventory ID"
              />
              {result ? (
                <span className={`text-xs font-mono w-56 ${result.valid ? "text-emerald" : "text-ruby"}`}>
                  {result.status}
                </span>
              ) : isDuplicate ? (
                <span className="text-xs font-mono w-56 text-topaz">Duplicate in this batch</span>
              ) : null}
              {entryNumbers.length > 1 && (
                <button
                  onClick={() => removeRow(i)}
                  className="text-slate hover:text-ruby text-sm px-1"
                  aria-label="Remove row"
                >
                  ✕
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex gap-3 mb-8">
        <button onClick={() => addRow(true)} className="btn-ghost">
          + Add entry
        </button>
        <button onClick={handleCheckAndSubmit} disabled={!canCheck || submitting} className="btn-primary">
          {submitting ? "Checking…" : "Check & Submit"}
        </button>
      </div>

      {submittedCount !== null && (
        <div className="card bg-emerald-light border-emerald/30 p-5">
          <p className="text-emerald font-mono">{submittedCount} entries recorded.</p>
        </div>
      )}

      {results && submittedCount === null && (
        <div className="card bg-ruby-light border-ruby/30 p-5">
          <p className="text-ruby">Fix the flagged rows above and check again — nothing was saved yet.</p>
        </div>
      )}
    </div>
  );
}
