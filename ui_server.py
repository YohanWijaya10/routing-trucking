#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
import random
import subprocess
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

from route_planner import available_districts, default_group_mapping, plan_routes


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "web"
DEFAULT_ORS_API_KEY = (
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImZkZjdmNTM2OTY3MDRhNjJhOTQ2YWNm"
    "ZmYwMGY0MjZlIiwiaCI6Im11cm11cjY0In0="
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Local UI for route planner prototype")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", default=8000, type=int)
    parser.add_argument(
        "--ors-api-key",
        default=os.environ.get("ORS_API_KEY", DEFAULT_ORS_API_KEY),
        help="Default ORS key for server-side planning",
    )
    parser.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL"),
        help="Default database URL for loading customers",
    )
    return parser.parse_args()


def json_response(handler: BaseHTTPRequestHandler, status: int, payload: dict) -> None:
    body = json.dumps(payload).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json; charset=utf-8")
    handler.send_header("Content-Length", str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def fetch_customers(database_url: str, city: str | None = None, limit: int | None = None) -> list[dict]:
    where_clauses = [
        "TRIM(lat) ~ '^-?[0-9]+(\\.[0-9]+)?$'",
        "TRIM(long) ~ '^-?[0-9]+(\\.[0-9]+)?$'",
        "TRIM(lat) <> '0'",
        "TRIM(long) <> '0'",
        "status = '2'",
    ]
    if city:
        escaped_city = city.replace("'", "''")
        where_clauses.append(f"kota ILIKE '%{escaped_city}%'")
    where_sql = " AND ".join(where_clauses)
    limit_sql = f"LIMIT {int(limit)}" if limit else ""
    sql = f"""
    SELECT
      id_customer,
      nama_toko,
      COALESCE(alamat, '') AS alamat,
      COALESCE(kecamatan, '') AS kecamatan,
      TRIM(lat) AS lat,
      TRIM(long) AS long
    FROM public."Customer"
    WHERE {where_sql}
    ORDER BY random()
    {limit_sql};
    """
    proc = subprocess.run(
        ["psql", database_url, "-At", "-F", "\t", "-c", sql],
        capture_output=True,
        text=True,
        check=False,
    )
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "Failed to load customers from database")

    customers = []
    for line in proc.stdout.splitlines():
        if not line.strip():
            continue
        customer_id, name, address, district, lat, lng = line.split("\t")
        customers.append(
            {
                "id_customer": customer_id,
                "name": name or customer_id,
                "address": address,
                "district": district,
                "lat": float(lat),
                "lng": float(lng),
            }
        )
    return customers


def build_dummy_payload(
    customers: list[dict],
    vehicles: list[dict] | None = None,
    depot_name: str = "Gudang Surabaya",
    depot_lat: float = -7.2575,
    depot_lng: float = 112.7521,
) -> dict:
    rng = random.Random(42)
    vehicles = vehicles or [
        {"id": "TRUCK-1", "capacity_kg": 2500},
        {"id": "TRUCK-2", "capacity_kg": 2500},
        {"id": "TRUCK-3", "capacity_kg": 3000},
        {"id": "TRUCK-4", "capacity_kg": 3000},
        {"id": "TRUCK-5", "capacity_kg": 3500},
        {"id": "TRUCK-6", "capacity_kg": 3500},
        {"id": "TRUCK-7", "capacity_kg": 4000},
    ]
    total_capacity = sum(max(0, int(vehicle.get("capacity_kg", 0))) for vehicle in vehicles)
    if total_capacity <= 0:
        raise ValueError("vehicle capacities must be greater than 0 before generating dummy orders")

    base_min_demand = 60
    target_total_demand = max(base_min_demand * len(customers), int(total_capacity * 0.82))
    weights = [rng.randint(10, 100) for _ in customers]
    total_weight = sum(weights) or 1

    demands = []
    remaining = target_total_demand
    for index, weight in enumerate(weights):
        customers_left = len(customers) - index
        min_reserved = base_min_demand * (customers_left - 1)
        share = int(round(target_total_demand * (weight / total_weight)))
        demand_kg = max(base_min_demand, min(share, remaining - min_reserved))
        demands.append(demand_kg)
        remaining -= demand_kg

    idx = 0
    while remaining > 0 and demands:
      demands[idx % len(demands)] += 1
      remaining -= 1
      idx += 1

    orders = []
    for idx, customer in enumerate(customers, start=1):
        demand_kg = demands[idx - 1]
        service_minutes = rng.choice([8, 10, 12, 15, 18])
        orders.append(
            {
                "id": f"DUMMY-{idx:03d}",
                "customer_id": customer["id_customer"],
                "name": customer["name"],
                "lat": customer["lat"],
                "lng": customer["lng"],
                "demand_kg": demand_kg,
                "service_minutes": service_minutes,
                "address": customer["address"],
                "district": customer["district"],
            }
        )

    return {
        "depot": {
            "name": depot_name,
            "lat": depot_lat,
            "lng": depot_lng,
        },
        "vehicles": vehicles,
        "orders": orders,
    }


class RoutePlannerHandler(BaseHTTPRequestHandler):
    server_version = "RoutePlannerUI/0.1"

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path == "/api/sample":
            sample_path = ROOT / "sample_input.json"
            with sample_path.open("r", encoding="utf-8") as fh:
                sample = json.load(fh)
            json_response(self, HTTPStatus.OK, sample)
            return
        if parsed.path == "/api/group-config":
            json_response(
                self,
                HTTPStatus.OK,
                {
                    "districts": available_districts(),
                    "mapping": default_group_mapping(),
                },
            )
            return

        if parsed.path == "/":
            self.serve_file(STATIC_DIR / "index.html", "text/html; charset=utf-8")
            return

        file_path = (STATIC_DIR / parsed.path.lstrip("/")).resolve()
        if not str(file_path).startswith(str(STATIC_DIR.resolve())) or not file_path.exists():
            self.send_error(HTTPStatus.NOT_FOUND, "File not found")
            return

        content_type = "text/plain; charset=utf-8"
        if file_path.suffix == ".css":
            content_type = "text/css; charset=utf-8"
        elif file_path.suffix == ".js":
            content_type = "application/javascript; charset=utf-8"
        elif file_path.suffix == ".json":
            content_type = "application/json; charset=utf-8"
        self.serve_file(file_path, content_type)

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if parsed.path not in {"/api/plan", "/api/dummy-orders"}:
            self.send_error(HTTPStatus.NOT_FOUND, "Endpoint not found")
            return

        length = int(self.headers.get("Content-Length", "0"))
        raw_body = self.rfile.read(length)
        try:
            body = json.loads(raw_body.decode("utf-8"))
        except json.JSONDecodeError:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": "Invalid JSON body"})
            return

        query = parse_qs(parsed.query)
        if parsed.path == "/api/dummy-orders":
            database_url = body.get("database_url") or self.server.database_url
            city = body.get("city", "surabaya")
            limit = int(body.get("limit", 100))
            requested_vehicles = body.get("vehicles")
            if not database_url:
                json_response(self, HTTPStatus.BAD_REQUEST, {"error": "database_url is required"})
                return
            try:
                customers = fetch_customers(database_url, city=city, limit=limit)
                payload = build_dummy_payload(
                    customers,
                    vehicles=requested_vehicles,
                    depot_name=body.get("depot_name", "Gudang Surabaya"),
                    depot_lat=float(body.get("depot_lat", -7.2575)),
                    depot_lng=float(body.get("depot_lng", 112.7521)),
                )
            except Exception as exc:
                json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(exc)})
                return
            json_response(
                self,
                HTTPStatus.OK,
                {
                    "customer_count": len(customers),
                    "city": city,
                    "total_capacity_kg": sum(int(vehicle.get("capacity_kg", 0)) for vehicle in payload["vehicles"]),
                    "total_dummy_demand_kg": sum(int(order.get("demand_kg", 0)) for order in payload["orders"]),
                    "payload": payload,
                },
            )
            return

        solver = query.get("solver", ["auto"])[0]
        use_ors = query.get("use_ors", ["false"])[0].lower() == "true"
        ors_api_key = body.get("ors_api_key") or self.server.ors_api_key

        try:
            result = plan_routes(
                body["payload"],
                solver_choice=solver,
                use_ors=use_ors,
                ors_api_key=ors_api_key,
                district_group_map=body.get("district_group_map"),
            )
        except Exception as exc:
            json_response(self, HTTPStatus.BAD_REQUEST, {"error": str(exc)})
            return

        json_response(self, HTTPStatus.OK, result)

    def log_message(self, format: str, *args) -> None:
        return

    def serve_file(self, path: Path, content_type: str) -> None:
        body = path.read_bytes()
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> int:
    args = parse_args()
    server = ThreadingHTTPServer((args.host, args.port), RoutePlannerHandler)
    server.ors_api_key = args.ors_api_key
    server.database_url = args.database_url
    print(f"Route Planner UI running at http://{args.host}:{args.port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping server")
    finally:
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
