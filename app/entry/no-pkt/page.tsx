"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import NoPktEntryForm from "./NoPktEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
import MultiSelect from "@/components/MultiSelect";
import { recentMonths } from "@/lib/months";

interface Entry {
  entry_number: string;
  location: string;
  gemstone: string;
  submitted_by: string;
  submitted_at: string;
  [key: string]: unknown;
}

export default function NoPktEntryPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const [gemstoneOptions, setGemstoneOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [gemstoneFilter, setGemstoneFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);

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
    const url = m ? `/api/entries/no-pkt?month=${m}` : "/api/entries/no-pkt";
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
      if (gemstoneFilter.length > 0 && !gemstoneFilter.includes(e.gemstone)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(e.location)) return false;
      return true;
    });
  }, [entries, gemstoneFilter, locationFilter]);

  const columns = [
    { key: "entry_number", label: "Entry No." },
    { key: "location", label: "Location" },
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
            <MultiSelect label="Gemstone" options={gemstoneOptions} selected={gemstoneFilter} onChange={setGemstoneFilter} />
            <MultiSelect label="Location" options={locationOptions} selected={locationFilter} onChange={setLocationFilter} />
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
            resetSignal={`${month}|${gemstoneFilter.join(",")}|${locationFilter.join(",")}`}
          />
        </div>
      </div>

      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title="New Entry (No Pkt No.)">
        <NoPktEntryForm
          onSaved={() => {
            setFormOpen(false);
            load(month);
          }}
        />
      </SlideOver>
    </main>
  );
}
