"use client";

import { useEffect, useRef, useState } from "react";
import { explorerUrl } from "@/lib/config";
import { getFeed, type FeedMessage } from "@/lib/run";

export function Feed({ limit = 60, compact = false }: { limit?: number; compact?: boolean }) {
  const [items, setItems] = useState<FeedMessage[]>([]);
  const lastId = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const fresh = await getFeed(lastId.current, 500);
      if (!alive || fresh.length === 0) return;
      lastId.current = fresh[fresh.length - 1].id;
      setItems((prev) => [...prev, ...fresh].slice(-limit));
    };
    void load();
    const t = setInterval(load, 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [limit]);

  if (items.length === 0) return <p className="muted small">No agent messages yet. Run `npm run demo:fast` and they will appear here.</p>;

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
