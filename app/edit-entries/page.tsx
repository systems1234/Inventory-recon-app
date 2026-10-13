"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import SearchableSelect from "@/components/SearchableSelect";
import EntriesTable from "@/components/EntriesTable";
import { formatDateTime } from "@/lib/format";
import { canChangeLocation } from "@/lib/roles";

type Mode = "location" | "inventory";

const locationColumns = [
  { key: "entry_number", label: "Inventory ID" },
  { key: "old_location", label: "Old Location" },
  { key: "new_location", label: "New Location" },
  { key: "changed_by", label: "Changed By" },
  { key: "changed_at", label: "Changed" }
];

const inventoryColumns = [
  { key: "old_entry_number", label: "Wrong Inventory ID" },
  { key: "new_entry_number", label: "Correct Inventory ID" },
  { key: "source", label: "Form" },
  { key: "changed_by", label: "Changed By" },
  { key: "changed_at", label: "Changed" }
];

const digits = (v: string) => v.replace(/\D/g, "");

export default function EditEntriesPage() {
  const { data: session, status } = useSession();
  const role = (session?.user as any)?.role as string | undefined;
  const allowed = canChangeLocation(role);

  const [mode, setMode] = useState<Mode>("location");
  const [locations, setLocations] = useState<string[]>([]);

  const [entryNumber, setEntryNumber] = useState("");
  const [location, setLocation] = useState("");
  const [currentId, setCurrentId] = useState("");
  const [newId, setNewId] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [changes, setChanges] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  const endpoint = mode === "location" ? "/api/entries/no-pkt/change-location" : "/api/entries/change-inventory";

  function loadChanges(url: string) {
    setLoading(true);
    fetch(url)
      .then((r) => r.json())
      .then((data) => setChanges((data.changes ?? []).map((c: any) => ({ ...c, changed_at: formatDateTime(c.changed_at) }))))
      .catch(() => setChanges([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    if (!allowed) return;
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((data) => setLocations(data.locations ?? []));
  }, [allowed]);

  useEffect(() => {
    if (!allowed) return;
    setChanges([]);
    loadChanges(endpoint);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowed, mode]);

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setMessage(null);
  }

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);
    try {
      const body =
        mode === "location"
          ? { entry_number: entryNumber, location }
          : { current_id: currentId, new_id: newId };
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Something went wrong" });
        return;
      }
      if (mode === "location") {
        setMessage({ type: "success", text: `${data.entry_number}: ${data.old_location ?? "(none)"} → ${data.new_location}` });
        setEntryNumber("");
        setLocation("");
      } else {
        setMessage({ type: "success", text: `${data.current_id} → ${data.new_id} (${data.source})` });
        setCurrentId("");
        setNewId("");
      }
      loadChanges(endpoint);
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = mode === "location" ? !!entryNumber && !!location : !!currentId && !!newId;

  return (
    <AppShell pageTitle="Edit Entries" pageEyebrow="Correct a wrong location or inventory ID">
      {status === "loading" ? (
        <div className="empty-state">Loading…</div>
      ) : !allowed ? (
        <div className="empty-state">
          <div className="es-title">No access</div>
          <div className="es-sub">Only Admin, Senior, Manager and TL accounts can edit entries.</div>
        </div>
      ) : (
        <div className="h-full flex flex-col overflow-hidden">
          <div className="flex gap-2 mb-4 shrink-0">
            <button className={mode === "location" ? "btn-primary" : "btn-ghost"} onClick={() => switchMode("location")}>
              Change Location
            </button>
            <button className={mode === "inventory" ? "btn-primary" : "btn-ghost"} onClick={() => switchMode("inventory")}>
              Change Inventory ID
            </button>
          </div>

          <div className="card p-5 mb-4 shrink-0" style={{ maxWidth: 560 }}>
            {mode === "location" ? (
              <>
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
                      setEntryNumber(digits(e.target.value));
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
              </>
            ) : (
              <>
                <p className="text-slate text-sm mb-4">
                  Replaces a wrongly scanned Inventory ID in this month&apos;s For Entry or No Pkt No. entries. The correct ID must pass the
                  same checks as a normal submission. Every change is logged below.
                </p>
                <div className="mb-4">
                  <p className="field-label">Incorrectly Scanned Inventory ID</p>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={currentId}
                    onChange={(e) => {
                      setCurrentId(digits(e.target.value));
                      setMessage(null);
                    }}
                    placeholder="e.g. 10756"
                  />
                </div>
                <div className="mb-4">
                  <p className="field-label">Actual Inventory ID (as per database)</p>
                  <input
                    className="field-input"
                    inputMode="numeric"
                    value={newId}
                    onChange={(e) => {
                      setNewId(digits(e.target.value));
                      setMessage(null);
                    }}
                    placeholder="e.g. 107356"
                  />
                </div>
              </>
            )}
            <button className="btn-primary" disabled={!canSubmit || submitting} onClick={handleSubmit}>
              {submitting ? "Saving…" : "Submit"}
            </button>
            {message && (
              <p className={`text-sm mt-3 ${message.type === "error" ? "text-ruby" : "text-emerald"}`}>{message.text}</p>
            )}
          </div>

          <p className="field-label shrink-0">Recent changes</p>
          <div className="flex-1 min-h-0 flex flex-col">
            <EntriesTable
              rows={changes}
              columns={mode === "location" ? locationColumns : inventoryColumns}
              loading={loading}
              resetSignal={mode}
            />
          </div>
        </div>
      )}
    </AppShell>
  );
}
