"use client";

import { useEffect, useRef, useState } from "react";
import { fetchChainEvents } from "@/lib/chain-live";
import { explorerUrl } from "@/lib/config";
import { getFeed, type FeedMessage } from "@/lib/run";

/**
 * source "chain": the program's own events decoded from recent devnet
 * transactions (live, wherever the agents run). source "transcript": the
 * agents' dialogue from the run folder or the bundled run (includes venue
 * offers and declines, which never touch the chain).
 */
export function Feed({ limit = 60, compact = false, source = "transcript" }: { limit?: number; compact?: boolean; source?: "chain" | "transcript" }) {
  const [items, setItems] = useState<FeedMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const lastId = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (source === "chain") {
          const all = await fetchChainEvents(limit);
          if (alive) {
            setItems(all.slice(-limit));
            setError(null);
          }
          return;
        }
        const fresh = await getFeed(lastId.current, 500);
        if (!alive || fresh.length === 0) return;
        lastId.current = fresh[fresh.length - 1].id;
        setItems((prev) => [...prev, ...fresh].slice(-limit));
      } catch (e) {
        if (alive) setError((e as Error).message.slice(0, 120));
      }
    };
    void load();
    const t = setInterval(load, source === "chain" ? 15000 : 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [limit, source]);

  if (items.length === 0)
    return (
      <p className="muted small">
        {error
          ? `Feed unavailable (${error}).`
          : source === "chain"
            ? "No program transactions on this cluster yet."
            : "No agent messages yet. Run `npm run demo:fast` and they will appear here."}
      </p>
    );

  return (
    <div className="feed">
      {[...items].reverse().map((m) => (
        <div key={m.id} className={`item ${m.tx ? "tx" : ""}`}>
          <div>
            <div className="kind">{m.kind}</div>
            {!compact && <div className="micro muted">{new Date(m.at).toLocaleTimeString()}</div>}
          </div>
          <div>
            <span className="who">{m.from}</span>
            {m.to ? <span className="muted"> → {m.to}</span> : null}
            <div className="small" style={{ marginTop: 2 }}>{m.text}</div>
            {m.tx ? (
              <a className="micro muted" href={explorerUrl("tx", m.tx)} target="_blank" rel="noreferrer">
                tx {m.tx.slice(0, 10)}… ↗
              </a>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
}
