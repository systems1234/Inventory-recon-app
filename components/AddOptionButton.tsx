"use client";

import { useEffect, useState } from "react";

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
 * straight from the entry forms, via a proper modal instead of the
 * browser's native prompt()/alert().
 */
export default function AddOptionButton({ label, endpoint, onAdded }: AddOptionButtonProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function openModal() {
    setName("");
    setError(null);
    setOpen(true);
  }

  async function handleAdd() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Couldn't add that ${label.toLowerCase()}`);
        return;
      }
      onAdded(trimmed);
      setOpen(false);
    } finally {
      setAdding(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openModal}
        className="text-sapphire text-xs font-medium hover:underline"
        title={`Add a new ${label.toLowerCase()}`}
      >
        {`+ Add ${label.toLowerCase()}`}
      </button>

      {open && (
        <div className="modal-overlay" onClick={() => !adding && setOpen(false)}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Add {label.toLowerCase()}</div>
              <button onClick={() => setOpen(false)} className="modal-close" aria-label="Close">
                ×
              </button>
            </div>
            <div className="modal-body">
              <p className="field-label">{label} name</p>
              <input
                autoFocus
                className="field-input"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
                onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                placeholder={`e.g. ${label === "Location" ? "Vault 2" : "Ruby"}`}
              />
              {error && <p className="text-ruby text-xs mt-2">{error}</p>}
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setOpen(false)} disabled={adding}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleAdd} disabled={adding || !name.trim()}>
                {adding ? "Adding…" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
