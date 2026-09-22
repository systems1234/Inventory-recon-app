"use client";

import { useState } from "react";

interface AddOptionButtonProps {
  label: string;
  endpoint: string;
  /** Called with the newly-added name so the caller can refresh its options list and select it. */
  onAdded: (name: string) => void;
}

/**
 * Explicit "+ Add" button for fields backed by the locations/gemstones
 * tables. SearchableSelect already offers an inline "+ Add" row when a
 * typed value doesn't match anything, but that's easy to miss — this gives
 * users a visible, always-there way to insert a new location or gemstone
 * straight from the entry forms.
 */
export default function AddOptionButton({ label, endpoint, onAdded }: AddOptionButtonProps) {
  const [adding, setAdding] = useState(false);

  async function handleClick() {
    const name = window.prompt(`New ${label.toLowerCase()} name:`)?.trim();
    if (!name) return;
    setAdding(true);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await res.json();
      if (!res.ok) {
        window.alert(data.error ?? `Couldn't add that ${label.toLowerCase()}`);
        return;
      }
      onAdded(name);
    } finally {
      setAdding(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={adding}
      className="text-sapphire text-xs font-medium hover:underline"
      title={`Add a new ${label.toLowerCase()}`}
    >
      {adding ? "Adding…" : `+ Add ${label.toLowerCase()}`}
    </button>
  );
}
