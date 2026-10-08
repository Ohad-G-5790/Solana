import { NextResponse } from "next/server";
import { readWorld } from "@/lib/server-data";

export function GET() {
  return NextResponse.json(readWorld());
}
