"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import AppShell from "@/components/AppShell";
import AddOptionButton from "@/components/AddOptionButton";
import EntriesTable from "@/components/EntriesTable";
import { formatDateTime } from "@/lib/format";

interface LocationRow {
  name: string;
  is_active: boolean;
  added_by: string;
  added_at: string;
  [key: string]: unknown;
}

export default function LocationsPage() {
  const { data: session } = useSession();
  const role = (session?.user as any)?.role ?? "member";
  const canManage = role === "admin" || role === "senior";

  const [rows, setRows] = useState<LocationRow[]>([]);
  const [loading, setLoading] = useState(true);

  function load() {
    setLoading(true);
    fetch("/api/locations?full=1")
      .then((r) => r.json())
      .then((data) => setRows(data.locations ?? []))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
  }, []);

  const displayRows = rows.map((r) => ({
    ...r,
    added_at: formatDateTime(r.added_at),
    status: r.is_active ? "Active" : "Inactive"
  }));

  const columns = [
    { key: "name", label: "Location" },
    { key: "status", label: "Status" },
    { key: "added_by", label: "Added By" },
    { key: "added_at", label: "Added" }
  ];

  return (
    <AppShell
      pageTitle="Locations"
      pageEyebrow="Reference data"
      topbarActions={
        canManage ? <AddOptionButton label="Location" endpoint="/api/locations" onAdded={() => load()} /> : undefined
      }
    >
      <div className="h-full flex flex-col overflow-hidden">
        <EntriesTable rows={displayRows} columns={columns} loading={loading} />
      </div>
    </AppShell>
  );
}
