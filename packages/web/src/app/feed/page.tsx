import { Feed } from "@/components/Feed";

export default function FeedPage() {
  return (
    <div>
      <h1>Agent feed</h1>
      <p className="muted" style={{ margin: "6px 0 16px" }}>
        Every message the band, venue, fan and crew agents exchange, plus the crank. Green bar = backed by a transaction.
      </p>
      <Feed limit={300} />
    </div>
  );
}
