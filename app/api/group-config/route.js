import { NextResponse } from "next/server";
import { callPython } from "../../../lib/python-bridge";

export async function GET() {
  try {
    const data = await callPython("group-config");
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
