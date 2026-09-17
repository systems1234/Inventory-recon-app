"use client";

import { useState } from "react";
import Sidebar from "./Sidebar";

interface AppShellProps {
  pageTitle: string;
  pageEyebrow?: string;
  topbarActions?: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ pageTitle, pageEyebrow, topbarActions, children }: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="app">
      <Sidebar mobileOpen={mobileOpen} onCloseMobile={() => setMobileOpen(false)} />
      <main className="main">
        <div className="topbar">
          <button className="mobile-menu-btn" aria-label="Menu" onClick={() => setMobileOpen((o) => !o)}>
            ☰
          </button>
          <div>
            {pageEyebrow && <div className="page-eyebrow">{pageEyebrow}</div>}
            <div className="page-title">{pageTitle}</div>
          </div>
          <div className="topbar-spacer" />
          {topbarActions}
        </div>
        <div className="content">{children}</div>
      </main>
    </div>
  );
}
