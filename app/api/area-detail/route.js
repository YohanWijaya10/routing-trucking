import { NextResponse } from "next/server";
import { callPython } from "../../../lib/python-bridge";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    const data = await callPython("get-area-detail", { id });
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
