"use client";

import { useEffect, useMemo, useState } from "react";
import AppShell from "@/components/AppShell";
import { recentMonths } from "@/lib/months";

interface Member {
  user_id: string;
  name: string;
  normal_count: number;
  lot_count: number;
  no_pkt_count: number;
}

export default function AdminDashboardPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [reconMonth, setReconMonth] = useState("");
  const months = useMemo(() => recentMonths(), []);

  useEffect(() => {
    const url = reconMonth ? `/api/summary/admin?month=${reconMonth}` : "/api/summary/admin";
    setMembers(null);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setMembers(data.members ?? []);
        if (!reconMonth) setReconMonth(data.reconMonth ?? "");
      });
  }, [reconMonth]);

  const monthLabel = reconMonth
    ? new Date(reconMonth).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  return (
    <AppShell
      pageTitle="Team progress"
      pageEyebrow={monthLabel || "This month"}
      topbarActions={
        <select className="filter-select" value={reconMonth} onChange={(e) => setReconMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      }
    >
      <div className="card overflow-hidden">
        <table className="cl-table">
          <thead>
            <tr>
              <th>Member</th>
              <th style={{ textAlign: "right" }}>Normal</th>
              <th style={{ textAlign: "right" }}>Lot</th>
              <th style={{ textAlign: "right" }}>No Pkt No.</th>
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.user_id}>
                <td className="cell-strong">{m.name}</td>
                <td className="cell-mono" style={{ textAlign: "right" }}>
                  {m.normal_count}
                </td>
                <td className="cell-mono" style={{ textAlign: "right" }}>
                  {m.lot_count}
                </td>
                <td className="cell-mono" style={{ textAlign: "right" }}>
                  {m.no_pkt_count}
                </td>
              </tr>
            ))}
            {members?.length === 0 && (
              <tr>
                <td colSpan={4} style={{ textAlign: "center", padding: "32px 0", color: "var(--g-500)" }}>
                  No active members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
