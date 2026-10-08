"use client";

import { useAnchorWallet, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import Link from "next/link";
import { use, useEffect, useState } from "react";
import { Progress, StateBadge } from "@/components/ShowCard";
import { explorerUrl } from "@/lib/config";
import { demoDate, short, sol, timeLeft } from "@/lib/format";
import { buyTicket, chainTime, checkThreshold, fetchShow, fetchTicket, fetchTicketsForShow, refundTicket, stateName, vaultPda, type ShowAccount, type TicketAccount } from "@/lib/greenroom";
import { getRun, type RunShow } from "@/lib/run";

export default function ShowPage({ params }: { params: Promise<{ address: string }> }) {
  const { address } = use(params);
  const wallet = useAnchorWallet();
  const { publicKey } = useWallet();
  const [acct, setAcct] = useState<ShowAccount | null | undefined>(undefined);
  const [run, setRun] = useState<RunShow | null>(null);
  const [tickets, setTickets] = useState<{ publicKey: PublicKey; account: TicketAccount }[]>([]);
  const [mine, setMine] = useState<TicketAccount | null>(null);
  const [now, setNow] = useState(0); // set from the chain clock on first poll
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);

  const reload = async () => {
    try {
      const a = await fetchShow(address);
      setAcct(a);
      setTickets(await fetchTicketsForShow(address));
      if (publicKey) setMine(await fetchTicket(address, publicKey));
      setNow(await chainTime());
    } catch (e) {
      setMsg({ ok: false, text: `RPC unreachable: ${(e as Error).message.slice(0, 120)}` });
      setAcct((a) => (a === undefined ? null : a));
    }
  };

  useEffect(() => {
    void reload();
    void getRun().then((r) => setRun(r?.shows.find((s) => s.show === address) ?? null));
    const t = setInterval(reload, 4000);
    const tick = setInterval(() => setNow((n) => n + 1), 1000);
    return () => {
      clearInterval(t);
      clearInterval(tick);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, publicKey?.toBase58()]);

  if (acct === undefined) return <p className="muted">Loading…</p>;
  if (acct === null)
    return (
      <div className="card">
        <h2>Show not found</h2>
        <p className="muted">{msg && !msg.ok ? `${msg.text}. Is the validator running?` : "It may have been rejected by the venue (the account is closed) or belong to another cluster."}</p>
      </div>
    );

  const state = stateName(acct.state);
  const required = Math.ceil((acct.capacity * acct.thresholdBps) / 10_000);
  const act = async (label: string, fn: () => Promise<string>) => {
    if (!wallet) return;
    setBusy(true);
    setMsg(null);
    try {
      const tx = await fn();
      setMsg({ ok: true, text: `${label} confirmed`, tx });
      await reload();
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.slice(0, 200) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <p className="small">
        <Link href="/">← Tour</Link>
      </p>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", marginTop: 8 }}>
        <div>
          <h1>{run?.city ?? short(address)}</h1>
          <p className="muted">
            {run ? `${run.venue.replace(/-/g, " ")} · day ${run.day} · ${demoDate(run.day)}` : ""}{" "}
            <a href={explorerUrl("address", address)} target="_blank" rel="noreferrer">
              show account ↗
            </a>{" "}
            ·{" "}
            <a href={explorerUrl("address", vaultPda(new PublicKey(address)).toBase58())} target="_blank" rel="noreferrer">
              vault ↗
            </a>
          </p>
        </div>
        <StateBadge state={state} />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <Progress sold={acct.ticketsSold} capacity={acct.capacity} thresholdBps={acct.thresholdBps} state={state} />
        <div className="stats" style={{ margin: "12px 0 0" }}>
          <div className="stat">
            <div className="label">Sold</div>
            <div className="value">
              {acct.ticketsSold} <span className="muted small">/ {acct.capacity}</span>
            </div>
          </div>
          <div className="stat">
            <div className="label">Threshold</div>
            <div className="value">
              {acct.thresholdBps / 100}% <span className="muted small">= {required}</span>
            </div>
          </div>
          <div className="stat">
            <div className="label">Deadline</div>
            <div className="value">{timeLeft(Number(acct.thresholdDeadline), now)}</div>
          </div>
          <div className="stat">
            <div className="label">Show date</div>
            <div className="value">{timeLeft(Number(acct.date), now)}</div>
          </div>
          <div className="stat">
            <div className="label">Ticket</div>
            <div className="value">{sol(acct.ticketPriceLamports)}</div>
          </div>
          <div className="stat">
            <div className="label">In escrow</div>
            <div className="value">{sol(acct.escrowLamports)}</div>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Split: band {acct.bandBps / 100}% · venue {acct.venueBps / 100}%
          {acct.payees.map((p) => ` · ${p.label} ${p.bps / 100}% (${short(p.address.toBase58())})`).join("")}
        </p>
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <h3>Your ticket</h3>
        {!wallet ? (
          <p className="muted small" style={{ marginTop: 6 }}>
            Connect a wallet (devnet) to buy a ticket into this show&apos;s escrow. If the show is cancelled you get it back automatically, or you can claim it here.
          </p>
        ) : mine ? (
          <div style={{ marginTop: 8 }}>
            <p className="small">
              You hold <b>{mine.quantity}</b> ticket{mine.quantity > 1 ? "s" : ""} ({sol(mine.amountLamports)}){mine.refunded ? " · refunded" : ""}.
            </p>
            {state === "cancelled" && !mine.refunded ? (
              <button className="btn primary" style={{ marginTop: 10 }} disabled={busy} onClick={() => act("Refund", () => refundTicket(wallet, address, publicKey!))}>
                Claim refund
              </button>
            ) : null}
          </div>
        ) : state === "onSale" || state === "confirmed" ? (
          <div className="row" style={{ marginTop: 10 }}>
            <input className="input" type="number" min={1} max={10} value={qty} onChange={(e) => setQty(Math.max(1, Math.min(10, Number(e.target.value))))} />
            <button className="btn primary" disabled={busy} onClick={() => act("Purchase", () => buyTicket(wallet, address, qty))}>
              Buy {qty} for {sol(Number(acct.ticketPriceLamports) * qty)}
            </button>
          </div>
        ) : (
          <p className="muted small" style={{ marginTop: 6 }}>
            Sales are closed for this show.
          </p>
        )}
        {wallet && state === "onSale" ? (
          <p className="small muted" style={{ marginTop: 10 }}>
            Anyone can run the crank:{" "}
            <button className="btn outline" disabled={busy} onClick={() => act("Threshold check", () => checkThreshold(wallet, address))}>
              check threshold
            </button>
          </p>
        ) : null}
        {msg ? (
          <p className="small" style={{ marginTop: 10, color: msg.ok ? "var(--accent)" : "var(--negative)" }}>
            {msg.text}{" "}
            {msg.tx ? (
              <a href={explorerUrl("tx", msg.tx)} target="_blank" rel="noreferrer">
                view transaction ↗
              </a>
            ) : null}
          </p>
        ) : null}
      </div>

      <h2 style={{ margin: "20px 0 10px" }}>Tickets ({tickets.length})</h2>
      <table className="table">
        <thead>
          <tr>
            <th>Fan</th>
            <th>Qty</th>
            <th>Paid</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {tickets.slice(0, 50).map((t) => (
            <tr key={t.publicKey.toBase58()}>
              <td>
                <a className="mono" href={explorerUrl("address", t.account.buyer.toBase58())} target="_blank" rel="noreferrer">
                  {short(t.account.buyer.toBase58(), 6)}
                </a>
              </td>
              <td>{t.account.quantity}</td>
              <td>{sol(t.account.amountLamports)}</td>
              <td className="muted small">{t.account.refunded ? "refunded" : state === "settled" ? "attended" : "held in escrow"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
