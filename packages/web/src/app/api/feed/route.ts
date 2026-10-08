import { NextResponse, type NextRequest } from "next/server";
import { readFeed } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET(req: NextRequest) {
  const after = Number(req.nextUrl.searchParams.get("after") ?? 0);
  const limit = Math.min(1000, Number(req.nextUrl.searchParams.get("limit") ?? 200));
  return NextResponse.json(readFeed(after, limit));
}
