"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { recentMonths } from "@/lib/months";

interface Summary {
  reconMonth: string;
  normalCount: number;
  lotCount: number;
  noPktCount: number;
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const months = useMemo(() => recentMonths(), []);

  useEffect(() => {
    const url = selectedMonth ? `/api/summary?month=${selectedMonth}` : "/api/summary";
    setSummary(null);
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        setSummary(data);
        if (!selectedMonth) setSelectedMonth(data.reconMonth);
      });
  }, [selectedMonth]);

  const monthLabel = summary
    ? new Date(summary.reconMonth).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  return (
    <AppShell
      pageTitle="Your reconciliation progress"
      pageEyebrow={monthLabel || "This month"}
      topbarActions={
        <select className="filter-select" value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </select>
      }
    >
      <div className="stat-grid mb-6">
        <div className="stat-card" style={{ borderTop: "2px solid var(--ink)" }}>
          <p className="stat-label">Normal entries</p>
          <p className="stat-value">{summary?.normalCount ?? "—"}</p>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid var(--s-delay)" }}>
          <p className="stat-label">Lot entries</p>
          <p className="stat-value">{summary?.lotCount ?? "—"}</p>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid var(--s-blocked)" }}>
          <p className="stat-label">No Pkt No. entries</p>
          <p className="stat-value">{summary?.noPktCount ?? "—"}</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Link href="/entry/normal" className="btn-primary">
          New normal entry
        </Link>
        <Link href="/entry/lot" className="btn-ghost">
          New lot entry
        </Link>
        <Link href="/entry/no-pkt" className="btn-ghost">
          New no-pkt entry
        </Link>
      </div>
    </AppShell>
  );
}
