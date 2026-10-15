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

interface Coverage {
  total_items: number;
  verified_items: number;
  total_value: number;
  unverified_value: number;
}

const num = (n: number) => Number(n).toLocaleString("en-IN");
const pct = (part: number, whole: number) => (whole > 0 ? (part / whole) * 100 : 0);

export default function AdminDashboardPage() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [coverage, setCoverage] = useState<Coverage | null>(null);
  const [error, setError] = useState("");
  const [reconMonth, setReconMonth] = useState("");
  const months = useMemo(() => recentMonths(), []);

  useEffect(() => {
    const url = reconMonth ? `/api/summary/admin?month=${reconMonth}` : "/api/summary/admin";
    setMembers(null);
    setCoverage(null);
    setError("");
    fetch(url)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data.error ?? "Failed to load");
        setMembers(data.members ?? []);
        setCoverage(data.coverage ?? null);
        if (!reconMonth) setReconMonth(data.reconMonth ?? "");
      })
      .catch((e) => {
        setError(e.message);
        setMembers([]);
      });
  }, [reconMonth]);

  const monthLabel = reconMonth
    ? new Date(reconMonth).toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })
    : "";

  const verifiedPct = coverage ? pct(coverage.verified_items, coverage.total_items) : 0;
  const unverifiedItems = coverage ? coverage.total_items - coverage.verified_items : 0;
  const unverifiedValuePct = coverage ? pct(coverage.unverified_value, coverage.total_value) : 0;
  // Don't round 99.97% up to "100.0%" while items are still missing.
  const pctLabel = (p: number, done: boolean) => (done || p < 99.95 ? p.toFixed(1) : "99.9");

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
      {error && (
        <div className="card p-3 mb-4 bg-ruby-light border-ruby/30">
          <p className="text-ruby text-sm">{error}</p>
        </div>
      )}

      <div className="stat-grid mb-3">
        <div className="stat-card" style={{ borderTop: "2px solid var(--s-done)" }}>
          <p className="stat-label">Inventory verified</p>
          <p className="stat-value">{coverage ? `${pctLabel(verifiedPct, unverifiedItems === 0)}%` : "—"}</p>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid var(--ink)" }}>
          <p className="stat-label">Verified / Total items</p>
          <p className="stat-value" style={{ fontSize: 24 }}>
            {coverage ? `${num(coverage.verified_items)} / ${num(coverage.total_items)}` : "—"}
          </p>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid var(--s-delay)" }}>
          <p className="stat-label">Not verified (items)</p>
          <p className="stat-value">{coverage ? num(unverifiedItems) : "—"}</p>
        </div>
        <div className="stat-card" style={{ borderTop: "2px solid var(--s-overdue)" }}>
          <p className="stat-label">Not verified (value)</p>
          <p className="stat-value" style={{ fontSize: 24 }}>
            {coverage ? num(Math.round(coverage.unverified_value)) : "—"}
          </p>
          {coverage && (
            <p style={{ fontSize: 11.5, color: "var(--g-500)", marginTop: 6 }}>
              {unverifiedValuePct.toFixed(2)}% of total stock value
            </p>
          )}
        </div>
      </div>

      {coverage && (
        <div style={{ height: 8, borderRadius: 4, background: "var(--g-150)", overflow: "hidden", marginBottom: 6 }}>
          <div style={{ width: `${Math.min(100, verifiedPct)}%`, height: "100%", background: "var(--s-done)" }} />
        </div>
      )}
      <p style={{ fontSize: 11.5, color: "var(--g-500)", marginBottom: 24 }}>
        Based on IMS &quot;Instock - Loose&quot; inventory added up to the 5th of the month, matched against For Entry and
        No Pkt No. entries. Value uses Final_Formula_Based_Price.
      </p>

      <p className="field-label" style={{ marginBottom: 8 }}>
        Submitted by{members ? ` · ${members.length}` : ""}
      </p>
      <div className="card overflow-hidden">
        <table className="cl-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Name</th>
              <th style={{ textAlign: "right" }}>Normal</th>
              <th style={{ textAlign: "right" }}>Lot</th>
              <th style={{ textAlign: "right" }}>No Pkt No.</th>
              <th style={{ textAlign: "right" }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {members?.map((m) => (
              <tr key={m.user_id}>
                <td className="cell-strong">{m.user_id}</td>
                <td>{m.name !== m.user_id ? m.name : ""}</td>
                <td className="cell-mono" style={{ textAlign: "right" }}>
                  {num(m.normal_count)}
                </td>
                <td className="cell-mono" style={{ textAlign: "right" }}>
                  {num(m.lot_count)}
                </td>
                <td className="cell-mono" style={{ textAlign: "right" }}>
                  {num(m.no_pkt_count)}
                </td>
                <td className="cell-mono" style={{ textAlign: "right" }}>
                  {num(m.normal_count + m.lot_count + m.no_pkt_count)}
                </td>
              </tr>
            ))}
            {members?.length === 0 && (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", padding: "32px 0", color: "var(--g-500)" }}>
                  No submissions this month yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
