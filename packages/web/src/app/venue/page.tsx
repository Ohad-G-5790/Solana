"use client";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Reconnecting, useBandSession } from "@/components/BandSession";
import { ConnectScreen } from "@/components/Connect";
import { CLUSTER, explorerUrl, POLL_MS } from "@/lib/config";
import { short, sol } from "@/lib/format";
import type { ShowAccount, ShowStateName } from "@/lib/greenroom";

type Row = { publicKey: PublicKey; account: ShowAccount; state: ShowStateName; band: string };

const STATE_TEXT: Record<ShowStateName, string> = {
  proposed: "Waiting for you",
  onSale: "On sale",
  confirmed: "Going ahead",
  cancelled: "Cancelled, fans refunded",
  settled: "Played and paid",
};

/** A venue's own home: its profile and the nights bands proposed to it, which it signs or declines. */
export default function VenuePage() {
  const session = useBandSession();
  const wallet = useAnchorWallet();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);
  const venue = session.venue;

  const load = useCallback(async () => {
    if (!wallet) return;
    try {
      const { fetchShowsAtVenue, readProgram, stateName, venuePda } = await import("@/lib/greenroom");
      const shows = await fetchShowsAtVenue(venuePda(wallet.publicKey));
      const bands = await readProgram().account.bandProfile.fetchMultiple(shows.map((s) => s.account.bandProfile));
      setRows(
        shows
          .map((s, i) => ({ ...s, state: stateName(s.account.state), band: bands[i]?.name ?? short(s.account.bandProfile.toBase58()) }))
          .sort((a, b) => Number(a.account.date) - Number(b.account.date))
      );
      setError(null);
    } catch (e) {
      setError((e as Error).message.slice(0, 120));
    }
  }, [wallet]);

  useEffect(() => {
    void load();
    const t = setInterval(load, Math.max(10_000, POLL_MS));
    return () => clearInterval(t);
  }, [load]);

  if (!session.wallet) return session.reconnecting ? <Reconnecting /> : <ConnectScreen />;
  if (venue === undefined) return <p className="muted">Reading your venue…</p>;
  if (venue === null)
    return (
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>No venue on this wallet</h2>
        <p className="muted" style={{ marginTop: 6 }}>
          Set one up first. <Link href="/setup">Go to the setup</Link>
        </p>
      </div>
    );

  const act = async (label: string, run: () => Promise<string>) => {
    setBusy(label);
    setMsg(null);
    try {
      const tx = await run();
      setMsg({ ok: true, text: `${label}: done.`, tx });
      setTimeout(load, 2000);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.slice(0, 200) });
    } finally {
      setBusy(null);
    }
  };
  const waiting = rows?.filter((r) => r.state === "proposed") ?? [];
  const others = rows?.filter((r) => r.state !== "proposed") ?? [];

  return (
    <div style={{ maxWidth: 980 }}>
      <span className="eyebrow">Your venue</span>
      <h1>{venue.name}</h1>
      <p className="muted">
        {venue.city} · {venue.capacity.toLocaleString()} capacity · {venue.showsHosted} show{venue.showsHosted === 1 ? "" : "s"} hosted ·{" "}
        <a href={explorerUrl("address", wallet ? wallet.publicKey.toBase58() : "")} target="_blank" rel="noreferrer">
          wallet on explorer ↗
        </a>
      </p>

      <h2 style={{ margin: "22px 0 10px" }}>Waiting for you</h2>
      {rows === null ? (
        <p className="muted small">{error ? `${CLUSTER} is busy (${error}); retrying.` : "Looking for proposals…"}</p>
      ) : waiting.length === 0 ? (
        <div className="cta">
          <div>
            <h3>No proposals right now</h3>
            <p className="small muted">
              When a band&apos;s agent proposes a night here, it appears in this list. You sign it to put tickets on sale, or decline and the band gets its deposit
              back. A venue agent can answer for you: <Link href="/agents/new">create one</Link>, or see how it works in the{" "}
              <Link href="/venue-demo">venue demo</Link>.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid">
          {waiting.map((r) => (
            <div key={r.publicKey.toBase58()} className="card">
              <b>{r.band}</b>
              <p className="small muted" style={{ marginTop: 4 }}>
                {r.account.capacity} tickets at {sol(r.account.ticketPriceLamports, 4)} · your share {r.account.venueBps / 100}% · goes ahead at{" "}
                {r.account.thresholdBps / 100}% sold
              </p>
              <div className="row" style={{ marginTop: 10 }}>
                <button className="btn primary small" disabled={!!busy} onClick={() => act("Signed", async () => (await import("@/lib/greenroom")).acceptShow(wallet!, r.publicKey))}>
                  Sign this night
                </button>
                <button
                  className="btn outline small"
                  disabled={!!busy}
                  onClick={() => act("Declined", async () => (await import("@/lib/greenroom")).rejectShow(wallet!, r.publicKey, r.account.bandAuthority))}
                >
                  Decline
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {msg ? (
        <p className={`small ${msg.ok ? "good" : "bad"}`} style={{ marginTop: 10 }}>
          {busy ? busy : msg.text}{" "}
          {msg.tx ? (
            <a href={explorerUrl("tx", msg.tx)} target="_blank" rel="noreferrer">
              view transaction ↗
            </a>
          ) : null}
        </p>
      ) : null}

      {others.length ? (
        <>
          <h2 style={{ margin: "22px 0 10px" }}>Your nights</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Band</th>
                <th>Sold</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {others.map((r) => (
                <tr key={r.publicKey.toBase58()}>
                  <td>{r.band}</td>
                  <td>
                    {r.account.ticketsSold} / {r.account.capacity}
                  </td>
                  <td className="small muted">{STATE_TEXT[r.state]}</td>
                  <td>
                    <Link className="small" href={`/show?address=${r.publicKey.toBase58()}`}>
                      open
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : null}
    </div>
  );
}
