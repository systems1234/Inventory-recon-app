"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import NormalEntryForm from "../NormalEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
import MultiSelect from "@/components/MultiSelect";
import { recentMonths } from "@/lib/months";
import { unwrap, downloadCsv } from "@/lib/format";

interface Entry {
  entry_number: string;
  packet_no: string;
  gemstone: string;
  submitted_by: string;
  submitted_at: string;
  [key: string]: unknown;
}

export default function NormalEntryAllPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  const [gemstoneOptions, setGemstoneOptions] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [gemstoneFilter, setGemstoneFilter] = useState<string[]>([]);
  const [entryNoFilter, setEntryNoFilter] = useState("");
  const [submittedByFilter, setSubmittedByFilter] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((data) => setGemstoneOptions(data.gemstones ?? []));
  }, []);

  function load(m?: string) {
    setLoading(true);
    const url = m ? `/api/entries/normal?month=${m}` : "/api/entries/normal";
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
      if (dateFilter && !unwrap(e.submitted_at).startsWith(dateFilter)) return false;
      if (gemstoneFilter.length > 0 && !gemstoneFilter.includes(e.gemstone)) return false;
      if (entryNoFilter && !e.entry_number?.toLowerCase().includes(entryNoFilter.toLowerCase())) return false;
      if (submittedByFilter.length > 0 && !submittedByFilter.includes(unwrap(e.submitted_by))) return false;
      return true;
    });
  }, [entries, dateFilter, gemstoneFilter, entryNoFilter, submittedByFilter]);

  const columns = [
    { key: "entry_number", label: "Inventory ID" },
    { key: "packet_no", label: "Packet No." },
    { key: "gemstone", label: "Gemstone" },
    ...(isAdmin ? [{ key: "submitted_by", label: "Submitted By" }] : []),
    { key: "submitted_at", label: "Submitted" }
  ];

  function handleExport() {
    downloadCsv(`for-entry-all_${month}.csv`, columns, filtered);
  }

  return (
    <AppShell
      pageTitle="For Entry — All Records"
      pageEyebrow="Packet-level reconciliation"
      topbarActions={
        <>
          <select className="filter-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <input
            type="date"
            className="filter-select"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            title="Filter by submitted date"
          />
          <MultiSelect label="Gemstone" options={gemstoneOptions} selected={gemstoneFilter} onChange={setGemstoneFilter} />
          {isAdmin && (
            <MultiSelect
              label="Submitted By"
              options={submittedByOptions}
              selected={submittedByFilter}
              onChange={setSubmittedByFilter}
            />
          )}
          <input
            type="text"
            placeholder="Filter inventory ID"
            className="filter-search"
            value={entryNoFilter}
            onChange={(e) => setEntryNoFilter(e.target.value)}
          />
          <button onClick={handleExport} disabled={filtered.length === 0} className="btn-secondary btn-sm">
            Export CSV
          </button>
          <button
            onClick={() => {
              setFormDirty(false);
              setFormOpen(true);
            }}
            className="btn-primary whitespace-nowrap"
          >
            + New
          </button>
        </>
      }
    >
      <div className="h-full flex flex-col overflow-hidden">
        <EntriesTable
          rows={filtered}
          columns={columns}
          loading={loading}
          resetSignal={`${month}|${dateFilter}|${gemstoneFilter.join(",")}|${entryNoFilter}|${submittedByFilter.join(",")}`}
        />
      </div>

      <SlideOver
        open={formOpen}
        onClose={() => {
          setFormDirty(false);
          setFormOpen(false);
        }}
        confirmClose={formDirty}
        title="New For Entry"
      >
        <NormalEntryForm
          onDirtyChange={setFormDirty}
          onSaved={() => {
            setFormDirty(false);
            setFormOpen(false);
            load(month);
          }}
        />
      </SlideOver>
    </AppShell>
  );
}
