"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CLUSTER } from "@/lib/config";

const NAV = [
  { href: "/", label: "Tour" },
  { href: "/feed", label: "Agent feed" },
  { href: "/band", label: "Band record" },
  { href: "/venues", label: "Venues" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="dot" /> Greenroom
        </div>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href || (n.href !== "/" && path.startsWith(n.href)) ? "active" : ""}>
              {n.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="status">
            <span className="pill">{CLUSTER}</span>
            <span className="muted small">AI agents book the tour; the deal lives on Solana.</span>
          </div>
          <WalletMultiButton />
        </div>
        {children}
      </main>
    </div>
  );
}
