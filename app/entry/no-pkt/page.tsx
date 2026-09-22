"use client";

import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import NoPktEntryForm from "./NoPktEntryForm";
import SlideOver from "@/components/SlideOver";
import EntriesTable from "@/components/EntriesTable";
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

/**
 * Personal view: only the current user's own submissions, no filters beyond
 * month. The full table with gemstone/location/submitted-by filters lives
 * at /entry/no-pkt/all.
 */
export default function NoPktEntryPage() {
  const { data: session } = useSession();
  const months = useMemo(() => recentMonths(), []);

  const [month, setMonth] = useState("");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirty, setFormDirty] = useState(false);

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

  const myEntries = useMemo(
    () => entries.filter((e) => unwrap(e.submitted_by) === session?.user?.email),
    [entries, session?.user?.email]
  );

  const columns = [
    { key: "entry_number", label: "Inventory ID" },
    { key: "location", label: "Location" },
    { key: "gemstone", label: "Gemstone" },
    { key: "submitted_at", label: "Submitted" }
  ];

  function handleExport() {
    downloadCsv(`no-pkt-entry_${month}.csv`, columns, myEntries);
  }

  return (
    <AppShell
      pageTitle="Entry where no Pkt No."
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
