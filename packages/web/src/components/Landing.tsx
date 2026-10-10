"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { BASE_PATH, SIGNUP_URL } from "@/lib/config";
import { useBandSession } from "./BandSession";
import { RouteMap, type MapStop } from "./RouteMap";
import { SignupForm } from "./Signup";

/** Today versus with Greenroom: the pains a touring band knows, one line each side. */
const PAINS = [
  { what: "Finding venues", today: "Dozens of emails, one venue at a time, then weeks of waiting.", ours: "Your agent asks every venue along the way at once and compares the offers." },
  { what: "Planning the route", today: "Maps, spreadsheets, and an 800 km drive home after the last show.", ours: "Short drives, a day off after three shows, a last stop near home." },
  { what: "A half-empty room", today: "You find out on the night, after paying for the van and the hotel.", ours: "A show that misses its ticket target is called off early. Every fan is refunded." },
  { what: "Getting paid", today: "Chasing the door split for weeks after the show.", ours: "Band, venue and crew are paid automatically when the show settles." },
  { what: "The deal", today: "A handshake and a long email thread.", ours: "Terms both sides sign. Nothing is booked before you say yes." },
];

const STEPS: { title: string; text: string; icon: ReactNode }[] = [
  {
    title: "Answer four questions",
    text: "How many people you bring, the ticket price, where to start, how long to go.",
    icon: <path d="M4 5h16v11H9l-5 4zM8 9h8M8 12h5" />,
  },
  {
    title: "Approve the route",
    text: "Venue agents make offers. You see the map, the dates and the drives, and move stops around.",
    icon: <path d="M6 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM18 9a2 2 0 1 0 0-4 2 2 0 0 0 0 4zM8 17h5a3 3 0 0 0 0-6h-2a3 3 0 0 1 0-6h5" />,
  },
  {
    title: "Sell or save the date",
    text: "Fans pay into a safe. If a show misses its target, every fan gets their money back.",
    icon: <path d="M12 3l8 3v6c0 4.5-3.4 8-8 9-4.6-1-8-4.5-8-9V6zM8.5 12l2.5 2.5 4.5-5" />,
  },
  {
    title: "Get paid",
    text: "After the show the ticket money is split between band, venue and crew, automatically. Greenroom takes 10%, only from shows that are played.",
    icon: <path d="M3 7h18v10H3zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM6 10v4M18 10v4" />,
  },
];

/** Names the full version may work with. Listed as potential partners: none of them is confirmed. */
const PARTNERS: { name: string; logo: string }[] = [
  { name: "Solana", logo: "solana.svg" },
  { name: "Superteam Germany", logo: "superteam-germany.png" },
  { name: "Fuse Wallet", logo: "fuse-wallet.png" },
  { name: "Squads", logo: "squads.svg" },
  { name: "Pigeoning Productions", logo: "pigeoning-productions.png" },
  { name: "Nomadz", logo: "nomadz.png" },
  { name: "Jupiter", logo: "jupiter.svg" },
  { name: "Solflare", logo: "solflare.svg" },
  { name: "Phantom", logo: "phantom.svg" },
  { name: "Backpack", logo: "backpack.svg" },
  { name: "Bonk", logo: "bonk.png" },
];

/** Facts about the product, not market statistics. */
const FACTS = [
  { big: "4", text: "questions to plan a whole tour" },
  { big: "1", text: "tap to approve the route" },
  { big: "100%", text: "of the ticket money back to fans if a show misses its target" },
  { big: "0", text: "emails to venues" },
];

/** A sample tour for the picture: Berlin round trip, finishing in Leipzig. */
const SAMPLE: MapStop[] = [
  { key: "ber", label: "Berlin", lat: 52.52, lng: 13.405 },
  { key: "ham", label: "Hamburg", lat: 53.551, lng: 9.994 },
  { key: "cgn", label: "Cologne", lat: 50.938, lng: 6.96 },
  { key: "fra", label: "Frankfurt", lat: 50.11, lng: 8.682 },
  { key: "stu", label: "Stuttgart", lat: 48.776, lng: 9.183 },
  { key: "muc", label: "Munich", lat: 48.137, lng: 11.575 },
  { key: "prg", label: "Prague", lat: 50.075, lng: 14.437 },
  { key: "lej", label: "Leipzig", lat: 51.34, lng: 12.375 },
];

/** What it sounds like when the agents work: an illustration, not a recording. */
const CHAT = [
  { who: "Your agent", tone: "band", text: "8 shows in 14 days from Berlin, €30 tickets. Who has a free night?" },
  { who: "Venue · Hamburg", tone: "venue", text: "Friday works. 400 capacity, 70% of the door to the band." },
  { who: "Venue · Vienna", tone: "venue", text: "We pass: too far off this route." },
  { who: "Venue · Leipzig", tone: "venue", text: "Saturday is yours. 350 capacity." },
];

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {children}
    </svg>
  );
}

/**
 * The first page for visitors: the pitch and the sign-up for the full version.
 * The app's menu appears once a wallet connects or the visitor explores the demo band.
 */
export function Landing() {
  const { setGuest, runAuthority, wallet, guest } = useBandSession();
  const path = usePathname();
  const router = useRouter();
  const explore = () => {
    setGuest(true);
    // creating a tour needs your own wallet; the demo band lives on the dashboard
    if (path.replace(/\/$/, "") !== "") router.push("/");
  };

  return (
    <div className="landing">
      <section className="hero">
        <div className="glow" aria-hidden />
        <span className="pill accent rise">Demo version · live on Solana devnet</span>
        <h1 className="rise d1">
          Your tour, booked by agents.
          <br />
          <span className="green">Approved by you.</span>
        </h1>
        <p className="lead rise d2">AI agents find the venues, plan the route and negotiate the deals. You approve with one tap. Tickets, refunds and payouts run by themselves.</p>
        <div className="signup-box rise d3" id="signup">
          <p>
            <b>This is a demo version.</b> {SIGNUP_URL ? "Want the full version once it is out? Leave your email and you will get an update." : "The full version is on its way."}
          </p>
          <SignupForm big />
          {SIGNUP_URL ? <p className="micro muted">One email when the full version opens. Nothing else.</p> : null}
        </div>
        <div className="hero-ctas rise d3">
          {wallet || guest ? (
            // already inside the app (the logo leads here): straight back to it
            <Link href="/" className="btn outline big">
              {wallet ? "Open your dashboard →" : "Back to the demo band →"}
            </Link>
          ) : runAuthority ? (
            <button className="btn outline big" onClick={explore}>
              Explore the demo band →
            </button>
          ) : null}
          <Link href="/venue-demo" className="btn outline big">
            Explore as a venue →
          </Link>
          <Link href="/agents/new" className="btn outline big">
            Create your agent →
          </Link>
        </div>

        <div className="window rise d4" aria-label="A sample tour, planned by the agents">
          <div className="window-bar" aria-hidden>
            <i />
            <i />
            <i />
            <span>Your route · 8 shows · 14 days</span>
          </div>
          <div className="window-body">
            <div className="window-map">
              <RouteMap stops={SAMPLE} height={560} />
            </div>
            <div className="window-chat">
              {CHAT.map((m, i) => (
                <div key={i} className={`bubble ${m.tone}`} style={{ animationDelay: `${0.9 + i * 0.55}s` }}>
                  <span className="who">{m.who}</span>
                  {m.text}
                </div>
              ))}
              <div className="approve-card" style={{ animationDelay: `${0.9 + CHAT.length * 0.55}s` }}>
                <span className="who">Your agent</span>
                <b>Route ready</b>
                <span className="small muted">8 shows · 1,930 km · ends in Leipzig, 180 km from home</span>
                <span className="approve" aria-hidden>
                  Approve
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="facts">
          {FACTS.map((f) => (
            <div key={f.big}>
              <b>{f.big}</b>
              <span>{f.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pitch" id="why">
        <span className="eyebrow">Why Greenroom</span>
        <h2>Booking a tour is a second job. It should not be.</h2>
        <p className="muted">Most bands spend months in their inbox before a single ticket is sold.</p>
        <div className="versus">
          <div className="side before">
            <h3>Without Greenroom</h3>
            <ul>
              {PAINS.map((p) => (
                <li key={p.what}>
                  <span className="mark no" aria-hidden>
                    ✕
                  </span>
                  <div>
                    <b>{p.what}</b>
                    <span>{p.today}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
          <div className="side after">
            <h3>With Greenroom</h3>
            <ul>
              {PAINS.map((p) => (
                <li key={p.what}>
                  <span className="mark yes" aria-hidden>
                    ✓
                  </span>
                  <div>
                    <b>{p.what}</b>
                    <span>{p.ours}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="pitch" id="how">
        <span className="eyebrow">How it works</span>
        <h2>From four answers to a booked tour.</h2>
        <ol className="timeline">
          {STEPS.map((s, i) => (
            <li key={s.title}>
              <span className="step-icon">
                <Icon>{s.icon}</Icon>
              </span>
              <span className="step-no">Step {i + 1}</span>
              <b>{s.title}</b>
              <span className="small muted">{s.text}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="pitch" id="partners">
        <span className="eyebrow">Potential partners</span>
        <h2>Built in the Solana ecosystem.</h2>
        <p className="muted">The teams and communities we would like to build the full version with.</p>
        <ul className="partners">
          {PARTNERS.map((p) => (
            <li key={p.name}>
              {/* logos live in public/partners/ */}
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img className="monogram" src={`${BASE_PATH}/partners/${p.logo}`} alt="" width={34} height={34} loading="lazy" decoding="async" />
              {p.name}
            </li>
          ))}
        </ul>
        <p className="micro muted">Potential partners only: no partnership is confirmed, and names and logos belong to their owners.</p>
      </section>

      <section className="closing">
        <h2>Be first on the road.</h2>
        <p>The full version books real venues with real money. Get one email when it opens.</p>
        <SignupForm big source="greenroom-demo-bottom" />
        {runAuthority && !wallet ? (
          <button className="btn outline big" onClick={explore}>
            Explore the demo →
          </button>
        ) : null}
      </section>

      <footer className="landing-foot">
        <span className="brand">
          <span className="dot" /> Greenroom
        </span>
        <span className="micro muted">The demo runs on Solana devnet with play money: nothing you do here costs real money.</span>
      </footer>
    </div>
  );
}
