"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { BandAgentTest, VenueInbox } from "@/components/AgentTest";
import { describeAgent, GENRES, newAgentId, saveAgent, type AgentConfig, type AgentKind, type BandRules, type VenueRules } from "@/lib/agents";
import { getWorld, type WorldCity } from "@/lib/run";

/** The same sizes and prices as the tour wizard, which starts from this agent. */
const DRAWS = [100, 200, 500, 1000, 2500, 5000];
const PRICES = [10, 15, 20, 30, 50];
const DRIVES = [3, 5, 7];
const CAPACITIES = [150, 300, 600, 1000, 2000];
const SHARES = [25, 30, 35];

export default function NewAgentPage() {
  return (
    <Suspense fallback={<p className="muted">Loading…</p>}>
      <NewAgent />
    </Suspense>
  );
}

/** Create an agent in a few clicks: who it works for, three or four answers, a name. */
function NewAgent() {
  const params = useSearchParams();
  const [kind, setKind] = useState<AgentKind | null>(params.get("kind") === "venue" ? "venue" : params.get("kind") === "band" ? "band" : null);
  const [cities, setCities] = useState<WorldCity[]>([]);
  const [band, setBand] = useState<BandRules>({ genre: "indie", homeCity: "Berlin", draw: 500, priceEuro: 20, maxDriveHours: 5, roundTrip: true });
  const [venue, setVenue] = useState<VenueRules>({ city: "Berlin", capacity: 600, minPriceEuro: 20, sharePct: 30, genres: ["indie", "rock"] });
  const [name, setName] = useState("");
  const [created, setCreated] = useState<AgentConfig | null>(null);

  useEffect(() => {
    void getWorld().then((w) => setCities([...w.cities].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name))));
  }, []);
  const defaultName = useMemo(() => (kind === "venue" ? `${venue.city} venue agent` : kind === "band" ? `${band.genre[0].toUpperCase()}${band.genre.slice(1)} tour agent` : ""), [kind, venue.city, band.genre]);

  const create = () => {
    if (!kind) return;
    const a: AgentConfig = { id: newAgentId(), kind, name: (name.trim() || defaultName).slice(0, 40), createdAt: Date.now(), ...(kind === "band" ? { band } : { venue }) };
    saveAgent(a);
    setCreated(a);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  if (created) return <Created agent={created} onAnother={() => (setCreated(null), setKind(null), setName(""))} />;

  const citySelect = (value: string, onChange: (v: string) => void, label: string) => (
    <select className="select big" value={value} onChange={(e) => onChange(e.target.value)} aria-label={label}>
      {(cities.length ? cities : [{ name: value, country: "" } as WorldCity]).map((c) => (
        <option key={`${c.name}-${c.country}`} value={c.name}>
          {c.name} {c.country ? `(${c.country})` : ""}
        </option>
      ))}
    </select>
  );

  return (
    <div className="agent-new">
      <h1>Create your agent</h1>
      <p className="muted" style={{ marginTop: 6, maxWidth: 680 }}>
        A few clicks. Your agent negotiates for you with every other agent on Greenroom, and asks you before anything is booked.
      </p>

      <section className="question">
        <h2>Who does it work for?</h2>
        <div className="kind-tiles" role="group" aria-label="Who the agent works for">
          <button className={`tile kind ${kind === "band" ? "on" : ""}`} onClick={() => setKind("band")} aria-pressed={kind === "band"}>
            <b>A band</b>
            <span className="small muted">Books your tours: asks the venues, plans the route, sells the tickets.</span>
          </button>
          <button className={`tile kind ${kind === "venue" ? "on" : ""}`} onClick={() => setKind("venue")} aria-pressed={kind === "venue"}>
            <b>A venue</b>
            <span className="small muted">Fills your nights: answers band agents by your rules and signs the deal.</span>
          </button>
        </div>
      </section>

      {kind === "band" ? (
        <>
          <section className="question">
            <h2>Your genre and home city</h2>
            <div className="choices">
              {GENRES.map((g) => (
                <button key={g} className={`chip ${band.genre === g ? "on" : ""}`} onClick={() => setBand({ ...band, genre: g })} aria-pressed={band.genre === g}>
                  {g}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>{citySelect(band.homeCity, (v) => setBand({ ...band, homeCity: v }), "Home city")}</div>
          </section>
          <section className="question">
            <h2>How many people do you bring?</h2>
            <div className="choices">
              {DRAWS.map((d) => (
                <button key={d} className={`choice ${band.draw === d ? "on" : ""}`} onClick={() => setBand({ ...band, draw: d })} aria-pressed={band.draw === d}>
                  {d.toLocaleString()}
                </button>
              ))}
            </div>
          </section>
          <section className="question">
            <h2>Ticket price and longest drive</h2>
            <div className="choices">
              {PRICES.map((p) => (
                <button key={p} className={`choice ${band.priceEuro === p ? "on" : ""}`} onClick={() => setBand({ ...band, priceEuro: p })} aria-pressed={band.priceEuro === p}>
                  €{p}
                </button>
              ))}
            </div>
            <div className="choices">
              {DRIVES.map((h) => (
                <button key={h} className={`chip ${band.maxDriveHours === h ? "on" : ""}`} onClick={() => setBand({ ...band, maxDriveHours: h })} aria-pressed={band.maxDriveHours === h}>
                  up to {h} h a day
                </button>
              ))}
              <button className={`chip ${band.roundTrip ? "on" : ""}`} onClick={() => setBand({ ...band, roundTrip: !band.roundTrip })} aria-pressed={band.roundTrip}>
                finish near home
              </button>
            </div>
          </section>
        </>
      ) : kind === "venue" ? (
        <>
          <section className="question">
            <h2>Where is your venue, and how big?</h2>
            <div>{citySelect(venue.city, (v) => setVenue({ ...venue, city: v }), "Venue city")}</div>
            <div className="choices">
              {CAPACITIES.map((c) => (
                <button key={c} className={`choice ${venue.capacity === c ? "on" : ""}`} onClick={() => setVenue({ ...venue, capacity: c })} aria-pressed={venue.capacity === c}>
                  {c.toLocaleString()}
                </button>
              ))}
            </div>
          </section>
          <section className="question">
            <h2>What do you book?</h2>
            <div className="choices">
              {GENRES.map((g) => {
                const on = venue.genres.includes(g);
                return (
                  <button
                    key={g}
                    className={`chip ${on ? "on" : ""}`}
                    onClick={() => setVenue({ ...venue, genres: on ? venue.genres.filter((x) => x !== g) : [...venue.genres, g] })}
                    aria-pressed={on}
                  >
                    {g}
                  </button>
                );
              })}
            </div>
          </section>
          <section className="question">
            <h2>Your terms</h2>
            <p className="small muted">Lowest ticket price, and your share of the ticket money.</p>
            <div className="choices">
              {PRICES.map((p) => (
                <button key={p} className={`choice ${venue.minPriceEuro === p ? "on" : ""}`} onClick={() => setVenue({ ...venue, minPriceEuro: p })} aria-pressed={venue.minPriceEuro === p}>
                  €{p}+
                </button>
              ))}
            </div>
            <div className="choices">
              {SHARES.map((s) => (
                <button key={s} className={`chip ${venue.sharePct === s ? "on" : ""}`} onClick={() => setVenue({ ...venue, sharePct: s })} aria-pressed={venue.sharePct === s}>
                  {s}% to the venue
                </button>
              ))}
            </div>
          </section>
        </>
      ) : null}

      {kind ? (
        <section className="question">
          <h2>Name your agent</h2>
          <input className="input wide" value={name} maxLength={40} placeholder={defaultName} onChange={(e) => setName(e.target.value)} aria-label="Agent name" />
          <div className="row" style={{ marginTop: 16 }}>
            <button className="btn primary big" onClick={create} disabled={kind === "venue" && venue.genres.length === 0}>
              Create agent
            </button>
            {kind === "venue" && venue.genres.length === 0 ? <span className="small warn">Pick at least one genre.</span> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function Created({ agent, onAnother }: { agent: AgentConfig; onAnother: () => void }) {
  return (
    <div className="agent-new">
      <div className="agent-card hero">
        <div className="band-avatar small" aria-hidden>
          {agent.name
            .split(/\s+/)
            .slice(0, 2)
            .map((w) => w[0]?.toUpperCase() ?? "")
            .join("")}
        </div>
        <div>
          <span className="eyebrow">{agent.kind === "band" ? "Band agent" : "Venue agent"} · ready</span>
          <h1>{agent.name}</h1>
          <ul className="rules">
            {describeAgent(agent).map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      </div>

      <h2 style={{ margin: "28px 0 10px" }}>{agent.kind === "band" ? "Its first try" : "Its first answers"}</h2>
      {agent.band ? <BandAgentTest rules={agent.band} /> : agent.venue ? <VenueInbox rules={agent.venue} /> : null}

      <div className="row" style={{ marginTop: 22 }}>
        {agent.kind === "band" ? (
          <Link href="/tour/new" className="btn primary">
            Plan a tour with it
          </Link>
        ) : (
          <Link href="/venue-demo" className="btn primary">
            See a venue on Greenroom
          </Link>
        )}
        <Link href="/agents" className="btn outline">
          Your agents
        </Link>
        <button className="btn outline" onClick={onAnother}>
          Create another
        </button>
      </div>
      <p className="micro muted" style={{ marginTop: 14 }}>
        In this demo your agent lives in this browser. In the full version it runs on the platform around the clock.
      </p>
    </div>
  );
}
