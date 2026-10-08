"use client";

import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { pendingItems } from "@/lib/approvals";
import { CLUSTER } from "@/lib/config";
import { getApprovals } from "@/lib/run";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/approvals", label: "Approvals" },
  { href: "/venues", label: "Venues" },
  { href: "/planner", label: "Route planner" },
  { href: "/band", label: "Band record" },
  { href: "/feed", label: "Agent feed" },
];

export function Shell({ children }: { children: ReactNode }) {
  const path = usePathname();
  const [waiting, setWaiting] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = () => void getApprovals().then((a) => alive && setWaiting(pendingItems(a).length));
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
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
              {n.href === "/approvals" && waiting > 0 ? (
                <span className="count" aria-label={`${waiting} waiting for you`}>
                  {waiting}
                </span>
              ) : null}
            </Link>
          ))}
        </nav>
      </aside>
      <main className="main">
        <div className="topbar">
          <div className="status">
            <span className="pill">{CLUSTER}</span>
            <span className="muted small">AI agents negotiate the tour; you approve; the deal lives on Solana.</span>
          </div>
          <WalletMultiButton />
        </div>
        {children}
      </main>
    </div>
  );
}
