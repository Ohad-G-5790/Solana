"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { fetchChainEvents, fetchShowEvents } from "@/lib/chain-live";
import { explorerUrl, POLL_MS } from "@/lib/config";
import { fans } from "@/lib/format";
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

/** Where each show stands, as feed lines: the Activity view before devnet returns the event history. */
export function showsFeed(shows: { show: string; state: string; ticketsSold: number }[], inFans: boolean): FeedMessage[] {
  const count = (t: number) => (inFans ? `${fans(t)} fans` : `${t} ticket${t === 1 ? "" : "s"}`);
  const line: Record<string, [string, (s: { ticketsSold: number }) => string]> = {
    proposed: ["show.proposed", () => "Booked; waiting for the venue to sign."],
    onSale: ["fan.bought", (s) => `On sale: ${count(s.ticketsSold)} so far.`],
    confirmed: ["crank.confirmed", (s) => `Goes ahead: ${count(s.ticketsSold)} so far.`],
    cancelled: ["crank.cancelled", () => "Cancelled; every fan is refunded automatically."],
    settled: ["crank.settled", () => "Played and paid out."],
  };
  return shows
    .filter((s) => line[s.state])
    .map((s, i) => ({ id: -1 - i, at: 0, kind: line[s.state][0], from: "chain", text: line[s.state][1](s), data: { show: s.show } }) as FeedMessage);
}

/**
 * The story in four phases, in the order a tour lives them. Every message kind
 * belongs to one phase; inside a phase, messages read top to bottom.
 */
export const PHASES: { id: string; label: string; kinds: string[] }[] = [
  { id: "plan", label: "Planning", kinds: ["tour.request", "venue.offer", "venue.decline", "band.plan", "approval.request", "approval.decision"] },
  { id: "book", label: "Booking", kinds: ["show.proposed", "show.accepted", "show.rejected", "crew.offer", "crew.hired"] },
  { id: "sales", label: "Ticket sales", kinds: ["fan.bought"] },
  { id: "results", label: "Results", kinds: ["crank.confirmed", "crank.cancelled", "crank.refunded", "crank.settled"] },
  { id: "notes", label: "Notes", kinds: ["note"] },
];
const phaseOf = (kind: string) => PHASES.find((p) => p.kinds.includes(kind))?.id ?? "notes";

/** Who is speaking: the band's agent, a venue's agent, the fans, the money (settlement), the band itself. */
type Speaker = { name: string; tone: "band" | "you" | "venue" | "fans" | "pay" | "crew" | "system" };
export const WHO_FILTERS: { id: Speaker["tone"] | "all"; label: string }[] = [
  { id: "all", label: "Everyone" },
  { id: "band", label: "Your agent" },
  { id: "venue", label: "Venues" },
  { id: "fans", label: "Fans" },
  { id: "pay", label: "Money" },
];
function speaker(m: FeedMessage): Speaker {
  const [role, rest] = m.from.includes(":") ? m.from.split(/:(.*)/) : [m.from, ""];
  const pretty = (rest ?? "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  if (role === "you" || role === "auto-pilot") return { name: role === "you" ? "You" : "Auto-pilot", tone: "you" };
  if (role === "band") return { name: "Your agent", tone: "band" };
  if (role === "venue") return { name: pretty, tone: "venue" };
  if (role === "fan" || m.kind === "fan.bought") return { name: "Fans", tone: "fans" };
  if (role === "crew") return { name: pretty || "Crew", tone: "crew" };
  if (m.kind === "show.accepted" || m.kind === "show.rejected") return { name: "Venue", tone: "venue" };
  if (m.kind.startsWith("crank.")) return { name: "Settlement", tone: "pay" };
  return { name: "Greenroom", tone: "system" };
}
const initial: Record<Speaker["tone"], string> = { band: "A", you: "Y", venue: "V", fans: "F", pay: "€", crew: "C", system: "G" };

// at 0: a "where it stands" line, not an event with a time
const time = (ms: number) => (ms ? new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "now");

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
  inFans = true,
  fallback,
  title,
  hideWhenEmpty,
  story,
}: {
  limit?: number;
  compact?: boolean;
  source?: "chain" | "transcript";
  shows?: string[];
  empty?: string;
  /** show address -> city, so chain events say where they happened */
  cityOf?: Record<string, string>;
  /** chain events of a tour booked in the dashboard: fans and euros (else tickets and SOL) */
  inFans?: boolean;
  /** shown when the chain has no events yet but the tour already has news (e.g. tickets sold) */
  fallback?: FeedMessage[];
  /** a heading shown with the feed; with hideWhenEmpty, neither shows until there is something */
  title?: ReactNode;
  hideWhenEmpty?: boolean;
  /** the negotiation recorded when the tour was booked (offers, declines, the plan), shown first */
  story?: FeedMessage[];
}) {
  const [items, setItems] = useState<FeedMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const say = (m: FeedMessage) => {
    const city = cityOf?.[String((m.data as { show?: string } | undefined)?.show ?? "")];
    const chainText = (m.data as { textTickets?: string } | undefined)?.textTickets;
    const t = plain(!inFans && chainText ? chainText : m.text);
    return city && !t.includes(city) ? `${city}: ${t}` : t;
  };
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");
  const [open, setOpen] = useState<Record<string, boolean>>({});
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

  // no events read yet but the tour has news: start from the shows' current state
  // shows without any event read yet keep a "where it stands" line (the history loads a few at a time)
  const withEvents = new Set(items.map((m) => String((m.data as { show?: string } | undefined)?.show ?? "")));
  const missing = (loaded || !!error) && fallback ? fallback.filter((m) => !withEvents.has(String((m.data as { show?: string }).show))) : [];
  const usingFallback = missing.length > 0;
  const list = [...(story ?? []), ...(usingFallback ? [...missing, ...items] : items)];

  if (list.length === 0 && hideWhenEmpty) return null;
  if (list.length === 0)
    return (
      <p className="muted small">
        {error ? `Waiting for the network (${error.slice(0, 60)}); retrying.` : !loaded ? "Loading…" : (empty ?? (source === "chain" ? "Nothing has happened on-chain yet." : "Nothing has happened yet."))}
      </p>
    );

  // Fan purchases come by the hundred: one running line per show (its latest count) keeps the feed calm.
  const latestSale = new Map<string, FeedMessage>();
  const purchases = new Map<string, number>();
  for (const m of list) {
    if (m.kind !== "fan.bought") continue;
    const show = String((m.data as { show?: string; city?: string } | undefined)?.show ?? (m.data as { city?: string } | undefined)?.city ?? m.id);
    latestSale.set(show, m);
    purchases.set(show, (purchases.get(show) ?? 0) + 1);
  }
  const salesLine = (m: FeedMessage, show: string): FeedMessage => {
    const d = (m.data ?? {}) as { ticketsSold?: number; capacity?: number; city?: string };
    const city = cityOf?.[show] ?? d.city;
    const count = (t: number) => (inFans ? `${fans(t)} fans` : `${t} ticket${t === 1 ? "" : "s"}`);
    const text =
      d.ticketsSold !== undefined
        ? `${count(d.ticketsSold)} so far${d.capacity ? ` of ${count(d.capacity)}` : ""} · ${purchases.get(show)} purchase${purchases.get(show) === 1 ? "" : "s"}.`
        : m.text;
    return { ...m, text: city && !text.includes(city) ? `${city}: ${text}` : text };
  };
  const calm: FeedMessage[] = list.filter((m) => m.kind !== "fan.bought");
  for (const [show, m] of latestSale) calm.push(salesLine(m, show));

  const visible = filter === "all" ? calm : calm.filter((m) => speaker(m).tone === filter);
  const phases = PHASES.map((p) => ({ ...p, items: visible.filter((m) => phaseOf(m.kind) === p.id).sort((x, y) => x.at - y.at || x.id - y.id) })).filter((p) => p.items.length);
  const SHOWN = 4;

  return (
    <div className="agent-feed">
      {title}
      {usingFallback ? <p className="micro muted" style={{ marginBottom: 8 }}>Where each show stands now; the step-by-step story loads from devnet when it answers.</p> : null}
      {!compact ? (
        <div className="toolbar" role="tablist" aria-label="Who is speaking">
          {WHO_FILTERS.filter((w) => w.id === "all" || calm.some((m) => speaker(m).tone === w.id)).map((w) => (
            <button key={w.id} className={`chip ${filter === w.id ? "on" : ""}`} onClick={() => setFilter(w.id)} role="tab" aria-selected={filter === w.id}>
              {w.label}
            </button>
          ))}
        </div>
      ) : null}
      {phases.map((p) => {
        const all = open[p.id] ?? false;
        const rows = compact ? p.items.slice(-1) : all ? p.items : p.items.slice(-SHOWN);
        return (
          <section key={p.id} className="phase" aria-label={p.label}>
            <header>
              <span className="phase-label">{p.label}</span>
              <span className="phase-count">{p.items.length}</span>
            </header>
            {!compact && !all && p.items.length > SHOWN ? (
              <button className="link-btn micro phase-more" onClick={() => setOpen((o) => ({ ...o, [p.id]: true }))}>
                Show {p.items.length - SHOWN} earlier
              </button>
            ) : null}
            {rows.map((m) => {
              const w = speaker(m);
              return (
                <div key={`${m.id}-${m.tx ?? ""}`} className="msg">
                  <span className={`avatar ${w.tone}`} aria-hidden>
                    {initial[w.tone]}
                  </span>
                  <div className="msg-body">
                    <div className="msg-head">
                      <b className="small">{w.name}</b>
                      <span className="micro muted">{time(m.at)}</span>
                      {m.tx ? (
                        <a className="micro muted" href={explorerUrl("tx", m.tx)} target="_blank" rel="noreferrer">
                          receipt ↗
                        </a>
                      ) : null}
                    </div>
                    <div className="small msg-text">{say(m)}</div>
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
