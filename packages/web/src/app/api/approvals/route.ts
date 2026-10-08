import { NextResponse, type NextRequest } from "next/server";
import { readApprovals, writeDecision } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(readApprovals());
}

/** The band's answer to a pending request: { id, answer }. */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as { id?: unknown; answer?: unknown } | null;
  if (!body) return NextResponse.json({ error: "JSON body required" }, { status: 400 });
  const r = writeDecision(body.id, body.answer);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.error }, { status: r.status });
}
