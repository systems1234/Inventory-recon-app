"use client";

import { useEffect, useMemo, useState } from "react";
import Navbar from "@/components/Navbar";
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
    <main>
      <Navbar />
      <div className="max-w-4xl mx-auto px-6 py-12">
        <div className="flex items-center justify-between gap-4 mb-2 flex-wrap">
          <p className="text-slate text-sm">{monthLabel || "This month"}</p>
          <select
            className="field-input w-auto py-1.5 text-sm"
            value={reconMonth}
            onChange={(e) => setReconMonth(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <h1 className="font-display font-semibold text-3xl text-ink mb-10">Team progress</h1>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line text-left bg-paper">
                <th className="field-label px-5 py-3 mb-0">Member</th>
                <th className="field-label px-5 py-3 mb-0 text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end w-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-sapphire" /> Normal
                  </span>
                </th>
                <th className="field-label px-5 py-3 mb-0 text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end w-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-topaz" /> Lot
                  </span>
                </th>
                <th className="field-label px-5 py-3 mb-0 text-right">
                  <span className="inline-flex items-center gap-1.5 justify-end w-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-amethyst" /> No Pkt No.
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {members?.map((m, i) => (
                <tr key={m.user_id} className={`border-b border-line last:border-0 ${i % 2 === 1 ? "bg-paper/60" : ""}`}>
                  <td className="px-5 py-3 text-ink">{m.name}</td>
                  <td className="px-5 py-3 text-right font-mono text-ink">{m.normal_count}</td>
                  <td className="px-5 py-3 text-right font-mono text-ink">{m.lot_count}</td>
                  <td className="px-5 py-3 text-right font-mono text-ink">{m.no_pkt_count}</td>
                </tr>
              ))}
              {members?.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate">
                    No active members yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
