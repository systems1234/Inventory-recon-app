"use client";

import { useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const icon = {
  overview: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
  normal: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  lot: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2l9 4.5-9 4.5-9-4.5L12 2z" />
      <path d="M3 11.5l9 4.5 9-4.5" />
      <path d="M3 16.5l9 4.5 9-4.5" />
    </svg>
  ),
  noPkt: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M20.59 13.41L11 3.83A2 2 0 009.59 3.2L3.2 9.59a2 2 0 00-.63 1.41L2.83 11a2 2 0 00.58 1.42l9.59 9.59a2 2 0 002.83 0l6.41-6.41a2 2 0 00-.65-2.19z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
  investigations: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  report: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 3v18h18" />
      <path d="M7 15l4-4 3 3 5-6" />
    </svg>
  ),
  locations: (
    <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22s7-7.58 7-12.5A7 7 0 005 9.5C5 14.42 12 22 12 22z" />
      <circle cx="12" cy="9.5" r="2.5" />
    </svg>
  )
};

const links: NavItem[] = [
  { href: "/dashboard", label: "Overview", icon: icon.overview },
  { href: "/entry/normal", label: "For Entry", icon: icon.normal },
  { href: "/entry/lot", label: "Lot Entry", icon: icon.lot },
  { href: "/entry/no-pkt", label: "No Pkt No.", icon: icon.noPkt },
  { href: "/locations", label: "Locations", icon: icon.locations },
  { href: "/investigations", label: "Investigations", icon: icon.investigations }
];

/** Full tables (all users, every filter) — moved off the main views and into their own nav group. */
const allViewLinks: NavItem[] = [
  { href: "/entry/normal/all", label: "For Entry", icon: icon.normal },
  { href: "/entry/lot/all", label: "Lot Entry", icon: icon.lot },
  { href: "/entry/no-pkt/all", label: "No Pkt No.", icon: icon.noPkt }
];

function initials(name?: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

interface SidebarProps {
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export default function Sidebar({ mobileOpen, onCloseMobile }: SidebarProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const role = (session?.user as any)?.role ?? "member";
  const isAdmin = role === "admin";
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <button
        className="sidebar-toggle"
        title={collapsed ? "Expand navigation" : "Collapse navigation"}
        onClick={() => setCollapsed((c) => !c)}
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d={collapsed ? "M9 18l6-6-6-6" : "M15 18l-6-6 6-6"} />
        </svg>
      </button>

      <div className="brand" onClick={onCloseMobile}>
        <div className="brand-mark">R</div>
        <div className="brand-text">
          <div className="brand-name">Recon Register</div>
          <div className="brand-sub"></div>
        </div>
      </div>

      <div className="nav-group">
        <div className="nav-label">Menu</div>
        {links.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href} onClick={onCloseMobile} className={`nav-item ${active ? "active" : ""}`}>
              {l.icon}
              <span className="label-text">{l.label}</span>
            </Link>
          );
        })}
        {isAdmin && (
          <Link
            href="/dashboard/admin"
            onClick={onCloseMobile}
            className={`nav-item ${pathname?.startsWith("/dashboard/admin") ? "active" : ""}`}
          >
            {icon.report}
            <span className="label-text">Report</span>
          </Link>
        )}
      </div>

      <div className="nav-group">
        <div className="nav-label">All Entries</div>
        {allViewLinks.map((l) => {
          const active = pathname === l.href;
          return (
            <Link key={l.href} href={l.href} onClick={onCloseMobile} className={`nav-item ${active ? "active" : ""}`}>
              {l.icon}
              <span className="label-text">{l.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="sidebar-footer">
        <div className="avatar">{initials(session?.user?.name)}</div>
        <div>
          <div className="user-name">{session?.user?.name ?? ""}</div>
          <div className="user-role">{isAdmin ? "Admin" : "Member"}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="role-tag"
          style={{ background: "transparent", border: "none", cursor: "pointer" }}
          title="Sign out"
        >
          Sign out
        </button>
      </div>
    </aside>
  );
}
