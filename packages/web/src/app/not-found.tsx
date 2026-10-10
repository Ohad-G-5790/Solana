import Link from "next/link";

/** Any link that leads nowhere: say so in the brand's voice, with two ways on. */
export default function NotFound() {
  return (
    <div className="not-found">
      <span className="eyebrow">404</span>
      <h1>This page is not on the tour.</h1>
      <p className="muted">The link may be old or mistyped. Here is where the show goes on:</p>
      <div className="row" style={{ justifyContent: "center", marginTop: 20 }}>
        <Link href="/home" className="btn primary big">
          Main page
        </Link>
        <Link href="/venue-demo" className="btn outline big">
          See a venue on Greenroom
        </Link>
      </div>
    </div>
  );
}
