"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useBandSession } from "@/components/BandSession";
import { Feed, showsFeed } from "@/components/Feed";
import { fetchLiveTour } from "@/lib/chain-live";
import { getRun } from "@/lib/run";

/**
 * Activity for the band on screen: a connected band sees what happened to its
 * own shows on-chain; the demo band (guest mode) shows its recorded story,
 * offers and declines included. Nobody sees another band's activity as theirs.
 */
export default function FeedPage() {
  const session = useBandSession();
  const own = !!session.wallet && session.authority === session.wallet;
  const [shows, setShows] = useState<{ show: string; city: string; state: string; ticketsSold: number }[] | null | undefined>(undefined);
  const [inFans, setInFans] = useState(true);
  const [failed, setFailed] = useState(false);
  const [demoName, setDemoName] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    if (own && session.wallet) {
      const load = () =>
        fetchLiveTour(session.wallet!)
          .then((t) => {
            if (!alive) return;
            setShows(t?.shows.map((s) => ({ show: s.show, city: s.city, state: s.state, ticketsSold: s.ticketsSold })) ?? null);
            setInFans(!!t?.inApp);
            setFailed(false);
          })
          .catch(() => alive && setFailed(true));
      void load();
      const t = setInterval(load, 30_000);
      return () => {
        alive = false;
        clearInterval(t);
      };
    }
    void getRun().then((r) => alive && setDemoName(r?.band.name ?? null));
    return () => {
      alive = false;
    };
  }, [own, session.wallet]);

  if (!own)
    return (
      <div>
        <h1>Activity</h1>
        <p className="muted" style={{ margin: "6px 0 12px", maxWidth: 760 }}>
          The demo band{demoName ? `, ${demoName},` : ""} on its recorded tour: every offer, decline, sale, refund and payout, grouped by what it is about. Open a group to read it.
        </p>
        <Feed source="transcript" />
      </div>
    );

  return (
    <div>
      <h1>Activity</h1>
      <p className="muted" style={{ margin: "6px 0 12px", maxWidth: 760 }}>
        Everything that happened to your shows, grouped by what it is about. Open a group to read it; pick a chip to see one kind only.
      </p>
      {shows === undefined ? (
        <p className="muted small">{failed ? "Devnet is busy; trying again in a moment…" : "Reading your tour…"}</p>
      ) : shows === null || shows.length === 0 ? (
        <div className="cta">
          <div>
            <h3>No activity yet</h3>
            <p className="small muted">Once you book a tour, venue signatures, ticket sales, refunds and payouts show up here.</p>
          </div>
          <Link href="/tour/new" className="btn primary big">
            Create a tour
          </Link>
        </div>
      ) : (
        <Feed source="chain" shows={shows.map((s) => s.show)} cityOf={Object.fromEntries(shows.map((s) => [s.show, s.city]))}
          inFans={inFans}
          fallback={showsFeed(shows, inFans)}
          empty="Your shows are booked; nothing else has happened yet. Venues sign within about 10 minutes." />
      )}
    </div>
  );
}
