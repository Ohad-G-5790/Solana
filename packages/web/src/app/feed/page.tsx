import { Feed } from "@/components/Feed";

export default function FeedPage() {
  return (
    <div>
      <h1>Live feed</h1>
      <p className="muted" style={{ margin: "6px 0 16px" }}>
        On-chain: the program&apos;s own events decoded from recent transactions, live wherever the agents run. Below it, the agents&apos; dialogue from the
        recorded run (offers and declines never touch the chain). Green bar = backed by a transaction.
      </p>
      <h2 style={{ margin: "0 0 10px" }}>On-chain, live</h2>
      <Feed limit={80} source="chain" />
      <h2 style={{ margin: "24px 0 10px" }}>Agent dialogue (recorded run)</h2>
      <Feed limit={300} source="transcript" />
    </div>
  );
}
