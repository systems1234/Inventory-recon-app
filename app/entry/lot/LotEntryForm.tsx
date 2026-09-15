"use client";

import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

export default function LotEntryForm({ onSaved }: { onSaved?: () => void }) {
  const [gemstones, setGemstones] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);

  const [location, setLocation] = useState("");
  const [gemstone, setGemstone] = useState("");
  const [lotNo, setLotNo] = useState("");
  const [pcs, setPcs] = useState("");
  const [totalCaratCt, setTotalCaratCt] = useState("");
  const [comments, setComments] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    fetch("/api/criteria")
      .then((r) => r.json())
      .then((data) => {
        setGemstones(data.gemstones ?? []);
        setLocations(data.locations ?? []);
      });
  }, []);

  function resetForm() {
    setLotNo("");
    setPcs("");
    setTotalCaratCt("");
    setComments("");
  }

  async function handleSubmit() {
    setSubmitting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/entries/lot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lot_no: lotNo,
          no_of_pcs: Number(pcs),
          total_carat_ct: Number(totalCaratCt),
          comments: comments || undefined,
          location,
          gemstone
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error ?? "Something went wrong" });
      } else {
        setMessage({ type: "success", text: `Lot ${lotNo} recorded.` });
        resetForm();
        onSaved?.();
      }
    } finally {
      setSubmitting(false);
    }
  }

  const canSubmit = location && gemstone && lotNo && pcs && totalCaratCt;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <p className="field-label">Location</p>
          <SearchableSelect value={location} onChange={setLocation} options={locations} placeholder="Search location…" />
        </div>
        <div>
          <p className="field-label">Gemstone</p>
          <SearchableSelect value={gemstone} onChange={setGemstone} options={gemstones} placeholder="Search gemstone…" />
        </div>
        <div>
          <p className="field-label">Lot No.</p>
          <input className="field-input" value={lotNo} onChange={(e) => setLotNo(e.target.value)} placeholder="e.g. #324" />
        </div>
        <div>
          <p className="field-label">No. of Pcs</p>
          <input type="number" className="field-input" value={pcs} onChange={(e) => setPcs(e.target.value)} />
        </div>
        <div>
          <p className="field-label">Total Carat Ct</p>
          <input
            type="number"
            step="0.01"
            className="field-input"
            value={totalCaratCt}
            onChange={(e) => setTotalCaratCt(e.target.value)}
          />
        </div>
      </div>
      <div className="mb-8">
        <p className="field-label">Comments</p>
        <textarea className="field-input" rows={3} value={comments} onChange={(e) => setComments(e.target.value)} />
      </div>

      <button onClick={handleSubmit} disabled={!canSubmit || submitting} className="btn-primary">
        {submitting ? "Submitting…" : "Submit"}
      </button>

      {message && (
        <p className={`mt-5 text-sm font-mono ${message.type === "error" ? "text-ruby" : "text-emerald"}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}
