"use client";

import { useEffect, useRef, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import AddOptionButton from "@/components/AddOptionButton";

interface RowResult {
  entry_number: string;
  status: string;
  detail?: string;
  valid: boolean;
}

export default function NoPktEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [gemstones, setGemstones] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const [location, setLocation] = useState("");
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
      .then((data) => {
        setGemstones(data.gemstones ?? []);
        setLocations(data.locations ?? []);
      });
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
    a.download = "no-pkt-entry-template.csv";
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
   * focuses a new row automatically instead of requiring a manual
   * "+ Add entry" click after every single scan. On an earlier row, Enter
   * just moves to the next field.
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
      const res = await fetch("/api/entries/no-pkt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, gemstone, entry_numbers: cleanEntries })
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

  const canCheck = location && gemstone && entryNumbers.some((e) => e.trim() !== "");

  function statusFor(id: string): RowResult | undefined {
    return results?.find((r) => r.entry_number === id.trim());
  }

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
          <div className="flex items-center justify-between mb-1">
            <p className="field-label mb-0">Location</p>
            <AddOptionButton
              label="Location"
              endpoint="/api/locations"
              onAdded={(name) => {
                setLocations((prev) => [...prev, name].sort());
                setLocation(name);
                setResults(null);
              }}
            />
          </div>
          <SearchableSelect
            value={location}
            onChange={(v) => {
              setLocation(v);
              setResults(null);
            }}
            options={locations}
            placeholder="Search location…"
            addEndpoint="/api/locations"
            onAdded={(name) => setLocations((prev) => [...prev, name].sort())}
          />
        </div>
        <div>
          <div className="flex items-center justify-between mb-1">
            <p className="field-label mb-0">Gemstone</p>
            <AddOptionButton
              label="Gemstone"
              endpoint="/api/gemstones"
              onAdded={(name) => {
                setGemstones((prev) => [...prev, name].sort());
                setGemstone(name);
                setResults(null);
              }}
            />
          </div>
          <SearchableSelect
            value={gemstone}
            onChange={(v) => {
              setGemstone(v);
              setResults(null);
            }}
            options={gemstones}
            placeholder="Search gemstone…"
            addEndpoint="/api/gemstones"
            onAdded={(name) => setGemstones((prev) => [...prev, name].sort())}
          />
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <p className="field-label mb-0">Inventory ID</p>
        <div className="flex gap-4 items-center">
          {results && errorCount > 0 && (
            <label className="flex items-center gap-1.5 text-xs text-slate cursor-pointer">
              <input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />
              Errors only ({errorCount})
            </label>
          )}
          <button onClick={downloadTemplate} className="text-amethyst text-xs font-medium hover:underline">
            Download template
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="text-amethyst text-xs font-medium hover:underline">
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
          return (
            <div key={i} className="flex gap-3 items-center">
              <span className="text-slate/60 font-mono text-xs w-6 text-right">{i + 1}</span>
              <input
                ref={(el) => {
                  rowRefs.current[i] = el;
                }}
                className={`field-input flex-1 ${
                  result ? (result.valid ? "border-emerald" : "border-ruby") : ""
                }`}
                value={val}
                onChange={(e) => updateEntry(i, e.target.value)}
                onKeyDown={(e) => handleRowKeyDown(e, i)}
                placeholder="Inventory ID"
              />
              {result && (
                <span className={`text-xs font-mono w-64 ${result.valid ? "text-emerald" : "text-ruby"}`}>
                  {result.status}
                  {result.detail ? ` ${result.detail}` : ""}
                </span>
              )}
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
