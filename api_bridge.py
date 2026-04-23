#!/usr/bin/env python3
from __future__ import annotations

import json
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
        database_url = payload.get("database_url")
        if not database_url:
            raise ValueError("database_url is required")
        city = payload.get("city", "surabaya")
        limit = int(payload.get("limit", 100))
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

    raise ValueError(f"unknown command: {command}")


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(json.dumps({"error": str(exc)}))
        raise
