"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { describeAgent, loadAgents, removeAgent, type AgentConfig } from "@/lib/agents";

/** The agents created in this browser, and the way to make one. */
export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentConfig[] | null>(null);
  useEffect(() => setAgents(loadAgents()), []);

  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1>Your agents</h1>
          <p className="muted" style={{ marginTop: 6 }}>
            Agents negotiate for you with every other agent on Greenroom. Make one for your band or your venue in a few clicks.
          </p>
        </div>
        {agents?.length ? (
          <Link href="/agents/new" className="btn primary">
            Create an agent
          </Link>
        ) : null}
      </div>

      {agents === null ? null : agents.length === 0 ? (
        <div className="cta" style={{ marginTop: 18 }}>
          <div>
            <h3>No agent yet</h3>
            <p className="small muted">Pick who it works for, answer three questions, name it. It tries its first deals right away.</p>
          </div>
          <Link href="/agents/new" className="btn primary big">
            Create an agent
          </Link>
        </div>
      ) : (
        <div className="agent-grid">
          {agents.map((a) => (
            <div key={a.id} className="agent-card">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="eyebrow">{a.kind === "band" ? "Band agent" : "Venue agent"}</span>
                <button
                  className="icon-btn"
                  aria-label={`Delete ${a.name}`}
                  title="Delete"
                  onClick={() => {
                    removeAgent(a.id);
                    setAgents(loadAgents());
                  }}
                >
                  ✕
                </button>
              </div>
              <h3>{a.name}</h3>
              <ul className="rules">
                {describeAgent(a).map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
              <Link href={a.kind === "band" ? "/tour/new" : "/venue-demo"} className="small">
                {a.kind === "band" ? "Plan a tour with it →" : "See a venue on Greenroom →"}
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
