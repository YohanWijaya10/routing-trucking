#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from route_planner import available_districts, default_group_mapping, plan_routes
from ui_server import build_dummy_payload, fetch_customers


ROOT = Path(__file__).resolve().parent


def main() -> int:
    raw = sys.stdin.read()
    payload = json.loads(raw) if raw.strip() else {}
    command = payload.get("command")

    if command == "sample":
        sample = json.loads((ROOT / "sample_input.json").read_text(encoding="utf-8"))
        print(json.dumps(sample))
        return 0

    if command == "group-config":
        print(
            json.dumps(
                {
                    "districts": available_districts(),
                    "mapping": default_group_mapping(),
                }
            )
        )
        return 0

    if command == "dummy-orders":
        database_url = payload.get("database_url") or os.environ.get("DATABASE_URL")
        if not database_url:
            raise ValueError("database_url is required. Set it in form input or DATABASE_URL env.")
        city = payload.get("city") or None
        limit = int(payload.get("limit")) if payload.get("limit") else None
        customers = fetch_customers(database_url, city=city, limit=limit)
        built = build_dummy_payload(
            customers,
            vehicles=payload.get("vehicles"),
            depot_name=payload.get("depot_name", "Gudang Surabaya"),
            depot_lat=float(payload.get("depot_lat", -7.2575)),
            depot_lng=float(payload.get("depot_lng", 112.7521)),
        )
        print(
            json.dumps(
                {
                    "customer_count": len(customers),
                    "city": city,
                    "total_capacity_kg": sum(
                        int(vehicle.get("capacity_kg", 0)) for vehicle in built["vehicles"]
                    ),
                    "total_dummy_demand_kg": sum(
                        int(order.get("demand_kg", 0)) for order in built["orders"]
                    ),
                    "payload": built,
                }
            )
        )
        return 0

    if command == "plan":
        result = plan_routes(
            payload["payload"],
            solver_choice=payload.get("solver", "auto"),
            use_ors=bool(payload.get("use_ors")),
            ors_api_key=payload.get("ors_api_key"),
            district_group_map=payload.get("district_group_map"),
        )
        print(json.dumps(result))
        return 0

    if command == "get-areas":
        database_url = payload.get("database_url") or os.environ.get("DATABASE_URL")
        kota = payload.get("kota", "")
        
        # Build WHERE clause
        where_clause = ""
        if kota:
            where_clause = f"WHERE kota ILIKE '%{kota.replace(chr(39), chr(39)+chr(39))}%'"
        
        # Fetch areas
        sql = f"""SELECT id, name, kota, color, polygon FROM \"AreaPolygon\" {where_clause} ORDER BY created_at"""
        import subprocess
        proc = subprocess.run(
            ["psql", database_url, "-At", "-F", "\t", "-c", sql],
            capture_output=True, text=True, check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip())
        areas = []
        for line in proc.stdout.splitlines():
            if not line.strip(): continue
            parts = line.split("\t")
            if len(parts) >= 5:
                areas.append({
                    "id": int(parts[0]),
                    "name": parts[1],
                    "kota": parts[2],
                    "color": parts[3],
                    "polygon": json.loads(parts[4]) if parts[4] else [],
                    "store_count": 0,
                })
        
        # Fetch ALL active customers (or filter by kota if specified)
        cust_where = "status = '2' AND lat IS NOT NULL AND long IS NOT NULL"
        if kota:
            cust_where += f" AND kota ILIKE '%{kota.replace(chr(39), chr(39)+chr(39))}%'"
        cust_sql = f"""SELECT lat, long FROM \"Customer\" WHERE {cust_where}"""
        cust_proc = subprocess.run(
            ["psql", database_url, "-At", "-F", "\t", "-c", cust_sql],
            capture_output=True, text=True, check=False,
        )
        customers = []
        for line in cust_proc.stdout.splitlines():
            if not line.strip(): continue
            parts = line.split("\t")
            if len(parts) >= 2:
                try:
                    customers.append((float(parts[0]), float(parts[1])))
                except:
                    pass
        
        # Point-in-polygon using ray casting
        def point_in_polygon(lat, lng, poly):
            n = len(poly)
            inside = False
            j = n - 1
            for i in range(n):
                pi = poly[i]
                pj = poly[j]
                if ((pi['lng'] > lng) != (pj['lng'] > lng)) and \
                   (lat < (pj['lat'] - pi['lat']) * (lng - pi['lng']) / (pj['lng'] - pi['lng'] + 1e-10) + pi['lat']):
                    inside = not inside
                j = i
            return inside
        
        for area in areas:
            poly = area['polygon']
            if len(poly) < 3:
                continue
            count = 0
            for lat, lng in customers:
                if point_in_polygon(lat, lng, poly):
                    count += 1
            area['store_count'] = count
        
        print(json.dumps({"areas": areas}))
        return 0

    if command == "save-area":
        database_url = payload.get("database_url") or os.environ.get("DATABASE_URL")
        name = payload.get("name", "").replace("'", "''")
        kota = payload.get("kota", "").replace("'", "''")
        color = payload.get("color", "#1a73e8")
        polygon = json.dumps(payload.get("polygon", []))
        sql = f"""INSERT INTO \"AreaPolygon\" (name, kota, color, polygon) VALUES ('{name}', '{kota}', '{color}', '{polygon}'::jsonb) RETURNING id"""
        import subprocess
        proc = subprocess.run(
            ["psql", database_url, "-At", "-c", sql],
            capture_output=True, text=True, check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip())
        area_id = proc.stdout.strip()
        print(json.dumps({"success": True, "id": int(area_id)}))
        return 0

    if command == "update-area":
        database_url = payload.get("database_url") or os.environ.get("DATABASE_URL")
        area_id = int(payload.get("id"))
        polygon = json.dumps(payload.get("polygon", []))
        sql = f"""UPDATE \"AreaPolygon\" SET polygon = '{polygon}'::jsonb WHERE id = {area_id} RETURNING id"""
        import subprocess
        proc = subprocess.run(
            ["psql", database_url, "-At", "-c", sql],
            capture_output=True, text=True, check=False,
        )
        if proc.returncode != 0:
            raise RuntimeError(proc.stderr.strip())
        print(json.dumps({"success": True, "id": area_id}))
        return 0

    if command == "delete-area":
        database_url = payload.get("database_url") or os.environ.get("DATABASE_URL")
        area_id = payload.get("id")
        sql = f"""DELETE FROM \"AreaPolygon\" WHERE id = {int(area_id)}"""
        import subprocess
        proc = subprocess.run(
            ["psql", database_url, "-At", "-c", sql],
            capture_output=True, text=True, check=False,
        )
        print(json.dumps({"success": True}))
        return 0

    raise ValueError(f"unknown command: {command}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        raise
