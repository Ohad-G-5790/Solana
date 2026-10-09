"use client";

import { drive, formatMinutes, LONG_DRIVE_MIN, TRAVEL_DAY_MIN, type DriveLevel } from "@greenroom/world/geo";
import Link from "next/link";
import type { ReactNode } from "react";
import { dayLabel } from "@/lib/format";

export interface ItineraryStop {
  key: string;
  day: number;
  city: string;
  venueName: string;
  lat: number;
  lng: number;
  /** Struck through and skipped by the drive legs (dropped, cancelled without replacement). */
  off?: boolean;
  href?: string;
  /** Badge or control on the right. */
  right?: ReactNode;
  /** Small line under the venue name. */
  detail?: ReactNode;
}

const LEVEL_NOTE: Record<DriveLevel, string> = {
  short: "",
  long: `over ${LONG_DRIVE_MIN / 60} h on a show day`,
  "travel-day": `over ${TRAVEL_DAY_MIN / 60} h: plan a travel day`,
};

/**
 * Day-by-day route with the drive between consecutive stops (estimated road
 * km and van time incl. breaks), days off, and totals.
 */
export function Itinerary({ stops, totals = true }: { stops: ItineraryStop[]; totals?: boolean }) {
  const active = stops.filter((s) => !s.off);
  let km = 0;
  let minutes = 0;
  let longest = 0;
  let longLegs = 0;
  let travelDays = 0;
  let prev: ItineraryStop | null = null;
  const rows: ReactNode[] = [];
  let n = 0;
  for (const s of stops) {
    if (!s.off && prev) {
      const d = drive(prev, s);
      km += d.km;
      minutes += d.minutes;
      longest = Math.max(longest, d.minutes);
      if (d.level === "long") longLegs++;
      if (d.level === "travel-day") travelDays++;
      const off = s.day - prev.day - 1;
      rows.push(
        <div key={`leg-${s.key}`} className={`leg ${d.level}`}>
          <span aria-hidden>↓</span>
          <span>
            {d.km === 0 ? "same city" : `${d.km.toLocaleString()} km · ${formatMinutes(d.minutes)} drive`}
            {LEVEL_NOTE[d.level] ? ` · ${LEVEL_NOTE[d.level]}` : ""}
            {off > 0 ? ` · ${off} day${off > 1 ? "s" : ""} off` : ""}
          </span>
        </div>
      );
    }
    const name = (
      <>
        <span className="city">{s.city}</span> <span className="muted small">{s.venueName}</span>
      </>
    );
    rows.push(
      <div key={s.key} className={`stop ${s.off ? "off" : ""}`}>
        <span className="num">{s.off ? "–" : ++n}</span>
        <div style={{ minWidth: 0 }}>
          <div className="micro muted">
            {dayLabel(s.day)}
          </div>
          <div>{s.href ? <Link href={s.href}>{name}</Link> : name}</div>
          {s.detail ? <div className="micro muted" style={{ marginTop: 2 }}>{s.detail}</div> : null}
        </div>
        <div>{s.right}</div>
      </div>
    );
    if (!s.off) prev = s;
  }
  const days = active.length ? active[active.length - 1].day - active[0].day + 1 : 0;
  return (
    <div className="itinerary">
      {rows}
      {totals && active.length > 0 ? (
        <div className="totals">
          <span>
            <b>{active.length}</b> shows in <b>{days}</b> days
          </span>
          <span>
            <b>{km.toLocaleString()}</b> km by road
          </span>
          <span>
            <b>{formatMinutes(minutes)}</b> driving
          </span>
          {active.length > 1 ? (
            <span>
              longest <b>{formatMinutes(longest)}</b>
            </span>
          ) : null}
          {longLegs ? <span className="warn">{longLegs} long drive{longLegs > 1 ? "s" : ""}</span> : null}
          {travelDays ? <span className="bad">{travelDays} need{travelDays > 1 ? "" : "s"} a travel day</span> : null}
        </div>
      ) : null}
    </div>
  );
}

/** Estimates note, shown wherever drive times appear. */
export function DriveNote() {
  return (
    <p className="micro muted" style={{ marginTop: 6 }}>
      Drive times are estimates: road km ≈ 1.2 × straight line, a loaded van at ~90 km/h with a 45-minute break every 4.5 h. Check a routing app before you commit.
    </p>
  );
}
