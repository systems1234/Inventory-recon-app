"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import NormalEntryForm from "./NormalEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
import MultiSelect from "@/components/MultiSelect";
import { recentMonths } from "@/lib/months";
import { unwrap } from "@/lib/format";

interface Entry {
  entry_number: string;
  packet_no: string;
  gemstone: string;
  submitted_by: string;
  submitted_at: string;
  [key: string]: unknown;
}

export default function NormalEntryPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const [gemstoneOptions, setGemstoneOptions] = useState<string[]>([]);
  const [dateFilter, setDateFilter] = useState("");
  const [gemstoneFilter, setGemstoneFilter] = useState<string[]>([]);
  const [entryNoFilter, setEntryNoFilter] = useState("");

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

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (dateFilter && !unwrap(e.submitted_at).startsWith(dateFilter)) return false;
      if (gemstoneFilter.length > 0 && !gemstoneFilter.includes(e.gemstone)) return false;
      if (entryNoFilter && !e.entry_number?.toLowerCase().includes(entryNoFilter.toLowerCase())) return false;
      return true;
    });
  }, [entries, dateFilter, gemstoneFilter, entryNoFilter]);

  const columns = [
    { key: "entry_number", label: "Entry No." },
    { key: "packet_no", label: "Packet No." },
    { key: "gemstone", label: "Gemstone" },
    ...(isAdmin ? [{ key: "submitted_by", label: "Submitted By" }] : []),
    { key: "submitted_at", label: "Submitted" }
  ];

  return (
    <main className="h-screen flex flex-col overflow-hidden">
      <Navbar />
      <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-6 py-4 max-w-[1600px] w-full mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <select className="field-input w-auto py-1.5 text-sm" value={month} onChange={(e) => setMonth(e.target.value)}>
              {months.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
            <input
              type="date"
              className="field-input w-auto py-1.5 text-sm"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              title="Filter by submitted date"
            />
            <MultiSelect label="Gemstone" options={gemstoneOptions} selected={gemstoneFilter} onChange={setGemstoneFilter} />
            <input
              type="text"
              placeholder="Filter entry no."
              className="field-input w-40 py-1.5 text-sm"
              value={entryNoFilter}
              onChange={(e) => setEntryNoFilter(e.target.value)}
            />
          </div>
          <button onClick={() => setFormOpen(true)} className="btn-primary whitespace-nowrap">
            + New
          </button>
        </div>

        <div className="flex-1 min-h-0">
          <EntriesTable
            rows={filtered}
            columns={columns}
            loading={loading}
            resetSignal={`${month}|${dateFilter}|${gemstoneFilter.join(",")}|${entryNoFilter}`}
          />
        </div>
      </div>

      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title="New Normal Entry">
        <NormalEntryForm
          onSaved={() => {
            setFormOpen(false);
            load(month);
          }}
        />
      </SlideOver>
    </main>
  );
}
