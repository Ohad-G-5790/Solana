"use client";

import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CLUSTER, explorerUrl } from "@/lib/config";
import { short, sol } from "@/lib/format";
import type { TicketAccount } from "@/lib/greenroom";
import { useBandSession } from "./BandSession";

/**
 * What the chain knows about the connected wallet, shown as soon as it
 * connects: balance, band profile, tickets held as a fan.
 */
export function WalletPanel() {
  const { wallet, profile, profileError } = useBandSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [tickets, setTickets] = useState<{ publicKey: PublicKey; account: TicketAccount }[] | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    const key = new PublicKey(wallet);
    const load = async () => {
      try {
        const g = await import("@/lib/greenroom");
        const b = await g.balanceLamports(key);
        if (alive) setBalance(b);
        const t = await g.fetchTicketsOfWallet(key);
        if (alive) {
          setTickets(t);
          setErr(null);
        }
      } catch (e) {
        if (alive) setErr((e as Error).message.slice(0, 140));
      }
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [wallet]);

  if (!wallet) return null;
  const live = tickets?.filter((t) => !t.account.refunded) ?? [];
  return (
    <div className="wallet-panel">
      <div>
        <div className="label">Your wallet</div>
        <a className="mono" href={explorerUrl("address", wallet)} target="_blank" rel="noreferrer">
          {short(wallet, 6)} ↗
        </a>
      </div>
      <div>
        <div className="label">Balance</div>
        <b>{balance === null ? "…" : sol(balance, 4)}</b> <span className="micro muted">{CLUSTER}</span>
      </div>
      <div>
        <div className="label">Band</div>
        {profile ? (
          <b>
            {profile.name} <span className="micro muted">{profile.genre}</span>
          </b>
        ) : profile === null ? (
          <span className="muted">not registered yet</span>
        ) : (
          <span className="muted">{profileError ? "waiting for devnet…" : "…"}</span>
        )}
      </div>
      <div>
        <div className="label">Settled shows</div>
        <b>{profile ? profile.showsCompleted : "–"}</b>
      </div>
      <div>
        <div className="label">Tickets you hold</div>
        {tickets === null ? (
          <span className="muted">{err ? "waiting for devnet…" : "…"}</span>
        ) : live.length === 0 ? (
          <span className="muted">none</span>
        ) : (
          <span>
            <b>{live.reduce((n, t) => n + t.account.quantity, 0)}</b>{" "}
            {live.slice(0, 3).map((t) => (
              <Link key={t.publicKey.toBase58()} className="micro" href={`/show?address=${t.account.show.toBase58()}`}>
                show {short(t.account.show.toBase58(), 3)}{" "}
              </Link>
            ))}
          </span>
        )}
      </div>
    </div>
  );
}
