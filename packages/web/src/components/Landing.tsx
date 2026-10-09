"use client";

import { usePathname, useRouter } from "next/navigation";
import { SIGNUP_URL } from "@/lib/config";
import { useBandSession } from "./BandSession";
import { SignupForm } from "./Signup";

/** Today versus with Greenroom: the pains a touring band knows, one row each. */
const PAINS = [
  {
    what: "Finding venues",
    today: "Dozens of emails, one venue at a time, then weeks of waiting for answers.",
    greenroom: "Your agent asks every venue along the way at once and compares the offers for you.",
  },
  {
    what: "Planning the route",
    today: "Maps, spreadsheets, and an 800 km drive home after the last show.",
    greenroom: "Short drives, a day off after three shows, and a last stop near home. Move stops around and see the difference.",
  },
  {
    what: "A half-empty room",
    today: "You find out on the night, after paying for the van, the fuel and the hotel.",
    greenroom: "Every show has a ticket target. Miss it and the show is called off early, and every fan is refunded automatically.",
  },
  {
    what: "Getting paid",
    today: "Chasing the door split for weeks after the show.",
    greenroom: "Band, venue and crew are paid automatically the moment the show settles.",
  },
  {
    what: "The deal",
    today: "A handshake and a long email thread.",
    greenroom: "Terms both sides sign, kept on Solana. Nothing is booked before you say yes.",
  },
];

const STEPS = [
  { title: "Answer four questions", text: "How many people you bring, the ticket price, where to start, how long to go." },
  { title: "Approve the route", text: "Venue agents make offers; you see the map, the dates and the drives, and change the order if you like." },
  { title: "Sell or save the date", text: "Fans pay into a safe. A show that misses its target is cancelled and every fan gets their money back." },
  { title: "Get paid", text: "After the show the ticket money is split between band, venue and crew, automatically." },
];

/** What it sounds like when the agents work: an illustration, not a recording. */
const GLIMPSE = [
  { who: "Your agent", tone: "band", text: "8 shows in 14 days from Berlin, €30 tickets. Who has a free night?" },
  { who: "Venue · Hamburg", tone: "venue", text: "Friday works. 400 capacity, 70% of the door to the band." },
  { who: "Venue · Prague", tone: "venue", text: "We pass: our room is too big for this draw." },
  { who: "Your agent", tone: "band", text: "Route ready: 8 venues, finishing in Leipzig, 190 km from home. Book it?" },
  { who: "You", tone: "you", text: "Approved." },
];

/**
 * The first page for visitors: the pitch and the sign-up for the full version.
 * The app's menu appears once a wallet connects or the visitor explores the demo band.
 */
export function Landing() {
  const { setGuest, runAuthority } = useBandSession();
  const path = usePathname();
  const router = useRouter();
  const explore = () => {
    setGuest(true);
    // creating a tour needs your own wallet; the demo band lives on the dashboard
    if (path.replace(/\/$/, "") !== "") router.push("/");
  };
  const demoButton = (label: string) =>
    runAuthority ? (
      <button className="btn outline big" onClick={explore}>
        {label}
      </button>
    ) : null;

  return (
    <div className="landing">
      <section className="hero">
        <span className="pill accent">Demo version</span>
        <h1>
          Your tour, booked by agents.
          <br />
          Approved by you.
        </h1>
        <p className="lead">
          Greenroom&apos;s AI agents find the venues, plan the route and negotiate the deals. You approve with one tap. Tickets, refunds and payouts run by
          themselves.
        </p>
        <div className="signup-box" id="signup">
          <p>
            <b>This is a demo version.</b> {SIGNUP_URL ? "Want the full version once it is out? Leave your email and you will get an update." : "The full version is on its way."}
          </p>
          <SignupForm big />
        </div>
        <div className="hero-more">{demoButton("Explore the demo band")}</div>
        <div className="glimpse" aria-label="An example of the agents at work">
          {GLIMPSE.map((m, i) => (
            <div key={i} className={`glimpse-msg ${m.tone}`}>
              <span className="small muted">{m.who}</span>
              <span>{m.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="pitch">
        <h2>Booking a tour is a second job. It should not be.</h2>
        <p className="muted">Most bands spend months on the phone and in their inbox before a single ticket is sold. Here is what changes.</p>
        <div className="compare" role="table" aria-label="Booking a tour today and with Greenroom">
          <div className="compare-row head" role="row">
            <span role="columnheader" />
            <span role="columnheader">Today</span>
            <span role="columnheader">With Greenroom</span>
          </div>
          {PAINS.map((p) => (
            <div key={p.what} className="compare-row" role="row">
              <b role="rowheader">{p.what}</b>
              <span role="cell" className="today">
                {p.today}
              </span>
              <span role="cell" className="ours">
                {p.greenroom}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="pitch">
        <h2>How it works</h2>
        <div className="steps">
          {STEPS.map((s, i) => (
            <div key={s.title}>
              <span className="step-no">{i + 1}</span>
              <b>{s.title}</b>
              <span className="small muted">{s.text}</span>
            </div>
          ))}
        </div>
      </section>

      <section className="closing">
        <h2>Be first on the road</h2>
        <p className="muted">The full version books real venues with real money. Get a note when it opens, or look around the demo band&apos;s tour now.</p>
        <div className="row" style={{ justifyContent: "center", marginTop: 18 }}>
          {SIGNUP_URL ? (
            <a href="#signup" className="btn primary big">
              Leave your email
            </a>
          ) : null}
          {demoButton("Try the demo")}
        </div>
        <p className="micro muted" style={{ marginTop: 28 }}>
          The demo runs on Solana devnet with play money: nothing you do here costs real money.
        </p>
      </section>
    </div>
  );
}
