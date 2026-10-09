"use client";

import { DemoNotice } from "./DemoNotice";
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
import { Landing } from "./Landing";

/** Pages that are about one band; they need a connected wallet (or demo mode). */
const BAND_PAGES = ["/", "/approvals", "/band", "/feed"];

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/approvals", label: "Approvals" },
  { href: "/venues", label: "Venues" },
  { href: "/planner", label: "Route planner" },
  { href: "/band", label: "Band record" },
  { href: "/feed", label: "Agent feed" },
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
  const bandPage = BAND_PAGES.includes(path) || path.startsWith("/tour");
  // Visitors see the pitch, not the app: the menu appears once a wallet connects or they explore the demo band.
  if (!session.wallet && !session.guest)
    return (
      <div className="public">
        <header className="public-top">
          <Link href="/" className="brand">
            <span className="dot" /> Greenroom
          </Link>
          <nav className="top-links" aria-label="On this page">
            {bandPage ? (
              <>
                <Link href="/#why">Why Greenroom</Link>
                <Link href="/#how">How it works</Link>
                <Link href="/#partners">Partners</Link>
              </>
            ) : null}
            {session.reconnecting ? null : <WalletButton>Connect wallet</WalletButton>}
          </nav>
        </header>
        <main className="public-main">{!bandPage ? children : session.reconnecting ? <p className="muted">Reconnecting your wallet…</p> : <Landing />}</main>
      </div>
    );
  // the demo band cannot create tours: that takes your own wallet
  const gated = path.startsWith("/tour") && !session.wallet;
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
        <DemoNotice />
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
            ) : null}
          </div>
          {/* the connect screen has its own button; one call to action at a time */}
          {gated ? null : <WalletButton>{session.wallet ? undefined : "Connect wallet"}</WalletButton>}
        </div>
        {gated ? session.reconnecting ? <p className="muted">Reconnecting your wallet…</p> : <ConnectScreen /> : children}
      </main>
    </div>
  );
}
