"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import Navbar from "@/components/Navbar";
import LotEntryForm from "./LotEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
import { recentMonths } from "@/lib/months";

interface Entry {
  lot_no: string;
  location: string;
  gemstone: string;
  no_of_pcs: number;
  total_carat_ct: number;
  submitted_by: string;
  submitted_at: string;
  [key: string]: unknown;
}

export default function LotEntryPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const [gemstoneFilter, setGemstoneFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const [lotNoFilter, setLotNoFilter] = useState("");

  function load(m?: string) {
    setLoading(true);
    const url = m ? `/api/entries/lot?month=${m}` : "/api/entries/lot";
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
      if (lotNoFilter && !e.lot_no?.toLowerCase().includes(lotNoFilter.toLowerCase())) return false;
      return true;
    });
  }, [entries, gemstoneFilter, locationFilter, lotNoFilter]);

  const columns = [
    { key: "lot_no", label: "Lot No." },
    { key: "location", label: "Location" },
    { key: "gemstone", label: "Gemstone" },
    { key: "no_of_pcs", label: "Pcs" },
    { key: "total_carat_ct", label: "Carat Ct" },
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
            <input
              type="text"
              placeholder="Filter lot no."
              className="field-input w-40 py-1.5 text-sm"
              value={lotNoFilter}
              onChange={(e) => setLotNoFilter(e.target.value)}
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
            resetSignal={`${month}|${gemstoneFilter}|${locationFilter}|${lotNoFilter}`}
          />
        </div>
      </div>

      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title="New Lot Entry">
        <LotEntryForm
          onSaved={() => {
            setFormOpen(false);
            load(month);
          }}
        />
      </SlideOver>
    </main>
  );
}
