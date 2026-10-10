"use client";

import { useAnchorWallet } from "@solana/wallet-adapter-react";
import { WalletButton } from "./WalletButton";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { CLUSTER, explorerUrl } from "@/lib/config";
import { sol } from "@/lib/format";
import { getWorld, type WorldCity } from "@/lib/run";
import { useBandSession } from "./BandSession";

const GENRES = ["rock", "metal", "punk", "indie", "electronic", "hiphop", "jazz", "pop", "folk"];

/** First screen of the band pages when no wallet is connected. */
export function ConnectScreen() {
  const { setGuest, runAuthority, connectStalled } = useBandSession();
  const path = usePathname();
  const router = useRouter();
  // creating a tour needs your own wallet; the demo band lives on the dashboard
  const explore = () => {
    setGuest(true);
    if (path.startsWith("/tour")) router.push("/");
  };
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
      {connectStalled ? (
        <p className="small" style={{ marginTop: 16, color: "var(--warning)" }}>
          The wallet did not finish connecting. Open your wallet extension, unlock it and approve the request, then try again. Make sure the address bar shows
          https://.
        </p>
      ) : null}
      <div className="row" style={{ marginTop: 20 }}>
        <WalletButton>Connect wallet</WalletButton>
        {runAuthority ? (
          <button className="btn outline" onClick={explore}>
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
          <span className="small muted">Fans pay into a safe on Solana. A show that misses its target is cancelled and every fan is refunded automatically.</span>
        </div>
        <div>
          <b>4. Get paid</b>
          <span className="small muted">After the show the ticket money is split between band, venue and crew, automatically.</span>
        </div>
      </div>
    </div>
  );
}

/** A connected wallet with no band profile yet: create it on-chain. */
export function RegisterBand({ onBack }: { onBack?: () => void } = {}) {
  const wallet = useAnchorWallet();
  const { refreshProfile, profileError } = useBandSession();
  const [name, setName] = useState("");
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
      // the RPC can lag the confirmed transaction: ask again until the profile shows up
      for (const ms of [1500, 4000, 8000, 15000]) setTimeout(refreshProfile, ms);
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
        can check. It costs a small deposit (about 0.002 SOL of devnet money).
      </p>
      {profileError ? <p className="small warn" style={{ marginTop: 8 }}>Could not read the chain: {profileError}</p> : null}
      <div className="form">
        <label>
          <span className="small muted">Band name</span>
          <input className="input wide" value={name} maxLength={32} placeholder="Your band's name" onChange={(e) => setName(e.target.value)} />
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
            · not enough for the deposit. Send some {CLUSTER} SOL to this wallet first
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
        {onBack ? (
          <button className="btn outline" disabled={busy} onClick={onBack}>
            Back
          </button>
        ) : null}
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

/** The first question for a new wallet: who is it for? */
export function RoleChoice({ onPick }: { onPick: (role: "artist" | "venue") => void }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <h1>Welcome to Greenroom</h1>
      <p className="muted" style={{ marginTop: 6 }}>
        This wallet is new here. Who are you setting it up for?
      </p>
      <div className="role-choice">
        <button className="role-card" onClick={() => onPick("artist")}>
          <span className="eyebrow">Artist</span>
          <b>I&apos;m an artist or a band</b>
          <span className="small muted">Your agent plans tours, asks the venues and sells tickets. You approve before anything is booked.</span>
        </button>
        <button className="role-card" onClick={() => onPick("venue")}>
          <span className="eyebrow">Venue</span>
          <b>I run a venue</b>
          <span className="small muted">Bands&apos; agents propose nights to your room; you sign the ones you want and get your share after the show.</span>
        </button>
      </div>
    </div>
  );
}

export function RegisterVenue({ onBack }: { onBack?: () => void }) {
  const wallet = useAnchorWallet();
  const { refreshProfile, profileError } = useBandSession();
  const [balance, setBalance] = useState<number | null>(null);
  const [cities, setCities] = useState<WorldCity[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("Berlin");
  const [capacity, setCapacity] = useState(400);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string; tx?: string } | null>(null);

  useEffect(() => {
    void getWorld().then((w) => setCities([...w.cities].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))));
  }, []);
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
  const where = cities.find((c) => c.name === city);
  const valid = !!name.trim() && !tooLong && !!where && capacity >= 20 && capacity <= 100_000;
  const submit = async () => {
    if (!where) return;
    setBusy(true);
    setMsg(null);
    try {
      const { registerVenue } = await import("@/lib/greenroom");
      const tx = await registerVenue(wallet, name.trim(), where.name, where.lat, where.lng, capacity);
      setMsg({ ok: true, text: `${name.trim()} is registered on-chain.`, tx });
      for (const ms of [1500, 4000, 8000, 15000]) setTimeout(refreshProfile, ms);
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message.slice(0, 200) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="card" style={{ maxWidth: 640 }}>
      <h2>Set up your venue</h2>
      <p className="small muted" style={{ marginTop: 6 }}>
        Registering creates your venue&apos;s profile on Solana {CLUSTER}. Bands&apos; agents can then propose nights to your room, and every show you host adds to
        your record. It costs a small deposit (about 0.002 SOL of devnet money).
      </p>
      {profileError ? <p className="small warn" style={{ marginTop: 8 }}>Could not read the chain: {profileError}</p> : null}
      <div className="form">
        <label>
          <span className="small muted">Venue name</span>
          <input className="input wide" value={name} maxLength={32} placeholder="Your venue's name" onChange={(e) => setName(e.target.value)} />
        </label>
        <label>
          <span className="small muted">City</span>
          <select className="select" value={city} onChange={(e) => setCity(e.target.value)}>
            {cities.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name} ({c.country})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="small muted">Standing capacity</span>
          <input
            className="input"
            type="number"
            min={20}
            max={100000}
            value={capacity}
            onChange={(e) => setCapacity(Math.max(0, Math.round(Number(e.target.value) || 0)))}
          />
        </label>
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        Wallet balance: {balance === null ? "…" : sol(balance, 4)}
        {broke ? (
          <span className="warn">
            {" "}
            · not enough for the deposit. Send some {CLUSTER} SOL to this wallet first
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
        <button className="btn primary" disabled={busy || !valid || broke} onClick={submit}>
          {busy ? "Waiting for your wallet…" : `Register ${name.trim() || "venue"}`}
        </button>
        {onBack ? (
          <button className="btn outline" disabled={busy} onClick={onBack}>
            Back
          </button>
        ) : null}
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
