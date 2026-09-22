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

  const summary = selected.length === 0 ? `${label}: All` : selected.length === 1 ? selected[0] : `${label} (${selected.length})`;

  return (
    <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        onClick={() => setOpen((o) => !o)}
        style={selected.length > 0 ? { display: "inline-flex", alignItems: "center", gap: 6 } : undefined}
      >
        {summary}
        {selected.length > 0 && (
          <span
            role="button"
            aria-label={`Clear ${label} filter`}
            title={`Clear ${label} filter`}
            onClick={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 14,
              height: 14,
              borderRadius: "50%",
              background: "var(--g-200)",
              color: "var(--g-600)",
              fontSize: 10,
              lineHeight: 1
            }}
          >
            ×
          </span>
        )}
      </button>
      {open && (
        <div className="colpick-pop ms-pop long" style={{ position: "absolute", top: 34, zIndex: 30 }}>
          <input
            autoFocus
            type="text"
            placeholder={placeholder}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="colpick-search"
          />
          {filtered.length === 0 ? (
            <p style={{ fontSize: 12, color: "var(--g-500)", padding: "6px 0" }}>No matches</p>
          ) : (
            filtered.map((opt) => (
              <label key={opt}>
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} />
                {opt}
              </label>
            ))
          )}
          {selected.length > 0 && <div className="ms-clear" onClick={() => onChange([])}>Clear</div>}
        </div>
      )}
    </div>
  );
}
