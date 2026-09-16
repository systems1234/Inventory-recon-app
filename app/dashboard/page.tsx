"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Navbar from "@/components/Navbar";
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
    <main>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
          <p className="text-slate text-sm">{monthLabel || "This month"}</p>
          <select
            className="field-input w-auto py-1.5 text-sm"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <h1 className="font-display font-semibold text-3xl text-ink mb-10">Your reconciliation progress</h1>

        <div className="grid grid-cols-3 gap-4 mb-10">
          <div className="card border-t-2 border-t-sapphire p-6">
            <p className="field-label">Normal entries</p>
            <p className="font-mono text-4xl text-ink">{summary?.normalCount ?? "—"}</p>
          </div>
          <div className="card border-t-2 border-t-topaz p-6">
            <p className="field-label">Lot entries</p>
            <p className="font-mono text-4xl text-ink">{summary?.lotCount ?? "—"}</p>
          </div>
          <div className="card border-t-2 border-t-amethyst p-6">
            <p className="field-label">No Pkt No. entries</p>
            <p className="font-mono text-4xl text-ink">{summary?.noPktCount ?? "—"}</p>
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
      </div>
    </main>
  );
}
