"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

interface RowResult {
  entry_number: string;
  status: string;
  valid: boolean;
}

/** Inventory IDs are always numeric — strip anything else as it's typed or pasted. */
function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

export default function NormalEntryForm({
  onSaved,
  onDirtyChange
}: {
  onSaved?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [gemstones, setGemstones] = useState<string[]>([]);
  const [packetNo, setPacketNo] = useState("");
  const [gemstone, setGemstone] = useState("");
  const [entryNumbers, setEntryNumbers] = useState<string[]>([""]);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const rowRefs = useRef<(HTMLInputElement | null)[]>([]);
  const focusIndexRef = useRef<number | null>(null);
  const duplicateWarningTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function showDuplicateWarning(message: string) {
    setDuplicateWarning(message);
    if (duplicateWarningTimer.current) clearTimeout(duplicateWarningTimer.current);
    duplicateWarningTimer.current = setTimeout(() => setDuplicateWarning(null), 3000);
  }

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

  useEffect(() => {
    const dirty = packetNo.trim() !== "" || gemstone !== "" || entryNumbers.some((e) => e.trim() !== "");
    onDirtyChange?.(dirty);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [packetNo, gemstone, entryNumbers]);

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

      const numeric = lines.map(digitsOnly).filter((l) => l !== "");

      if (numeric.length === 0) {
        setCsvError("That file had no numeric inventory IDs in it.");
        return;
      }

      const seen = new Set<string>();
      const deduped: string[] = [];
      let skipped = 0;
      for (const line of numeric) {
        if (seen.has(line)) {
          skipped++;
          continue;
        }
        seen.add(line);
        deduped.push(line);
      }
      if (skipped > 0) {
        showDuplicateWarning(
          skipped === 1 ? "1 duplicate was skipped — duplicates aren't allowed." : `${skipped} duplicates were skipped — duplicates aren't allowed.`
        );
      }

      setEntryNumbers(deduped);
      setResults(null);
      setSubmittedCount(null);
      setErrorsOnly(false);
    };
    reader.onerror = () => setCsvError("Couldn't read that file — try again.");
    reader.readAsText(file);

    // allow re-uploading the same filename later
    e.target.value = "";
  }

  /**
   * Inventory IDs are numeric-only (non-digits are silently dropped as you
   * type/paste) and duplicates are rejected the moment they'd repeat within
   * this batch, not just flagged.
   */
  function updateEntry(index: number, rawValue: string) {
    const value = digitsOnly(rawValue);
    const isDuplicate = value !== "" && entryNumbers.some((v, i) => i !== index && v === value);
    if (isDuplicate) {
      setEntryNumbers((prev) => prev.map((v, i) => (i === index ? "" : v)));
      showDuplicateWarning(`"${value}" is already in this batch — duplicates aren't allowed.`);
      setResults(null);
      setSubmittedCount(null);
      return;
    }
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
   * Enter just moves to the next field. A rejected duplicate clears the
   * field before this fires, so an empty row here means nothing was
   * actually accepted — stay put instead of spawning another blank row.
   */
  function handleRowKeyDown(e: React.KeyboardEvent<HTMLInputElement>, index: number) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (entryNumbers[index].trim() === "") return;
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
      <div className="sticky top-0 z-10 bg-white">
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

        <div className="flex items-center justify-between mb-3 pb-3 border-b border-line">
          <p className="field-label mb-0">
            Inventory ID <span className="text-slate font-normal">· Count: {totalCount}</span>
          </p>
          <div className="flex gap-4 items-center">
            {duplicateWarning && <span className="text-xs font-medium text-topaz">{duplicateWarning}</span>}
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
      </div>

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
                inputMode="numeric"
                pattern="[0-9]*"
                className={`field-input flex-1 ${result ? (result.valid ? "border-emerald" : "border-ruby") : ""}`}
                value={val}
                onChange={(e) => updateEntry(i, e.target.value)}
                onKeyDown={(e) => handleRowKeyDown(e, i)}
                placeholder="Inventory ID"
              />
              {result && (
                <span className={`text-xs font-mono w-56 ${result.valid ? "text-emerald" : "text-ruby"}`}>
                  {result.status}
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
