"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import LotEntryForm from "./LotEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
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

/**
 * Personal view: only the current user's own submissions, no filters beyond
 * month. The full table with gemstone/location/submitted-by filters lives
 * at /entry/lot/all.
 */
export default function LotEntryPage() {
  const { data: session } = useSession();
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

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

  const myEntries = useMemo(
    () => entries.filter((e) => unwrap(e.submitted_by) === session?.user?.email),
    [entries, session?.user?.email]
  );

  const columns = [
    { key: "lot_no", label: "Lot No." },
    { key: "location", label: "Location" },
    { key: "gemstone", label: "Gemstone" },
    { key: "no_of_pcs", label: "Pcs" },
    { key: "total_carat_ct", label: "Carat Ct" },
    { key: "submitted_at", label: "Submitted" }
  ];

  function handleExport() {
    downloadCsv(`lot-entry_${month}.csv`, columns, myEntries);
  }

  return (
    <AppShell
      pageTitle="Lot Entry"
      pageEyebrow="Your submissions"
      topbarActions={
        <>
          <select className="filter-select" value={month} onChange={(e) => setMonth(e.target.value)}>
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <button onClick={handleExport} disabled={myEntries.length === 0} className="btn-secondary btn-sm">
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
        <EntriesTable rows={myEntries} columns={columns} loading={loading} resetSignal={month} />
      </div>

      <SlideOver
        open={formOpen}
        onClose={() => {
          setFormDirty(false);
          setFormOpen(false);
        }}
        confirmClose={formDirty}
        title="New Lot Entry"
      >
        <LotEntryForm
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
