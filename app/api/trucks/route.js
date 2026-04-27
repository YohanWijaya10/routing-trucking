import { NextResponse } from "next/server";
import { query } from "../../../lib/db";

export async function GET() {
  try {
    const result = await query(
      `
        SELECT id, name, plate_number, capacity_kg, color, area_ids
        FROM "Truck"
        ORDER BY created_at
      `
    );

    return NextResponse.json({
      trucks: result.rows.map((row) => ({
        id: row.id,
        name: row.name,
        plate_number: row.plate_number || "",
        capacity_kg: row.capacity_kg || 0,
        color: row.color || "#1a73e8",
        area_ids: row.area_ids || [],
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
        INSERT INTO "Truck" (name, plate_number, capacity_kg, color, area_ids)
        VALUES ($1, $2, $3, $4, $5::jsonb)
        RETURNING id
      `,
      [
        body.name?.trim() || "",
        body.plate_number?.trim() || "",
        Number(body.capacity_kg) || 0,
        body.color || "#1a73e8",
        JSON.stringify(body.area_ids || []),
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
        UPDATE "Truck"
        SET name = $2,
            plate_number = $3,
            capacity_kg = $4,
            color = $5,
            area_ids = $6::jsonb
        WHERE id = $1
      `,
      [
        Number(body.id),
        body.name?.trim() || "",
        body.plate_number?.trim() || "",
        Number(body.capacity_kg) || 0,
        body.color || "#1a73e8",
        JSON.stringify(body.area_ids || []),
      ]
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

    await query(`DELETE FROM "Truck" WHERE id = $1`, [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}
