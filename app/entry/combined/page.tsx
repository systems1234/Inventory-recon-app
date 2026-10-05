"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import EntriesTable from "@/components/EntriesTable";
import MultiSelect from "@/components/MultiSelect";
import { recentMonths } from "@/lib/months";
import { unwrap, downloadCsv } from "@/lib/format";

interface Entry {
  entry_number: string;
  packet_no: string | null;
  location: string | null;
  gemstone: string;
  submitted_by: string;
  submitted_at: string;
  source: "For Entry" | "No Pkt No.";
  [key: string]: unknown;
}

/**
 * For Entry (normal_entries) and No Pkt No. (no_pkt_entries) are identical
 * apart from packet_no vs location -- this merges both so an inventory ID
 * can be found in one search instead of checking two separate views.
 */
export default function CombinedEntryPage() {
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);

  const [gemstoneOptions, setGemstoneOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [gemstoneFilter, setGemstoneFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<string[]>([]);
  const [entryNoFilter, setEntryNoFilter] = useState("");
  const [submittedByFilter, setSubmittedByFilter] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((data) => {
        setGemstoneOptions(data.gemstones ?? []);
        setLocationOptions(data.locations ?? []);
      });
  }, []);

  function load(m?: string) {
    setLoading(true);
    const url = m ? `/api/entries/combined?month=${m}` : "/api/entries/combined";
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.entries ?? []);
        if (!m && data.reconMonth) setMonth(data.reconMonth);
      })
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (month) load(month);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month]);

  const submittedByOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => unwrap(e.submitted_by)).filter(Boolean))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (gemstoneFilter.length > 0 && !gemstoneFilter.includes(e.gemstone)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(unwrap(e.location))) return false;
      if (sourceFilter.length > 0 && !sourceFilter.includes(e.source)) return false;
      if (entryNoFilter && !e.entry_number?.toLowerCase().includes(entryNoFilter.toLowerCase())) return false;
      if (submittedByFilter.length > 0 && !submittedByFilter.includes(unwrap(e.submitted_by))) return false;
      return true;
    });
  }, [entries, gemstoneFilter, locationFilter, sourceFilter, entryNoFilter, submittedByFilter]);

  const columns = [
    { key: "entry_number", label: "Inventory ID" },
    { key: "source", label: "Form" },
    { key: "packet_no", label: "Packet No." },
    { key: "location", label: "Location" },
    { key: "gemstone", label: "Gemstone" },
    { key: "submitted_by", label: "Submitted By" },
    { key: "submitted_at", label: "Submitted" }
  ];

  function handleExport() {
    downloadCsv(`for-entry-and-no-pkt_${month}.csv`, columns, filtered);
  }

  return (
    <AppShell
      pageTitle="For Entry + No Pkt No. — All Records"
      pageEyebrow="Search both tables in one place"
      topbarActions={
        <>
          <select className="filter-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <MultiSelect
            label="Form"
            options={["For Entry", "No Pkt No."]}
            selected={sourceFilter}
            onChange={setSourceFilter}
          />
          <MultiSelect label="Gemstone" options={gemstoneOptions} selected={gemstoneFilter} onChange={setGemstoneFilter} />
          <MultiSelect label="Location" options={locationOptions} selected={locationFilter} onChange={setLocationFilter} />
          <MultiSelect
            label="Submitted By"
            options={submittedByOptions}
            selected={submittedByFilter}
            onChange={setSubmittedByFilter}
          />
          <input
            type="text"
            placeholder="Search inventory ID"
            className="filter-search"
            value={entryNoFilter}
            onChange={(e) => setEntryNoFilter(e.target.value)}
          />
          <button onClick={handleExport} disabled={filtered.length === 0} className="btn-secondary btn-sm">
            Export CSV
          </button>
        </>
      }
    >
      <div className="h-full flex flex-col overflow-hidden">
        <EntriesTable
          rows={filtered}
          columns={columns}
          loading={loading}
          resetSignal={`${month}|${gemstoneFilter.join(",")}|${locationFilter.join(",")}|${sourceFilter.join(",")}|${entryNoFilter}|${submittedByFilter.join(",")}`}
        />
      </div>
    </AppShell>
  );
}
