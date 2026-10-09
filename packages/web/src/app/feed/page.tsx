"use client";

import { useState } from "react";
import { Feed } from "@/components/Feed";

export default function FeedPage() {
  const [source, setSource] = useState<"transcript" | "chain">("transcript");
  return (
    <div>
      <h1>Activity</h1>
      <p className="muted" style={{ margin: "6px 0 12px", maxWidth: 760 }}>
        Everything the agents and the chain did, grouped by what it is about. Open a group to see its messages; pick a chip to see one kind only.
      </p>
      <div className="toolbar" role="tablist" aria-label="Source">
        <button className={`chip ${source === "transcript" ? "on" : ""}`} onClick={() => setSource("transcript")} role="tab" aria-selected={source === "transcript"}>
          Tour story
        </button>
        <button className={`chip ${source === "chain" ? "on" : ""}`} onClick={() => setSource("chain")} role="tab" aria-selected={source === "chain"}>
          On-chain, live
        </button>
        <span className="small muted">
          {source === "transcript" ? "The agents' messages for the latest run, including offers and declines." : "The program's events from the latest transactions."}
        </span>
      </div>
      <Feed key={source} source={source} />
    </div>
  );
}
