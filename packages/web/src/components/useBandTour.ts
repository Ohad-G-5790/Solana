"use client";

import { useEffect, useState } from "react";
import { fetchLiveTour } from "@/lib/chain-live";
import { getRun, type RunSummary } from "@/lib/run";
import { useBandSession } from "./BandSession";

/**
 * The tour of the band on screen, for pages that are open to everyone (Venues,
 * Route planner): a connected wallet's own latest tour from chain state, the
 * demo band's recorded tour in guest mode, otherwise none. `mine` says whether
 * it may be called "your tour".
 */
export function useBandTour(): { tour: RunSummary | null; mine: boolean } {
  const session = useBandSession();
  const [tour, setTour] = useState<RunSummary | null>(null);
  const wallet = session.wallet;
  const guest = session.guest;
  useEffect(() => {
    let alive = true;
    setTour(null);
    if (wallet) void fetchLiveTour(wallet).then((t) => alive && setTour(t), () => undefined);
    else if (guest) void getRun().then((r) => alive && setTour(r));
    return () => {
      alive = false;
    };
  }, [wallet, guest]);
  return { tour, mine: !!wallet };
}
