"use client";

import { useEffect } from "react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}

export default function SlideOver({ open, onClose, title, children }: SlideOverProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/30" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-surface shadow-xl overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-line px-6 py-4 flex items-center justify-between z-10">
          <h2 className="font-display font-semibold text-lg text-ink">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate hover:text-ink text-2xl leading-none px-1">
            ×
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
