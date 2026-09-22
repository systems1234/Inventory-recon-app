"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import LotEntryForm from "../LotEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
import MultiSelect from "@/components/MultiSelect";
import { recentMonths } from "@/lib/months";
import { unwrap, downloadCsv } from "@/lib/format";

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

export default function LotEntryAllPage() {
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
  const [lotNoFilter, setLotNoFilter] = useState("");
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

  const submittedByOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => unwrap(e.submitted_by)).filter(Boolean))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (gemstoneFilter.length > 0 && !gemstoneFilter.includes(e.gemstone)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(e.location)) return false;
      if (lotNoFilter && !e.lot_no?.toLowerCase().includes(lotNoFilter.toLowerCase())) return false;
      if (submittedByFilter.length > 0 && !submittedByFilter.includes(unwrap(e.submitted_by))) return false;
      return true;
    });
  }, [entries, gemstoneFilter, locationFilter, lotNoFilter, submittedByFilter]);

  const columns = [
    { key: "lot_no", label: "Lot No." },
    { key: "location", label: "Location" },
    { key: "gemstone", label: "Gemstone" },
    { key: "no_of_pcs", label: "Pcs" },
    { key: "total_carat_ct", label: "Carat Ct" },
    ...(isAdmin ? [{ key: "submitted_by", label: "Submitted By" }] : []),
    { key: "submitted_at", label: "Submitted" }
  ];

  function handleExport() {
    downloadCsv(`lot-entry-all_${month}.csv`, columns, filtered);
  }

  return (
    <AppShell
      pageTitle="Lot Entry — All Records"
      pageEyebrow="Batch-level reconciliation"
      topbarActions={
        <>
          <select className="filter-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <MultiSelect label="Gemstone" options={gemstoneOptions} selected={gemstoneFilter} onChange={setGemstoneFilter} />
          <MultiSelect label="Location" options={locationOptions} selected={locationFilter} onChange={setLocationFilter} />
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
            placeholder="Filter lot no."
            className="filter-search"
            value={lotNoFilter}
            onChange={(e) => setLotNoFilter(e.target.value)}
          />
          <button onClick={handleExport} disabled={filtered.length === 0} className="btn-secondary btn-sm">
            Export CSV
          </button>
          <button onClick={() => setFormOpen(true)} className="btn-primary whitespace-nowrap">
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
          resetSignal={`${month}|${gemstoneFilter.join(",")}|${locationFilter.join(",")}|${lotNoFilter}|${submittedByFilter.join(",")}`}
        />
      </div>

      <SlideOver open={formOpen} onClose={() => setFormOpen(false)} title="New Lot Entry">
        <LotEntryForm
          onSaved={() => {
            setFormOpen(false);
            load(month);
          }}
        />
      </SlideOver>
    </AppShell>
  );
}
