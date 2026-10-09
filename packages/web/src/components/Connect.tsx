"use client";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./WalletButton";
import { useEffect, useState } from "react";
import { CLUSTER, explorerUrl } from "@/lib/config";
import { sol } from "@/lib/format";
import { useBandSession } from "./BandSession";

const GENRES = ["rock", "metal", "punk", "indie", "electronic", "hiphop", "jazz", "pop", "folk"];

/** First screen of the band pages when no wallet is connected. */
export function ConnectScreen() {
  const { setGuest, runAuthority } = useBandSession();
  return (
    <div className="welcome">
      <div className="brand big">
        <span className="dot" /> Greenroom
      </div>
      <h1>Your tour, booked by agents. Approved by you.</h1>
      <p className="muted">
        Connect your band&apos;s wallet. It is your login and your signature: the dashboard shows your band, your tours and your money, and asks you before
        anything is booked.
      </p>
      <div className="row" style={{ marginTop: 20 }}>
        <WalletButton>Connect wallet</WalletButton>
        {runAuthority ? (
          <button className="btn outline" onClick={() => setGuest(true)}>
            Explore the demo band
          </button>
        ) : null}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        Phantom or Solflare, on Solana {CLUSTER}. In Phantom: Settings → Developer settings → Testnet mode, then pick Solana Devnet.
      </p>
      <div className="steps">
        <div>
          <b>1. Answer four questions</b>
          <span className="small muted">How many people you bring, the ticket price, where to start, how long to go.</span>
        </div>
        <div>
          <b>2. Approve the route</b>
          <span className="small muted">Venue agents make offers; you see the map, dates and drives. Nothing is booked before you say yes.</span>
        </div>
        <div>
          <b>3. Sell or save the date</b>
          <span className="small muted">Fans pay into escrow. Miss the threshold and you pick a replacement.</span>
        </div>
        <div>
          <b>4. Get paid</b>
          <span className="small muted">After the show the escrow splits between band, venue and crew on-chain.</span>
        </div>
      </div>
    </div>
  );
}

/** A connected wallet with no band profile yet: create it on-chain. */
export function RegisterBand() {
  const wallet = useAnchorWallet();
  const { refreshProfile, profileError } = useBandSession();
  const [name, setName] = useState("The Running Pigeons");
  const [genre, setGenre] = useState("indie");
  const [balance, setBalance] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);

  useEffect(() => {
    if (!wallet) return;
    let alive = true;
    const load = () =>
      void import("@/lib/greenroom")
        .then(({ balanceLamports }) => balanceLamports(wallet.publicKey))
        .then((b) => alive && setBalance(b))
        .catch(() => alive && setBalance(null));
    load();
    const t = setInterval(load, 8000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [wallet]);

  if (!wallet) return null;
  const tooLong = new TextEncoder().encode(name).length > 32;
  const broke = balance !== null && balance < 3_000_000;
  const submit = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const { registerBand } = await import("@/lib/greenroom");
      const tx = await registerBand(wallet, name.trim(), genre);
      setMsg({ ok: true, text: `${name.trim()} is registered on-chain.`, tx });
      setTimeout(refreshProfile, 1500);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.slice(0, 200) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>Set up your band</h2>
      <p className="small muted" style={{ marginTop: 6 }}>
        This wallet has no band profile yet. Registering creates it on Solana {CLUSTER}: the profile is where your settled shows add up into a track record venues
        can check. It costs a little rent (about 0.002 SOL) and the transaction fee.
      </p>
      {profileError ? <p className="small warn" style={{ marginTop: 8 }}>Could not read the chain: {profileError}</p> : null}
      <div className="form">
        <label>
          <span className="small muted">Band name</span>
          <input className="input wide" value={name} maxLength={32} onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="small muted">Genre</span>
          <select className="select" value={genre} onChange={(e) => setGenre(e.target.value)}>
            {GENRES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        Wallet balance: {balance === null ? "…" : sol(balance, 4)}
        {broke ? (
          <span className="warn">
            {" "}
            · not enough for the rent. Send some {CLUSTER} SOL to this wallet first
            {CLUSTER === "devnet" ? (
              <>
                {" "}
                (or use the{" "}
                <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
                  devnet faucet ↗
                </a>
                )
              </>
            ) : null}
            .
          </span>
        ) : null}
      </p>
      <div className="row" style={{ marginTop: 14 }}>
        <button className="btn primary" disabled={busy || !name.trim() || tooLong || broke} onClick={submit}>
          {busy ? "Waiting for your wallet…" : `Register ${name.trim() || "band"}`}
        </button>
      </div>
      {msg ? (
        <p className={`small ${msg.ok ? "good" : "bad"}`} style={{ marginTop: 10 }}>
          {msg.text}{" "}
          {msg.tx ? (
            <a href={explorerUrl("tx", msg.tx)} target="_blank" rel="noreferrer">
              view transaction ↗
            </a>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
