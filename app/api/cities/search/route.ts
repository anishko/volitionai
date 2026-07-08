import { NextRequest, NextResponse } from "next/server";
import { searchUsCities } from "@/lib/data/search-us-cities";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  return NextResponse.json({ cities: searchUsCities(q) });
}
