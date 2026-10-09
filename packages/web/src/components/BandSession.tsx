"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import type { BandAccount } from "@/lib/greenroom";
import { getRun } from "@/lib/run";

/**
 * Whose band the band pages show. A connected wallet is the band: its
 * on-chain BandProfile, its tours, its approvals. Without a wallet the band
 * pages ask to connect, unless the visitor chose to look at the demo band.
 */
export interface BandSession {
  /** The connected wallet, if any. */
  wallet: string | null;
  /** Looking around as a guest at the demo band. */
  guest: boolean;
  setGuest: (on: boolean) => void;
  /** The band authority the band pages show; null means "connect first". */
  authority: string | null;
  /** The connected wallet's band profile: undefined while loading (or the RPC is unreachable), null when it has none. */
  profile: BandAccount | null | undefined;
  profileError: string | null;
  refreshProfile: () => void;
  /** The band of the run the dashboard bundle or local agents recorded. */
  runAuthority: string | null;
}

const Ctx = createContext<BandSession | null>(null);
const GUEST_KEY = "greenroom.guest";

export function BandSessionProvider({ children }: { children: ReactNode }) {
  const { publicKey } = useWallet();
  const wallet = publicKey?.toBase58() ?? null;
  const [guest, setGuestState] = useState(false);
  const [profile, setProfile] = useState<BandAccount | null | undefined>(undefined);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [runAuthority, setRunAuthority] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    try {
      setGuestState(window.sessionStorage.getItem(GUEST_KEY) === "1");
    } catch {
      /* storage blocked: guest mode lasts for this page view only */
    }
    let alive = true;
    const load = () => void getRun().then((r) => alive && setRunAuthority(r?.band.authority ?? null));
    load();
    const t = setInterval(load, 10_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const setGuest = useCallback((on: boolean) => {
    setGuestState(on);
    try {
      if (on) window.sessionStorage.setItem(GUEST_KEY, "1");
      else window.sessionStorage.removeItem(GUEST_KEY);
    } catch {
      /* in-memory only */
    }
  }, []);

  useEffect(() => {
    let alive = true;
    let retry: ReturnType<typeof setTimeout> | undefined;
    if (!publicKey) {
      setProfile(undefined);
      return;
    }
    // The Anchor client loads in the browser only: its CommonJS build cannot be
    // evaluated while the shell renders on the server.
    import("@/lib/greenroom")
      .then(({ bandPda, fetchBand }) => fetchBand(bandPda(publicKey).toBase58()))
      .then((p) => {
        if (!alive) return;
        setProfile(p);
        setProfileError(null);
      })
      .catch((e) => {
        if (!alive) return;
        // A busy or unreachable RPC is not "no band": keep loading and try again.
        setProfileError((e as Error).message.slice(0, 160));
        retry = setTimeout(() => setTick((n) => n + 1), 5000);
      });
    return () => {
      alive = false;
      clearTimeout(retry);
    };
  }, [publicKey, tick]);

  // A different wallet starts from scratch.
  useEffect(() => {
    setProfile(undefined);
    setProfileError(null);
  }, [publicKey]);

  const authority = wallet ?? (guest ? runAuthority : null);
  return (
    <Ctx.Provider value={{ wallet, guest, setGuest, authority, profile, profileError, refreshProfile: () => setTick((n) => n + 1), runAuthority }}>
      {children}
    </Ctx.Provider>
  );
}

export function useBandSession(): BandSession {
  const s = useContext(Ctx);
  if (!s) throw new Error("useBandSession outside BandSessionProvider");
  return s;
}
