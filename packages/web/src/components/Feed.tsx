"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { fetchChainEvents, fetchShowEvents } from "@/lib/chain-live";
import { explorerUrl, POLL_MS } from "@/lib/config";
import { getFeed, type FeedMessage } from "@/lib/run";

/**
 * Agents write their own shorthand: days counted from 0 and, in older recorded
 * runs, raw lamports. Show days from 1 and SOL, like the rest of the dashboard.
 */
export function plain(text: string): string {
  return text
    .replace(/\b(\d{4,}) lamports\b/g, (_, n: string) => `${(Number(n) / 1e9).toLocaleString("en", { maximumFractionDigits: 4 })} SOL`)
    .replace(/\bday (\d+)\b/gi, (_, n: string) => `day ${Number(n) + 1}`);
}

/** What happened, in the band's words. Every message kind belongs to one group. */
export const CATEGORIES: { id: string; label: string; kinds: string[] }[] = [
  { id: "decisions", label: "Band decisions", kinds: ["approval.request", "approval.decision"] },
  { id: "bookings", label: "Bookings", kinds: ["tour.request", "band.plan", "show.proposed", "show.accepted", "show.rejected"] },
  { id: "offers", label: "Venue offers", kinds: ["venue.offer"] },
  { id: "declines", label: "Venue declines", kinds: ["venue.decline"] },
  { id: "sales", label: "Ticket sales", kinds: ["fan.bought"] },
  { id: "outcomes", label: "Confirmed and cancelled", kinds: ["crank.confirmed", "crank.cancelled"] },
  { id: "refunds", label: "Refunds", kinds: ["crank.refunded"] },
  { id: "crew", label: "Crew", kinds: ["crew.offer", "crew.hired"] },
  { id: "payouts", label: "Payouts", kinds: ["crank.settled"] },
  { id: "notes", label: "System notes", kinds: ["note"] },
];
const categoryOf = (kind: string) => CATEGORIES.find((c) => c.kinds.includes(kind))?.id ?? "notes";

/** "venue:lido-berlin" -> "Lido Berlin" (role kept as a small label). */
function who(from: string): { role: string; name: string } {
  const [role, rest] = from.includes(":") ? from.split(/:(.*)/) : ["", from];
  const name = (rest ?? "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  return { role: role || from, name };
}

const time = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/**
 * Activity grouped by what it is about. source "chain": the program's own
 * events from recent transactions (live, wherever the agents run).
 * source "transcript": the agents' dialogue of the run (also offers and
 * declines, which never touch the chain). shows: with source "chain", only
 * the events of these shows (one band's tour). compact: only the group rows.
 */
export function Feed({
  limit = 2000,
  compact = false,
  source = "transcript",
  shows,
  empty,
  cityOf,
}: {
  limit?: number;
  compact?: boolean;
  source?: "chain" | "transcript";
  shows?: string[];
  empty?: string;
  /** show address -> city, so chain events say where they happened */
  cityOf?: Record<string, string>;
}) {
  const [items, setItems] = useState<FeedMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const say = (m: FeedMessage) => {
    const city = cityOf?.[String((m.data as { show?: string } | undefined)?.show ?? "")];
    const t = plain(m.text);
    return city && !t.includes(city) ? `${city}: ${t}` : t;
  };
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, number>>({});
  const lastId = useRef(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        if (source === "chain") {
          const all = shows ? await fetchShowEvents(shows) : await fetchChainEvents(25);
          if (alive) {
            setItems(all.slice(-limit));
            setError(null);
            setLoaded(true);
          }
          return;
        }
        const fresh = await getFeed(lastId.current, 2000);
        if (alive) setLoaded(true);
        if (!alive || fresh.length === 0) return;
        lastId.current = fresh[fresh.length - 1].id;
        setItems((prev) => [...prev, ...fresh].slice(-limit));
      } catch (e) {
        if (alive) setError((e as Error).message.slice(0, 120));
      }
    };
    void load();
    const t = setInterval(load, source === "chain" ? Math.max(15_000, POLL_MS) : 2000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // shows is a fresh array each render; its content is what matters
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [limit, source, shows?.join(",")]);

  const groups = useMemo(() => {
    const by = new Map<string, FeedMessage[]>();
    for (const m of items) {
      const c = categoryOf(m.kind);
      by.set(c, [...(by.get(c) ?? []), m]);
    }
    return CATEGORIES.filter((c) => by.has(c.id)).map((c) => ({ ...c, items: by.get(c.id)!.slice().reverse() }));
  }, [items]);

  if (items.length === 0)
    return (
      <p className="muted small">
        {error ? `Waiting for the network (${error.slice(0, 60)}); retrying.` : !loaded ? "Loading…" : (empty ?? (source === "chain" ? "Nothing has happened on-chain yet." : "Nothing has happened yet."))}
      </p>
    );

  const shown = filter === "all" ? groups : groups.filter((g) => g.id === filter);
  return (
    <div className="activity">
      {!compact ? (
        <div className="toolbar" role="tablist" aria-label="Filter activity">
          <button className={`chip ${filter === "all" ? "on" : ""}`} onClick={() => setFilter("all")} role="tab" aria-selected={filter === "all"}>
            All {items.length}
          </button>
          {groups.map((g) => (
            <button key={g.id} className={`chip ${filter === g.id ? "on" : ""}`} onClick={() => setFilter(g.id)} role="tab" aria-selected={filter === g.id}>
              {g.label} {g.items.length}
            </button>
          ))}
        </div>
      ) : null}
      {shown.map((g) => {
        const latest = g.items[0];
        const n = expanded[g.id] ?? 15;
        return (
          <details key={g.id} className="group" open={!compact && filter !== "all"}>
            <summary>
              <span className="g-label">{g.label}</span>
              <span className="g-count">{g.items.length}</span>
              <span className="g-latest small muted">{say(latest)}</span>
              <span className="micro muted nowrap">{time(latest.at)}</span>
            </summary>
            <div className="g-items">
              {g.items.slice(0, n).map((m) => {
                const w = who(m.from);
                return (
                  <div key={`${m.id}-${m.tx ?? ""}`} className={`entry ${m.tx ? "tx" : ""}`}>
                    <span className="micro muted nowrap">{time(m.at)}</span>
                    <div style={{ minWidth: 0 }}>
                      <span className="micro muted">{w.role}</span> <b className="small">{w.name}</b>
                      <div className="small">{say(m)}</div>
                    </div>
                    {m.tx ? (
                      <a className="micro muted nowrap" href={explorerUrl("tx", m.tx)} target="_blank" rel="noreferrer">
                        receipt ↗
                      </a>
                    ) : (
                      <span />
                    )}
                  </div>
                );
              })}
              {g.items.length > n ? (
                <button className="btn small outline" style={{ margin: "8px 0 4px" }} onClick={() => setExpanded((e) => ({ ...e, [g.id]: n + 50 }))}>
                  Show {Math.min(50, g.items.length - n)} more of {g.items.length - n}
                </button>
              ) : null}
            </div>
          </details>
        );
      })}
    </div>
  );
}
