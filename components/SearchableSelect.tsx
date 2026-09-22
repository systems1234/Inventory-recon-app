"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  /** POST { name } here to add a new option when nothing matches. Omit to disable. */
  addEndpoint?: string;
  /** Called with the newly-added name after a successful add, so the caller can refresh its options list. */
  onAdded?: (name: string) => void;
}

/**
 * Text input + filtered dropdown, for fields backed by hundreds of flat
 * options (gemstone, location) where a native <select> forces scrolling
 * through the whole list to find anything. Type to filter, click or
 * Enter to pick, Escape or click-outside to close without changing the
 * selection. With addEndpoint set, typing a name that doesn't exist yet
 * offers an "Add" option that saves it as a new option.
 */
export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Search…",
  addEndpoint,
  onAdded
}: SearchableSelectProps) {
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Keep the visible text in sync when the selection changes from outside
  // (e.g. form reset after submit).
  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery(value);
        setAddError(null);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q === "" || q === value.toLowerCase()) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query, value]);

  const trimmedQuery = query.trim();
  const exactMatch = options.some((o) => o.toLowerCase() === trimmedQuery.toLowerCase());
  const canOfferAdd = !!addEndpoint && trimmedQuery !== "" && !exactMatch;

  function select(opt: string) {
    onChange(opt);
    setQuery(opt);
    setOpen(false);
    setAddError(null);
  }

  async function handleAdd() {
    if (!addEndpoint || !trimmedQuery) return;
    setAdding(true);
    setAddError(null);
    try {
      const res = await fetch(addEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedQuery })
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error ?? "Couldn't add that");
        return;
      }
      onAdded?.(trimmedQuery);
      select(trimmedQuery);
    } finally {
      setAdding(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlight]) select(filtered[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery(value);
      setAddError(null);
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        className="field-input"
        value={query}
        placeholder={placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          setAddError(null);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
      />
      {open && (
        <ul
          className="absolute z-30 mt-1 w-full max-h-56 overflow-auto text-sm"
          style={{
            background: "var(--g-0)",
            border: "1px solid var(--g-200)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-md)"
          }}
        >
          {filtered.length === 0 && !canOfferAdd ? (
            <li className="px-3 py-2 text-slate">No matches</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt}
                onMouseDown={(e) => {
                  e.preventDefault(); // fire before the input's onBlur/click-outside handler
                  select(opt);
                }}
                className={`px-3 py-1.5 cursor-pointer ${
                  i === highlight ? "bg-sapphire/10 text-sapphire" : "hover:bg-paper text-ink"
                }`}
              >
                {opt}
              </li>
            ))
          )}
          {canOfferAdd && (
            <li
              onMouseDown={(e) => {
                e.preventDefault();
                handleAdd();
              }}
              className="px-3 py-1.5 cursor-pointer border-t border-line text-sapphire font-medium"
              style={{ opacity: adding ? 0.6 : 1 }}
            >
              {adding ? "Adding…" : `+ Add "${trimmedQuery}"`}
            </li>
          )}
          {addError && <li className="px-3 py-1.5 text-ruby text-xs">{addError}</li>}
        </ul>
      )}
    </div>
  );
}
