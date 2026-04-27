import { NextResponse } from "next/server";
import { callPython } from "../../../lib/python-bridge";

export async function POST(request) {
  try {
    const body = await request.json();
    const data = await callPython("plan", {
      ...body,
      ors_api_key: body.ors_api_key || process.env.ORS_API_KEY,
    });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
