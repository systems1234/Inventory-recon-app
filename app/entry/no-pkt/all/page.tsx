"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import NoPktEntryForm from "../NoPktEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
import MultiSelect from "@/components/MultiSelect";
import { recentMonths } from "@/lib/months";
import { unwrap, downloadCsv } from "@/lib/format";

interface Entry {
  entry_number: string;
  location: string;
  gemstone: string;
  submitted_by: string;
  submitted_at: string;
  [key: string]: unknown;
}

export default function NoPktEntryAllPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as any)?.role === "admin";
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

  const [gemstoneOptions, setGemstoneOptions] = useState<string[]>([]);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [gemstoneFilter, setGemstoneFilter] = useState<string[]>([]);
  const [locationFilter, setLocationFilter] = useState<string[]>([]);
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

  const submittedByOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => unwrap(e.submitted_by)).filter(Boolean))).sort(),
    [entries]
  );

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (gemstoneFilter.length > 0 && !gemstoneFilter.includes(e.gemstone)) return false;
      if (locationFilter.length > 0 && !locationFilter.includes(e.location)) return false;
      if (submittedByFilter.length > 0 && !submittedByFilter.includes(unwrap(e.submitted_by))) return false;
      return true;
    });
  }, [entries, gemstoneFilter, locationFilter, submittedByFilter]);

  const columns = [
    { key: "entry_number", label: "Inventory ID" },
    { key: "location", label: "Location" },
    { key: "gemstone", label: "Gemstone" },
    ...(isAdmin ? [{ key: "submitted_by", label: "Submitted By" }] : []),
    { key: "submitted_at", label: "Submitted" }
  ];

  function handleExport() {
    downloadCsv(`no-pkt-entry-all_${month}.csv`, columns, filtered);
  }

  return (
    <AppShell
      pageTitle="Entry where no Pkt No. — All Records"
      pageEyebrow="For items with no known packet"
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
          resetSignal={`${month}|${gemstoneFilter.join(",")}|${locationFilter.join(",")}|${submittedByFilter.join(",")}`}
        />
      </div>

      <SlideOver
        open={formOpen}
        onClose={() => {
          setFormDirty(false);
          setFormOpen(false);
        }}
        confirmClose={formDirty}
        title="New Entry (No Pkt No.)"
      >
        <NoPktEntryForm
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
