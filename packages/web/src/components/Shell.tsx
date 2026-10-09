"use client";

import { DemoNotice } from "./DemoNotice";
import { WalletButton } from "./WalletButton";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { pendingItems } from "@/lib/approvals";
import { CLUSTER } from "@/lib/config";
import { short } from "@/lib/format";
import { getApprovals, getRun } from "@/lib/run";
import { useBandSession } from "./BandSession";
import { ConnectScreen } from "./Connect";
import { Landing } from "./Landing";

/** Pages that are about one band; they need a connected wallet (or demo mode). */
const BAND_PAGES = ["/", "/approvals", "/band", "/feed"];

/** The main page (the pitch): "/" for visitors, "/home" for anyone already inside the app. */
const HOME = "/home";

const NAV: { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "Dashboard", icon: <path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" /> },
  { href: "/approvals", label: "Approvals", icon: <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM8 12.5l2.8 2.8L16.5 9.5" /> },
  { href: "/venues", label: "Venues", icon: <path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z" /> },
  { href: "/planner", label: "Route planner", icon: <path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" /> },
  { href: "/band", label: "Band record", icon: <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6L3.3 9.3l6.1-.7z" /> },
  { href: "/feed", label: "Agent feed", icon: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" /> },
];

function NavIcon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const rawPath = usePathname();
  const path = rawPath.replace(/\/$/, "") || "/";
  const session = useBandSession();
  const router = useRouter();
  const [waiting, setWaiting] = useState(0);
  const [demoName, setDemoName] = useState<string | null>(null);
  const demo = session.guest && !session.wallet;
  useEffect(() => {
    let alive = true;
    if (demo) void getRun().then((r) => alive && setDemoName(r?.band.name ?? null));
    return () => {
      alive = false;
    };
  }, [demo]);
  const leaveDemo = () => {
    session.setGuest(false);
    router.push("/");
  };
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
  const home = path === HOME;
  const inApp = !!session.wallet || session.guest;
  // Visitors see the pitch, not the app: the menu appears once a wallet connects or they explore the demo band.
  // Anyone can come back to the pitch at /home (the logo), wallet or not.
  if (home || !inApp)
    return (
      <div className="public">
        <header className="public-top">
          <Link href={inApp ? HOME : "/"} className="brand">
            <span className="dot" /> Greenroom
          </Link>
          <nav className="top-links" aria-label="On this page">
            {bandPage || home ? (
              <>
                <a href="#why">Why Greenroom</a>
                <a href="#how">How it works</a>
                <a href="#partners">Partners</a>
              </>
            ) : null}
            {inApp ? (
              <Link href="/" className="btn primary small">
                {session.wallet ? "Your dashboard" : "Back to the demo"}
              </Link>
            ) : session.reconnecting ? null : (
              <WalletButton>Connect wallet</WalletButton>
            )}
          </nav>
        </header>
        <main className="public-main">{home ? <Landing /> : !bandPage ? children : session.reconnecting ? <p className="muted">Reconnecting your wallet…</p> : <Landing />}</main>
      </div>
    );
  // the demo band cannot create tours: that takes your own wallet
  const gated = path.startsWith("/tour") && !session.wallet;
  const who = session.wallet ? (session.profile ? session.profile.name : short(session.wallet)) : null;
  return (
    <div className="shell">
      <aside className="sidebar">
        <Link href={HOME} className="brand" title="Back to the main page">
          <span className="dot" /> Greenroom
        </Link>
        <nav className="nav">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className={path === n.href || (n.href !== "/" && path.startsWith(n.href)) ? "active" : ""}>
              <NavIcon>{n.icon}</NavIcon>
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
        {demo ? (
          <div className="demo-banner" role="region" aria-label="Live demo">
            <div className="demo-tags">
              <span className="live-badge">
                <i aria-hidden /> Live demo
              </span>
              <span className="net-badge">Solana {CLUSTER}</span>
            </div>
            <p>
              <b>You are exploring the demo band{demoName ? `, ${demoName}` : ""}.</b> A real tour the agents booked on Solana {CLUSTER}. No wallet needed: look
              around freely.
            </p>
            <div className="demo-actions">
              <Link href={`${HOME}#signup`} className="btn primary small">
                Get the full version
              </Link>
              <button className="btn outline small" onClick={leaveDemo}>
                Leave demo
              </button>
            </div>
          </div>
        ) : (
          <>
            <DemoNotice />
            <div className="topbar">
              <div className="status">
                <span className="net-badge">
                  <i aria-hidden /> Live on Solana {CLUSTER}
                </span>
                {who ? (
                  <span className="small">
                    Signed in as <b>{who}</b>
                  </span>
                ) : null}
              </div>
              {/* the connect screen has its own button; one call to action at a time */}
              {gated ? null : <WalletButton>{session.wallet ? undefined : "Connect wallet"}</WalletButton>}
            </div>
          </>
        )}
        {gated ? session.reconnecting ? <p className="muted">Reconnecting your wallet…</p> : <ConnectScreen /> : children}
      </main>
    </div>
  );
}
