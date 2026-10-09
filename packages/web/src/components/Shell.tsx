"use client";

import { WalletButton } from "./WalletButton";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { pendingItems } from "@/lib/approvals";
import { CLUSTER } from "@/lib/config";
import { short } from "@/lib/format";
import { getApprovals } from "@/lib/run";
import { useBandSession } from "./BandSession";
import { ConnectScreen } from "./Connect";

/** Pages that are about one band; they need a connected wallet (or demo mode). */
const BAND_PAGES = ["/", "/approvals", "/band", "/feed"];

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/approvals", label: "Approvals" },
  { href: "/venues", label: "Venues" },
  { href: "/planner", label: "Route planner" },
  { href: "/band", label: "Band record" },
  { href: "/feed", label: "Activity" },
];

export function Shell({ children }: { children: ReactNode }) {
  const rawPath = usePathname();
  const path = rawPath.replace(/\/$/, "") || "/";
  const session = useBandSession();
  const [waiting, setWaiting] = useState(0);
  const ownRun = !!session.authority && session.authority === session.runAuthority;
  useEffect(() => {
    let alive = true;
    if (!ownRun) {
      setWaiting(0);
      return;
    }
    const load = () => void getApprovals().then((a) => alive && setWaiting(pendingItems(a).length));
    load();
    const t = setInterval(load, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ownRun]);
  const gated = (BAND_PAGES.includes(path) || path.startsWith("/tour")) && !session.wallet && !(session.guest && !path.startsWith("/tour"));
  const who = session.wallet ? (session.profile ? session.profile.name : short(session.wallet)) : session.guest ? "demo band" : null;
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
            {who ? (
              <span className="small">
                {session.wallet ? "Signed in as " : "Viewing the "}
                <b>{who}</b>
                {session.guest && !session.wallet ? (
                  <button className="link-btn small" onClick={() => session.setGuest(false)}>
                    leave demo
                  </button>
                ) : null}
              </span>
            ) : (
              <span className="muted small">AI agents negotiate the tour; you approve; the deal lives on Solana.</span>
            )}
          </div>
          {/* the connect screen has its own button; one call to action at a time */}
          {gated ? null : <WalletButton>{session.wallet ? undefined : "Connect wallet"}</WalletButton>}
        </div>
        {gated ? session.reconnecting ? <p className="muted">Reconnecting your wallet…</p> : <ConnectScreen /> : children}
      </main>
    </div>
  );
}
