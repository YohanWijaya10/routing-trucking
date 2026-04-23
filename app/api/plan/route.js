import { NextResponse } from "next/server";
import { callPython } from "../../../lib/python-bridge";

export async function POST(request) {
  try {
    const body = await request.json();
    const data = await callPython("plan", body);
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
