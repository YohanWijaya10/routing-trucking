import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    databaseConfigured: Boolean(process.env.DATABASE_URL),
    defaultCity: process.env.DEFAULT_CITY || "surabaya",
    defaultDummyCount: Number(process.env.DEFAULT_DUMMY_COUNT || 100),
    orsApiKeyConfigured: Boolean(process.env.ORS_API_KEY),
  });
}
