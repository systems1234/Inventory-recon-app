"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface MultiSelectProps {
  label: string;
  options: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
  placeholder?: string;
}

export default function MultiSelect({ label, options, selected, onChange, placeholder = "Search…" }: MultiSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, query]);

  function toggle(opt: string) {
    if (selected.includes(opt)) onChange(selected.filter((s) => s !== opt));
    else onChange([...selected, opt]);
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="field-input flex items-center justify-between gap-2 text-left w-44 py-1.5 text-sm"
      >
        <span className="truncate">{selected.length === 0 ? label : `${label} (${selected.length})`}</span>
        <span className="text-slate text-xs shrink-0">▾</span>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-60 card shadow-lg">
          <div className="p-2 border-b border-line">
            <input
              autoFocus
              type="text"
              placeholder={placeholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="field-input py-1.5 text-sm w-full"
            />
          </div>
          <div className="max-h-56 overflow-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-slate text-sm">No matches</p>
            ) : (
              filtered.map((opt) => (
                <label key={opt} className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-paper cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selected.includes(opt)}
                    onChange={() => toggle(opt)}
                    className="accent-sapphire"
                  />
                  <span className="text-ink truncate">{opt}</span>
                </label>
              ))
            )}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-line p-2">
              <button type="button" onClick={() => onChange([])} className="text-xs text-slate hover:text-ink">
                Clear selection
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
