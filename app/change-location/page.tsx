"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import SearchableSelect from "@/components/SearchableSelect";
import EntriesTable from "@/components/EntriesTable";
import { formatDateTime } from "@/lib/format";
import { canChangeLocation } from "@/lib/roles";

const columns = [
  { key: "entry_number", label: "Inventory ID" },
  { key: "old_location", label: "Old Location" },
  { key: "new_location", label: "New Location" },
  { key: "changed_by", label: "Changed By" },
  { key: "changed_at", label: "Changed" }
];

export default function ChangeLocationPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const allowed = canChangeLocation(role);

  const [locations, setLocations] = useState<string[]>([]);
  const [entryNumber, setEntryNumber] = useState("");
  const [location, setLocation] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [changes, setChanges] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  function loadChanges() {
    setLoading(true);
    fetch("/api/entries/no-pkt/change-location")
      .then((r) => r.json())
      .then((data) => setChanges((data.changes ?? []).map((c: any) => ({ ...c, changed_at: formatDateTime(c.changed_at) }))))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((data) => setLocations(data.locations ?? []));
    loadChanges();
  }, [allowed]);

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/entries/no-pkt/change-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entry_number: entryNumber, location })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Something went wrong" });
        return;
      }
      setMessage({
        type: "success",
        text: `${data.entry_number}: ${data.old_location ?? "(none)"} → ${data.new_location}`
      });
      setEntryNumber("");
      setLocation("");
      loadChanges();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell pageTitle="Change Location" pageEyebrow="Correct a wrong location">
      {status === "loading" ? (
        <div className="empty-state">Loading…</div>
      ) : !allowed ? (
        <div className="empty-state">
          <div className="es-title">No access</div>
          <div className="es-sub">Only Admin, Senior, Manager and TL accounts can change locations.</div>
        </div>
      ) : (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="card p-5 mb-4 shrink-0" style={{ maxWidth: 560 }}>
            <p className="text-slate text-sm mb-4">
              Overwrites the location of an inventory ID submitted this month under &quot;No Pkt No.&quot;. Every change is logged below.
            </p>
            <div className="mb-4">
              <p className="field-label">Inventory ID</p>
              <input
                className="field-input"
                inputMode="numeric"
                value={entryNumber}
                onChange={(e) => {
                  setEntryNumber(e.target.value.replace(/\D/g, ""));
                  setMessage(null);
                }}
                placeholder="e.g. 100105366"
              />
            </div>
            <div className="mb-4">
              <p className="field-label">New Location</p>
              <SearchableSelect
                value={location}
                onChange={(v) => {
                  setLocation(v);
                  setMessage(null);
                }}
                options={locations}
                placeholder="Search location…"
              />
            </div>
            <button
              className="btn-primary"
              disabled={!entryNumber || !location || submitting}
              onClick={handleSubmit}
            >
              {submitting ? "Saving…" : "Submit"}
            </button>
            {message && (
              <p className={`text-sm mt-3 ${message.type === "error" ? "text-ruby" : "text-emerald"}`}>{message.text}</p>
            )}
          </div>

          <p className="field-label shrink-0">Recent changes</p>
          <div className="flex-1 min-h-0 flex flex-col">
            <EntriesTable rows={changes} columns={columns} loading={loading} />
          </div>
        </div>
      )}
    </AppShell>
  );
}
