import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const kota = searchParams.get("kota")?.trim();

    const values = [];
    const where = kota ? `WHERE kota ILIKE $1` : "";
    if (kota) values.push(`%${kota}%`);

    const result = await query(
      `
        SELECT id, name, kota, color, polygon
        FROM "AreaPolygon"
        ${where}
        ORDER BY created_at
      `,
      values
    );

    return NextResponse.json({
      areas: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        kota: row.kota,
        color: row.color,
        polygon: row.polygon || [],
        store_count: 0,
      })),
    });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const result = await query(
      `
        INSERT INTO "AreaPolygon" (name, kota, color, polygon)
        VALUES ($1, $2, $3, $4::jsonb)
        RETURNING id
      `,
      [
        body.name?.trim() || "",
        body.kota?.trim() || "",
        body.color || "#1a73e8",
        JSON.stringify(body.polygon || []),
      ]
    );

    return NextResponse.json({ success: true, id: result.rows[0]?.id });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    await query(
      `
        UPDATE "AreaPolygon"
        SET polygon = $2::jsonb
        WHERE id = $1
      `,
      [Number(body.id), JSON.stringify(body.polygon || [])]
    );

    return NextResponse.json({ success: true, id: Number(body.id) });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));

    await query(`DELETE FROM "AreaPolygon" WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
