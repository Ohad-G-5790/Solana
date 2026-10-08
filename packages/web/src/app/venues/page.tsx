"use client";

import { useEffect, useState } from "react";
import { getWorld, type WorldVenue } from "@/lib/run";

export default function VenuesPage() {
  const [venues, setVenues] = useState<WorldVenue[]>([]);
  const [q, setQ] = useState("");
  useEffect(() => {
    void getWorld().then((w) => setVenues(w.venues));
  }, []);
  const shown = venues.filter((v) => !q || `${v.name} ${v.city} ${v.country}`.toLowerCase().includes(q.toLowerCase()));
  const byCountry = new Map<string, number>();
  for (const v of venues) byCountry.set(v.country, (byCountry.get(v.country) ?? 0) + 1);
  return (
    <div>
      <h1>Venues</h1>
      <p className="muted" style={{ margin: "6px 0 12px" }}>
        {venues.length} real venues in {new Set(venues.map((v) => v.city)).size} cities · {[...byCountry].map(([c, n]) => `${c} ${n}`).join(" · ")}. Capacities are
        approximate seed data; each venue has its own agent and wallet in the demo.
      </p>
      <input className="input" style={{ width: 260, marginBottom: 12 }} placeholder="Search city or venue" value={q} onChange={(e) => setQ(e.target.value)} />
      <table className="table">
        <thead>
          <tr>
            <th>Venue</th>
            <th>City</th>
            <th>Capacity</th>
            <th>Programme</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((v) => (
            <tr key={v.id}>
              <td>{v.name}</td>
              <td>
                {v.city} <span className="muted small">{v.country}</span>
              </td>
              <td>{v.capacity.toLocaleString()}</td>
              <td className="muted small">{v.genres.join(", ")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
