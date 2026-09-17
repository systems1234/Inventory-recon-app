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
    <div className="panel-overlay show" onClick={onClose}>
      <div className="side-panel" onClick={(e) => e.stopPropagation()}>
        <div className="panel-head">
          <div className="panel-title">{title}</div>
          <button onClick={onClose} aria-label="Close" className="panel-close">
            ×
          </button>
        </div>
        <div className="panel-body">{children}</div>
      </div>
    </div>
  );
}
