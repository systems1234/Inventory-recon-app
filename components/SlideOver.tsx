"use client";

import { useEffect, useState } from "react";

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  /** When true, closing (× or Escape) asks for confirmation instead of discarding immediately. */
  confirmClose?: boolean;
}

export default function SlideOver({ open, onClose, title, children, confirmClose = false }: SlideOverProps) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!open) {
      setConfirming(false);
      return;
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, confirmClose]);

  if (!open) return null;

  // Clicking the backdrop no longer closes the panel — only the × button
  // (and Escape, gated the same way) does, so a stray click can't wipe out
  // a large in-progress entry.
  function requestClose() {
    if (confirmClose) {
      setConfirming(true);
    } else {
      onClose();
    }
  }

  return (
    <div className="panel-overlay show">
      <div className="side-panel">
        <div className="panel-head">
          <div className="panel-title">{title}</div>
          <button onClick={requestClose} aria-label="Close" className="panel-close">
            ×
          </button>
        </div>
        <div className="panel-body">{children}</div>
      </div>

      {confirming && (
        <div className="modal-overlay" onClick={() => setConfirming(false)} style={{ zIndex: 110 }}>
          <div className="modal" style={{ width: 380 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <div className="modal-title">Discard this entry?</div>
            </div>
            <div className="modal-body">
              <p className="text-sm text-slate">
                You haven&apos;t submitted this yet. Closing now will remove everything you&apos;ve entered.
              </p>
            </div>
            <div className="modal-foot">
              <button className="btn-ghost" onClick={() => setConfirming(false)}>
                Keep editing
              </button>
              <button
                className="btn-danger"
                onClick={() => {
                  setConfirming(false);
                  onClose();
                }}
              >
                Discard & close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
