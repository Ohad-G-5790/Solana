import { NextResponse } from "next/server";
import { readSummary } from "@/lib/server-data";

export const dynamic = "force-dynamic";

export function GET() {
  return NextResponse.json(readSummary());
}
