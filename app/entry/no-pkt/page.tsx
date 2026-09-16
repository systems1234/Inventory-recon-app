"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import NoPktEntryForm from "./NoPktEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
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

  const [gemstoneFilter, setGemstoneFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");

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
      if (gemstoneFilter && !e.gemstone?.toLowerCase().includes(gemstoneFilter.toLowerCase())) return false;
      if (locationFilter && !e.location?.toLowerCase().includes(locationFilter.toLowerCase())) return false;
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
    <main className="min-h-screen flex flex-col">
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
              type="text"
              placeholder="Filter gemstone"
              className="field-input w-40 py-1.5 text-sm"
              value={gemstoneFilter}
              onChange={(e) => setGemstoneFilter(e.target.value)}
            />
            <input
              type="text"
              placeholder="Filter location"
              className="field-input w-40 py-1.5 text-sm"
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
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
            resetSignal={`${month}|${gemstoneFilter}|${locationFilter}`}
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
