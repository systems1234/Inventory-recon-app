"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import LotEntryForm from "./LotEntryForm";
import RecentEntriesPanel from "@/components/RecentEntriesPanel";

export default function LotEntryPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <main>
      <Navbar />
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
        <div className="flex items-center gap-2.5 mb-3">
          <span className="w-2 h-2 rounded-full bg-topaz" />
          <span className="text-topaz-dark text-sm font-medium">Batch-level reconciliation</span>
        </div>
        <h1 className="font-display font-semibold text-3xl text-ink mb-8 sm:mb-10">Lot Entry</h1>

        <div className="flex flex-col lg:flex-row gap-8 lg:gap-10">
          <div className="lg:max-w-lg w-full">
            <LotEntryForm onSaved={() => setRefreshKey((k) => k + 1)} />
          </div>
          <div className="flex-1 min-w-0">
            <RecentEntriesPanel
              title="Your recent lot entries"
              fetchUrl="/api/entries/lot/recent"
              refreshKey={refreshKey}
              columns={[
                { key: "lot_no", label: "Lot No." },
                { key: "location", label: "Location" },
                { key: "gemstone", label: "Gemstone" },
                { key: "no_of_pcs", label: "Pcs" },
                { key: "total_carat_ct", label: "Carat Ct" },
                { key: "submitted_at", label: "Submitted" }
              ]}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
