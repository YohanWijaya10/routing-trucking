#!/usr/bin/env python3
"""
Simple route planning prototype without a database.

Inputs:
- depot coordinates
- vehicle capacities
- customer orders with demand and coordinates

Outputs:
- recommended vehicles used
- assigned stops per vehicle
- route order
- estimated distance and duration

This script prefers OR-Tools when available and falls back to a greedy solver.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
from functools import lru_cache
from itertools import combinations
from pathlib import Path
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

try:
    import requests
except ImportError:  # pragma: no cover - optional dependency
    requests = None

try:
    from ortools.constraint_solver import pywrapcp
    from ortools.constraint_solver import routing_enums_pb2
except ImportError:  # pragma: no cover - optional dependency
    pywrapcp = None
    routing_enums_pb2 = None


AVERAGE_CITY_SPEED_KPH = 28.0
DEFAULT_SERVICE_MINUTES = 12
ORS_MATRIX_URL = "https://api.openrouteservice.org/v2/matrix/driving-car"
ORS_DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car/geojson"
GREEDY_FILL_THRESHOLD_PCT = 90
COMPACT_ZONE_RADIUS_KM = 6.0
SURABAYA_BOUNDARY_DIR = Path(__file__).resolve().parent / "id35_jawa_timur" / "id3578_kota_surabaya"
SURABAYA_ZONE_MAP = {
    "Lakarsantri": ("A", "Surabaya Barat"),
    "Sambikerep": ("A", "Surabaya Barat"),
    "Tandes": ("A", "Surabaya Barat"),
    "Benowo": ("A", "Surabaya Barat"),
    "Pakal": ("A", "Surabaya Barat"),
    "Asemrowo": ("A", "Surabaya Barat"),
    "Suko Manunggal": ("A", "Surabaya Barat"),
    "Karang Pilang": ("B", "Surabaya Selatan"),
    "Jambangan": ("B", "Surabaya Selatan"),
    "Gayungan": ("B", "Surabaya Selatan"),
    "Wonocolo": ("B", "Surabaya Selatan"),
    "Wiyung": ("B", "Surabaya Selatan"),
    "Dukuh Pakis": ("B", "Surabaya Selatan"),
    "Wonokromo": ("B", "Surabaya Selatan"),
    "Rungkut": ("C", "Surabaya Timur"),
    "Gunung Anyar": ("C", "Surabaya Timur"),
    "Sukolilo": ("C", "Surabaya Timur"),
    "Mulyorejo": ("C", "Surabaya Timur"),
    "Tenggilis Mejoyo": ("C", "Surabaya Timur"),
    "Tambaksari": ("C", "Surabaya Timur"),
    "Gubeng": ("D", "Surabaya Pusat"),
    "Tegalsari": ("D", "Surabaya Pusat"),
    "Genteng": ("D", "Surabaya Pusat"),
    "Sawahan": ("D", "Surabaya Pusat"),
    "Bubutan": ("D", "Surabaya Pusat"),
    "Simokerto": ("D", "Surabaya Pusat"),
    "Krembangan": ("E", "Surabaya Utara"),
    "Semampir": ("E", "Surabaya Utara"),
    "Kenjeran": ("E", "Surabaya Utara"),
    "Bulak": ("E", "Surabaya Utara"),
    "Pabean Cantian": ("E", "Surabaya Utara"),
}
DEFAULT_ORS_API_KEY = (
    "eyJvcmciOiI1YjNjZTM1OTc4NTExMTAwMDFjZjYyNDgiLCJpZCI6ImZkZjdmNTM2OTY3MDRhNjJhOTQ2YWNm"
    "ZmYwMGY0MjZlIiwiaCI6Im11cm11cjY0In0="
)


@dataclass
class Vehicle:
    id: str
    capacity_kg: int
    max_stops: Optional[int] = None


@dataclass
class Order:
    id: str
    name: str
    lat: float
    lng: float
    demand_kg: int
    service_minutes: int = DEFAULT_SERVICE_MINUTES
    priority: int = 1
    area_id: int = 0
    area_label: str = "Area 1"
    district_label: str = ""
    district_override: str = ""
    manual_group_label: str = ""


@dataclass
class Depot:
    name: str
    lat: float
    lng: float


def default_group_mapping() -> Dict[str, str]:
    return {
        district: f"Group {group_code} - {zone_name}"
        for district, (group_code, zone_name) in SURABAYA_ZONE_MAP.items()
    }


def available_districts() -> List[str]:
    boundaries = load_surabaya_district_boundaries()
    names = sorted({boundary["district"] for boundary in boundaries})
    if names:
        return names
    return sorted(default_group_mapping().keys())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Prototype truck route planner")
    parser.add_argument("input", help="Path to input JSON file")
    parser.add_argument(
        "--solver",
        choices=("auto", "ortools", "greedy"),
        default="auto",
        help="Solver strategy to use",
    )
    parser.add_argument(
        "--output",
        help="Optional path to write JSON result",
    )
    parser.add_argument(
        "--use-ors",
        action="store_true",
        help="Use OpenRouteService Matrix API when ORS_API_KEY is set",
    )
    parser.add_argument(
        "--ors-api-key",
        default=os.environ.get("ORS_API_KEY", DEFAULT_ORS_API_KEY),
        help="OpenRouteService API key. Defaults to ORS_API_KEY env var.",
    )
    return parser.parse_args()


def load_input(path: str) -> Tuple[Depot, List[Vehicle], List[Order]]:
    with open(path, "r", encoding="utf-8") as fh:
        payload = json.load(fh)
    return load_payload(payload)


def load_payload(payload: Dict[str, Any]) -> Tuple[Depot, List[Vehicle], List[Order]]:

    depot_raw = payload["depot"]
    depot = Depot(
        name=depot_raw["name"],
        lat=float(depot_raw["lat"]),
        lng=float(depot_raw["lng"]),
    )

    vehicles = [
        Vehicle(
            id=str(row["id"]),
            capacity_kg=int(row["capacity_kg"]),
            max_stops=int(row["max_stops"]) if row.get("max_stops") is not None else None,
        )
        for row in payload["vehicles"]
    ]

    orders = [
        Order(
            id=str(row["id"]),
            name=row["name"],
            lat=float(row["lat"]),
            lng=float(row["lng"]),
            demand_kg=int(row["demand_kg"]),
            service_minutes=int(row.get("service_minutes", DEFAULT_SERVICE_MINUTES)),
            priority=int(row.get("priority", 1)),
            area_id=int(row.get("area_id", 0)),
            area_label=row.get("area_label", "Area 1"),
            district_label=row.get("district_label") or row.get("district", ""),
            district_override=row.get("district_override", ""),
            manual_group_label=row.get("manual_group_label", ""),
        )
        for row in payload["orders"]
    ]

    return depot, vehicles, orders


def validate_input(depot: Depot, vehicles: Sequence[Vehicle], orders: Sequence[Order]) -> None:
    if not vehicles:
        raise ValueError("vehicles cannot be empty")
    if not orders:
        raise ValueError("orders cannot be empty")

    for lat, lng, label in [(depot.lat, depot.lng, "depot")]:
        if not (-90 <= lat <= 90 and -180 <= lng <= 180):
            raise ValueError(f"{label} coordinates are invalid")

    for vehicle in vehicles:
        if vehicle.capacity_kg <= 0:
            raise ValueError(f"vehicle {vehicle.id} has invalid capacity")

    for order in orders:
        if not (-90 <= order.lat <= 90 and -180 <= order.lng <= 180):
            raise ValueError(f"order {order.id} coordinates are invalid")
        if order.demand_kg <= 0:
            raise ValueError(f"order {order.id} has invalid demand_kg")

    total_capacity = sum(v.capacity_kg for v in vehicles)
    total_demand = sum(order.demand_kg for order in orders)
    if total_demand > total_capacity:
        raise ValueError(
            f"total demand {total_demand} kg exceeds total vehicle capacity {total_capacity} kg"
        )


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    radius_km = 6371.0
    d_lat = math.radians(lat2 - lat1)
    d_lng = math.radians(lng2 - lng1)
    a = (
        math.sin(d_lat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(d_lng / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(a))


def build_estimated_matrices(
    depot: Depot, orders: Sequence[Order]
) -> Tuple[List[List[int]], List[List[int]]]:
    locations = [(depot.lat, depot.lng)] + [(order.lat, order.lng) for order in orders]
    distance_matrix: List[List[int]] = []
    duration_matrix: List[List[int]] = []

    for src_lat, src_lng in locations:
        distance_row: List[int] = []
        duration_row: List[int] = []
        for dst_lat, dst_lng in locations:
            km = haversine_km(src_lat, src_lng, dst_lat, dst_lng)
            road_factor = 1.22
            meters = int(round(km * road_factor * 1000))
            hours = (meters / 1000.0) / AVERAGE_CITY_SPEED_KPH if meters else 0
            seconds = int(round(hours * 3600))
            distance_row.append(meters)
            duration_row.append(seconds)
        distance_matrix.append(distance_row)
        duration_matrix.append(duration_row)

    return distance_matrix, duration_matrix


def estimate_area_count(vehicles: Sequence[Vehicle], orders: Sequence[Order]) -> int:
    if not orders:
        return 1
    total_demand = sum(order.demand_kg for order in orders)
    avg_capacity = sum(vehicle.capacity_kg for vehicle in vehicles) / max(len(vehicles), 1)
    demand_based = math.ceil(total_demand / max(avg_capacity * 0.9, 1))
    density_based = max(1, math.ceil(len(orders) / 12))
    return max(1, min(len(vehicles), max(demand_based, density_based)))


def point_in_ring(lng: float, lat: float, ring: Sequence[Sequence[float]]) -> bool:
    inside = False
    if len(ring) < 3:
        return False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, yi = ring[i]
        xj, yj = ring[j]
        intersects = ((yi > lat) != (yj > lat)) and (
            lng < (xj - xi) * (lat - yi) / ((yj - yi) or 1e-12) + xi
        )
        if intersects:
            inside = not inside
        j = i
    return inside


def point_in_polygon(lng: float, lat: float, polygon: Sequence[Sequence[Sequence[float]]]) -> bool:
    if not polygon:
        return False
    if not point_in_ring(lng, lat, polygon[0]):
        return False
    for hole in polygon[1:]:
        if point_in_ring(lng, lat, hole):
            return False
    return True


def point_in_geometry(lng: float, lat: float, geometry: Dict[str, Any]) -> bool:
    geom_type = geometry.get("type")
    coordinates = geometry.get("coordinates", [])
    if geom_type == "Polygon":
        return point_in_polygon(lng, lat, coordinates)
    if geom_type == "MultiPolygon":
        return any(point_in_polygon(lng, lat, polygon) for polygon in coordinates)
    return False


@lru_cache(maxsize=1)
def load_surabaya_district_boundaries() -> List[Dict[str, Any]]:
    boundaries: List[Dict[str, Any]] = []
    if not SURABAYA_BOUNDARY_DIR.exists():
        return boundaries

    for path in sorted(SURABAYA_BOUNDARY_DIR.glob("id3578*.geojson")):
        if path.name == "id3578_kota_surabaya.geojson":
            continue
        data = json.loads(path.read_text(encoding="utf-8"))
        district_name = None
        geometries: List[Dict[str, Any]] = []
        for feature in data.get("features", []):
            properties = feature.get("properties", {})
            district_name = district_name or properties.get("district")
            geometry = feature.get("geometry")
            if geometry:
                geometries.append(geometry)
        if district_name and geometries:
            boundaries.append(
                {
                    "district": district_name.title(),
                    "path": str(path),
                    "geometries": geometries,
                }
            )
    return boundaries


def assign_administrative_areas(
    orders: Sequence[Order],
    district_group_map: Optional[Dict[str, str]] = None,
) -> bool:
    boundaries = load_surabaya_district_boundaries()
    if not boundaries:
        return False

    matched = 0
    zone_ids: Dict[str, int] = {}
    next_area_id = 0
    normalized_map = {
        district.strip().title(): label.strip()
        for district, label in (district_group_map or default_group_mapping()).items()
        if district and label
    }

    for order in orders:
        matched_district = None
        if order.district_override:
            matched_district = order.district_override.title()
        else:
            for boundary in boundaries:
                if any(point_in_geometry(order.lng, order.lat, geometry) for geometry in boundary["geometries"]):
                    matched_district = boundary["district"]
                    break
        if matched_district is None and order.district_label:
            matched_district = order.district_label.title()
        if matched_district is None and order.manual_group_label.strip():
            matched_district = (
                order.district_override.title()
                or order.district_label.title()
                or "Manual"
            )
        if matched_district is None:
            continue
        zone_label = order.manual_group_label.strip() or normalized_map.get(
            matched_district,
            f"Group Z - {matched_district}",
        )
        if zone_label not in zone_ids:
            zone_ids[zone_label] = next_area_id
            next_area_id += 1
        order.area_id = zone_ids[zone_label]
        order.area_label = zone_label
        order.district_label = matched_district
        matched += 1

    return matched > 0


def assign_area_clusters(
    vehicles: Sequence[Vehicle],
    orders: Sequence[Order],
    district_group_map: Optional[Dict[str, str]] = None,
) -> None:
    if assign_administrative_areas(orders, district_group_map=district_group_map):
        return

    cluster_count = estimate_area_count(vehicles, orders)
    if cluster_count <= 1 or len(orders) <= 1:
        for order in orders:
            order.area_id = 0
            order.area_label = "Area 1"
            order.district_label = ""
        return

    centers = [(order.lat, order.lng) for order in orders[:cluster_count]]
    assignments = [0] * len(orders)

    for _ in range(12):
        changed = False
        for idx, order in enumerate(orders):
            best_cluster = min(
                range(cluster_count),
                key=lambda cluster_idx: haversine_km(
                    order.lat,
                    order.lng,
                    centers[cluster_idx][0],
                    centers[cluster_idx][1],
                ),
            )
            if assignments[idx] != best_cluster:
                assignments[idx] = best_cluster
                changed = True

        new_centers = []
        for cluster_idx in range(cluster_count):
            members = [orders[idx] for idx, assigned in enumerate(assignments) if assigned == cluster_idx]
            if not members:
                new_centers.append(centers[cluster_idx])
                continue
            avg_lat = sum(member.lat for member in members) / len(members)
            avg_lng = sum(member.lng for member in members) / len(members)
            new_centers.append((avg_lat, avg_lng))
        centers = new_centers

        if not changed:
            break

    for idx, order in enumerate(orders):
        order.area_id = assignments[idx]
        order.area_label = f"Area {assignments[idx] + 1}"
        order.district_label = ""


def compress_zones_to_vehicle_limit(
    orders: Sequence[Order],
    vehicles: Sequence[Vehicle],
    vehicle_limit: int,
) -> None:
    if vehicle_limit <= 0:
        return

    max_vehicle_capacity = max((vehicle.capacity_kg for vehicle in vehicles), default=1)

    while True:
        zone_groups: Dict[int, List[Order]] = {}
        for order in orders:
            zone_groups.setdefault(order.area_id, []).append(order)

        estimated_vehicle_need = sum(
            max(1, math.ceil(sum(order.demand_kg for order in zone_orders) / max_vehicle_capacity))
            for zone_orders in zone_groups.values()
        )
        allocation_possible = (
            find_vehicle_partition_for_demands(
                [sum(order.demand_kg for order in zone_orders) for zone_orders in zone_groups.values()],
                vehicles,
            )
            is not None
        )

        if len(zone_groups) <= vehicle_limit and estimated_vehicle_need <= vehicle_limit and allocation_possible:
            break

        zone_stats: Dict[int, Dict[str, Any]] = {}
        for area_id, zone_orders in zone_groups.items():
            total_demand = sum(order.demand_kg for order in zone_orders)
            avg_lat = sum(order.lat for order in zone_orders) / len(zone_orders)
            avg_lng = sum(order.lng for order in zone_orders) / len(zone_orders)
            zone_stats[area_id] = {
                "orders": zone_orders,
                "demand": total_demand,
                "lat": avg_lat,
                "lng": avg_lng,
            }

        source_area_id = min(
            zone_stats.keys(),
            key=lambda area_id: (zone_stats[area_id]["demand"], len(zone_stats[area_id]["orders"])),
        )
        target_area_id = min(
            [area_id for area_id in zone_stats.keys() if area_id != source_area_id],
            key=lambda area_id: haversine_km(
                zone_stats[source_area_id]["lat"],
                zone_stats[source_area_id]["lng"],
                zone_stats[area_id]["lat"],
                zone_stats[area_id]["lng"],
            ),
        )

        target_label = zone_groups[target_area_id][0].area_label
        for order in zone_groups[source_area_id]:
            order.area_id = target_area_id
            order.area_label = target_label


def zone_centroid(zone_orders: Sequence[Order]) -> Tuple[float, float]:
    avg_lat = sum(order.lat for order in zone_orders) / len(zone_orders)
    avg_lng = sum(order.lng for order in zone_orders) / len(zone_orders)
    return avg_lat, avg_lng


def zone_radius_km(zone_orders: Sequence[Order]) -> float:
    if len(zone_orders) <= 1:
        return 0.0
    center_lat, center_lng = zone_centroid(zone_orders)
    return max(
        haversine_km(center_lat, center_lng, order.lat, order.lng)
        for order in zone_orders
    )


def split_zone_orders(zone_orders: Sequence[Order]) -> Optional[Tuple[List[Order], List[Order]]]:
    if len(zone_orders) < 4:
        return None

    lat_values = [order.lat for order in zone_orders]
    lng_values = [order.lng for order in zone_orders]
    lat_span = max(lat_values) - min(lat_values)
    lng_span = max(lng_values) - min(lng_values)
    sort_key = (lambda order: order.lat) if lat_span >= lng_span else (lambda order: order.lng)
    ordered = sorted(zone_orders, key=sort_key)
    split_idx = len(ordered) // 2
    left = ordered[:split_idx]
    right = ordered[split_idx:]
    if not left or not right:
        return None
    return left, right


def expand_zones_for_compactness(orders: Sequence[Order], vehicle_limit: int) -> None:
    if vehicle_limit <= 1:
        return

    while True:
        zone_groups: Dict[int, List[Order]] = {}
        for order in orders:
            zone_groups.setdefault(order.area_id, []).append(order)

        if len(zone_groups) >= vehicle_limit:
            break

        candidate_area_id: Optional[int] = None
        candidate_radius = 0.0
        for area_id, zone_orders in zone_groups.items():
            radius_km = zone_radius_km(zone_orders)
            if radius_km > COMPACT_ZONE_RADIUS_KM and radius_km > candidate_radius:
                candidate_area_id = area_id
                candidate_radius = radius_km

        if candidate_area_id is None:
            break

        split_result = split_zone_orders(zone_groups[candidate_area_id])
        if split_result is None:
            break

        left_group, right_group = split_result
        base_label = zone_groups[candidate_area_id][0].area_label
        sibling_count = sum(
            1
            for zone_orders in zone_groups.values()
            if zone_orders and zone_orders[0].area_label.startswith(base_label)
        )
        left_label = f"{base_label} / Core"
        right_label = f"{base_label} / Fringe {sibling_count}"
        new_area_id = max(zone_groups.keys()) + 1

        for order in left_group:
            order.area_id = candidate_area_id
            order.area_label = left_label
        for order in right_group:
            order.area_id = new_area_id
            order.area_label = right_label


def find_vehicle_partition_for_demands(
    zone_demands: Sequence[int],
    vehicles: Sequence[Vehicle],
) -> Optional[List[List[Vehicle]]]:
    if not zone_demands:
        return []

    indexed_vehicles = list(enumerate(vehicles))
    subset_cache: Dict[int, int] = {}
    vehicle_count = len(indexed_vehicles)

    def subset_sum(mask: int) -> int:
        cached = subset_cache.get(mask)
        if cached is not None:
            return cached
        total = 0
        for idx, vehicle in indexed_vehicles:
            if mask & (1 << idx):
                total += vehicle.capacity_kg
        subset_cache[mask] = total
        return total

    zone_order = sorted(
        range(len(zone_demands)),
        key=lambda idx: zone_demands[idx],
        reverse=True,
    )
    sorted_demands = [zone_demands[idx] for idx in zone_order]
    full_mask = (1 << vehicle_count) - 1

    @lru_cache(maxsize=None)
    def assign(zone_idx: int, remaining_mask: int) -> Optional[Tuple[Tuple[int, ...], ...]]:
        if zone_idx == len(sorted_demands):
            return tuple()

        remaining_demand = sum(sorted_demands[zone_idx:])
        if subset_sum(remaining_mask) < remaining_demand:
            return None

        required = sorted_demands[zone_idx]
        available_bits = [bit for bit in range(vehicle_count) if remaining_mask & (1 << bit)]

        candidates: List[int] = []
        for subset_size in range(1, len(available_bits) + 1):
            for combo in combinations(available_bits, subset_size):
                mask = 0
                for bit in combo:
                    mask |= 1 << bit
                total = subset_sum(mask)
                if total >= required:
                    candidates.append(mask)
            if candidates:
                break

        candidates.sort(key=lambda mask: (subset_sum(mask), bin(mask).count("1")))

        for mask in candidates:
            next_result = assign(zone_idx + 1, remaining_mask ^ mask)
            if next_result is not None:
                return ((mask,),) + next_result
        return None

    assigned_masks = assign(0, full_mask)
    if assigned_masks is None:
        return None

    grouped_masks = [0] * len(zone_demands)
    for sorted_idx, wrapped_mask in enumerate(assigned_masks):
        grouped_masks[zone_order[sorted_idx]] = wrapped_mask[0]

    allocations: List[List[Vehicle]] = []
    for mask in grouped_masks:
        group: List[Vehicle] = []
        for idx, vehicle in indexed_vehicles:
            if mask & (1 << idx):
                group.append(vehicle)
        allocations.append(sorted(group, key=lambda vehicle: vehicle.capacity_kg, reverse=True))
    return allocations


def build_ors_matrices(
    depot: Depot,
    orders: Sequence[Order],
    api_key: str,
) -> Tuple[List[List[int]], List[List[int]]]:
    if requests is None:
        raise RuntimeError("requests is required for --use-ors")

    locations = [[depot.lng, depot.lat]] + [[order.lng, order.lat] for order in orders]
    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }
    payload = {
        "locations": locations,
        "metrics": ["distance", "duration"],
        "units": "m",
    }
    response = requests.post(ORS_MATRIX_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()

    distances = [[int(round(cell)) for cell in row] for row in data["distances"]]
    durations = [[int(round(cell)) for cell in row] for row in data["durations"]]
    return distances, durations


def build_ors_route_geometry(
    depot: Depot,
    route: Dict[str, Any],
    api_key: str,
) -> Optional[List[List[float]]]:
    if requests is None:
        return None
    if not route.get("stops"):
        return None

    coordinates = [[depot.lng, depot.lat]]
    for stop in route["stops"]:
        coordinates.append([stop["lng"], stop["lat"]])
    coordinates.append([depot.lng, depot.lat])

    headers = {
        "Authorization": api_key,
        "Content-Type": "application/json",
    }
    payload = {"coordinates": coordinates}
    response = requests.post(ORS_DIRECTIONS_URL, headers=headers, json=payload, timeout=60)
    response.raise_for_status()
    data = response.json()
    features = data.get("features") or []
    if not features:
        return None
    geometry = features[0].get("geometry", {})
    if geometry.get("type") != "LineString":
        return None
    return [[lat, lng] for lng, lat in geometry.get("coordinates", [])]


def attach_ors_geometries(
    depot: Depot,
    result: Dict[str, Any],
    use_ors: bool,
    ors_api_key: Optional[str],
) -> None:
    if not use_ors or not ors_api_key:
        return

    for route in result.get("routes", []):
        try:
            geometry = build_ors_route_geometry(depot, route, ors_api_key)
        except Exception:
            geometry = None
        if geometry:
            route["geometry"] = geometry


def select_matrices(
    depot: Depot,
    orders: Sequence[Order],
    use_ors: bool,
    ors_api_key: Optional[str],
) -> Tuple[List[List[int]], List[List[int]], str]:
    if use_ors:
        if not ors_api_key:
            raise ValueError("--use-ors requires --ors-api-key or ORS_API_KEY")
        distances, durations = build_ors_matrices(depot, orders, ors_api_key)
        return distances, durations, "openrouteservice"

    distances, durations = build_estimated_matrices(depot, orders)
    return distances, durations, "estimated_haversine"


def solve_with_ortools(
    depot: Depot,
    vehicles: Sequence[Vehicle],
    orders: Sequence[Order],
    distances: List[List[int]],
    durations: List[List[int]],
) -> Dict[str, Any]:
    if pywrapcp is None or routing_enums_pb2 is None:
        raise RuntimeError("ortools is not installed")

    manager = pywrapcp.RoutingIndexManager(len(orders) + 1, len(vehicles), 0)
    routing = pywrapcp.RoutingModel(manager)
    demands = [0] + [order.demand_kg for order in orders]
    service_seconds = [0] + [order.service_minutes * 60 for order in orders]

    def transit_callback(from_index: int, to_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        to_node = manager.IndexToNode(to_index)
        return durations[from_node][to_node] + service_seconds[from_node]

    transit_callback_index = routing.RegisterTransitCallback(transit_callback)
    routing.SetArcCostEvaluatorOfAllVehicles(transit_callback_index)

    def demand_callback(from_index: int) -> int:
        from_node = manager.IndexToNode(from_index)
        return demands[from_node]

    demand_callback_index = routing.RegisterUnaryTransitCallback(demand_callback)
    routing.AddDimensionWithVehicleCapacity(
        demand_callback_index,
        0,
        [vehicle.capacity_kg for vehicle in vehicles],
        True,
        "Capacity",
    )

    for idx, vehicle in enumerate(vehicles):
        routing.SetFixedCostOfVehicle(30_000, idx)
        if vehicle.max_stops is not None:
            routing.AddConstantDimension(1, vehicle.max_stops + 1, True, f"Stops_{idx}")

    search_params = pywrapcp.DefaultRoutingSearchParameters()
    search_params.first_solution_strategy = (
        routing_enums_pb2.FirstSolutionStrategy.PATH_CHEAPEST_ARC
    )
    search_params.local_search_metaheuristic = (
        routing_enums_pb2.LocalSearchMetaheuristic.GUIDED_LOCAL_SEARCH
    )
    search_params.time_limit.seconds = 10

    solution = routing.SolveWithParameters(search_params)
    if solution is None:
        raise RuntimeError("no feasible route found with OR-Tools")

    routes = []
    total_distance_m = 0
    total_duration_s = 0
    used_vehicle_count = 0

    for vehicle_idx, vehicle in enumerate(vehicles):
        index = routing.Start(vehicle_idx)
        route_distance_m = 0
        route_duration_s = 0
        route_load_kg = 0
        stop_ids: List[str] = []
        stop_names: List[str] = []
        route_stops: List[Dict[str, Any]] = []
        path = [depot.name]

        prev_node = 0  # Start from depot
        while not routing.IsEnd(index):
            node = manager.IndexToNode(index)
            next_index = solution.Value(routing.NextVar(index))
            next_node = manager.IndexToNode(next_index)

            if node != 0:
                order = orders[node - 1]
                route_load_kg += order.demand_kg
                stop_ids.append(order.id)
                stop_names.append(order.name)

                # Calculate distance and time FROM previous location TO this stop
                travel_from_prev_m = distances[prev_node][node]
                travel_from_prev_s = durations[prev_node][node]

                # Calculate distance and time to next stop
                segment_distance_m = distances[node][next_node]
                segment_duration_s = durations[node][next_node]

                route_stops.append(
                    {
                        "id": order.id,
                        "name": order.name,
                        "lat": order.lat,
                        "lng": order.lng,
                        "demand_kg": order.demand_kg,
                        "service_minutes": order.service_minutes,
                        "distance_to_next_km": round(segment_distance_m / 1000, 2),
                        "time_to_next_min": round(segment_duration_s / 60, 1),
                        "distance_from_prev_km": round(travel_from_prev_m / 1000, 2),
                        "time_from_prev_min": round(travel_from_prev_s / 60, 1),
                    }
                )
                prev_node = node

            if not routing.IsEnd(next_index):
                path.append(orders[next_node - 1].name)
            else:
                path.append(depot.name)

            route_distance_m += distances[node][next_node]
            route_duration_s += durations[node][next_node]
            if node != 0:
                route_duration_s += orders[node - 1].service_minutes * 60
            index = next_index

        if stop_ids:
            used_vehicle_count += 1
            total_distance_m += route_distance_m
            total_duration_s += route_duration_s
            routes.append(
                {
                    "vehicle_id": vehicle.id,
                    "capacity_kg": vehicle.capacity_kg,
                    "load_kg": route_load_kg,
                    "utilization_pct": round((route_load_kg / vehicle.capacity_kg) * 100, 2),
                    "stop_count": len(stop_ids),
                    "distance_km": round(route_distance_m / 1000, 2),
                    "duration_minutes": round(route_duration_s / 60, 1),
                    "stop_ids": stop_ids,
                    "stop_names": stop_names,
                    "stops": route_stops,
                    "path": path,
                }
            )

    return {
        "solver_used": "ortools",
        "recommended_vehicle_count": used_vehicle_count,
        "total_distance_km": round(total_distance_m / 1000, 2),
        "total_duration_minutes": round(total_duration_s / 60, 1),
        "unassigned_order_ids": [],
        "routes": routes,
    }


def improve_route_order(
    stop_nodes: Sequence[int],
    distances: List[List[int]],
) -> List[int]:
    if len(stop_nodes) <= 2:
        return list(stop_nodes)

    unvisited = set(stop_nodes)
    ordered: List[int] = []
    current = 0

    while unvisited:
        next_node = min(unvisited, key=lambda node: distances[current][node])
        ordered.append(next_node)
        unvisited.remove(next_node)
        current = next_node

    improved = ordered[:]
    changed = True
    while changed:
        changed = False
        for i in range(len(improved) - 1):
            for j in range(i + 2, len(improved)):
                a = 0 if i == 0 else improved[i - 1]
                b = improved[i]
                c = improved[j]
                d = 0 if j == len(improved) - 1 else improved[j + 1]
                current_cost = distances[a][b] + distances[c][d]
                swapped_cost = distances[a][c] + distances[b][d]
                if swapped_cost < current_cost:
                    improved[i : j + 1] = reversed(improved[i : j + 1])
                    changed = True
        ordered = improved[:]

    return improved


def solve_zone_greedy(
    depot: Depot,
    vehicles: Sequence[Vehicle],
    orders: Sequence[Order],
    distances: List[List[int]],
    durations: List[List[int]],
) -> Dict[str, Any]:
    remaining = [
        {
            "vehicle": vehicle,
            "remaining_kg": vehicle.capacity_kg,
            "stops": [],
            "current_node": 0,
        }
        for vehicle in vehicles
    ]
    active_vehicle_count = 1 if remaining else 0

    def slot_utilization_pct(slot: Dict[str, Any]) -> float:
        vehicle = slot["vehicle"]
        used = vehicle.capacity_kg - slot["remaining_kg"]
        return (used / vehicle.capacity_kg) * 100 if vehicle.capacity_kg else 0.0

    def eligible_slots(slots: Sequence[Dict[str, Any]], node_idx: int, order: Order) -> List[Dict[str, Any]]:
        return [
            slot
            for slot in slots
            if slot["remaining_kg"] >= order.demand_kg
            and (
                slot["vehicle"].max_stops is None
                or len(slot["stops"]) < slot["vehicle"].max_stops
            )
        ]

    sorted_orders = sorted(
        enumerate(orders, start=1),
        key=lambda item: (-item[1].demand_kg, -item[1].priority),
    )
    unassigned: List[str] = []

    for node_idx, order in sorted_orders:
        while True:
            open_slots = remaining[:active_vehicle_count]
            candidates = eligible_slots(open_slots, node_idx, order)
            if candidates:
                break
            if active_vehicle_count < len(remaining):
                active_vehicle_count += 1
                continue
            candidates = []
            break

        if not candidates:
            unassigned.append(order.id)
            continue

        not_full_yet = [
            slot
            for slot in candidates
            if slot_utilization_pct(slot) < GREEDY_FILL_THRESHOLD_PCT
        ]
        if not_full_yet:
            candidates = not_full_yet

        best_slot = min(
            candidates,
            key=lambda slot: distances[slot["current_node"]][node_idx],
        )
        best_slot["stops"].append((node_idx, order))
        best_slot["remaining_kg"] -= order.demand_kg
        best_slot["current_node"] = node_idx

        while active_vehicle_count < len(remaining):
            current_last_slot = remaining[active_vehicle_count - 1]
            if slot_utilization_pct(current_last_slot) >= GREEDY_FILL_THRESHOLD_PCT:
                active_vehicle_count += 1
            else:
                break

    if unassigned:
        raise RuntimeError(
            f"greedy solver could not assign all orders: {', '.join(unassigned)}"
        )

    routes = []
    total_distance_m = 0
    total_duration_s = 0

    for slot in remaining:
        if not slot["stops"]:
            continue

        vehicle = slot["vehicle"]
        stop_lookup = {node_idx: order for node_idx, order in slot["stops"]}
        ordered_stop_nodes = improve_route_order(list(stop_lookup.keys()), distances)
        route_nodes = [0] + ordered_stop_nodes + [0]
        route_distance_m = 0
        route_duration_s = 0
        route_load_kg = 0
        stop_ids = []
        stop_names = []
        route_stops = []
        path = [depot.name]

        for idx in range(len(route_nodes) - 1):
            src = route_nodes[idx]
            dst = route_nodes[idx + 1]
            route_distance_m += distances[src][dst]
            route_duration_s += durations[src][dst]
            if src != 0:
                route_duration_s += orders[src - 1].service_minutes * 60

        for idx, node_idx in enumerate(ordered_stop_nodes):
            order = stop_lookup[node_idx]
            route_load_kg += order.demand_kg
            stop_ids.append(order.id)
            stop_names.append(order.name)

            # Calculate distance and time FROM previous location TO this stop
            prev_node = ordered_stop_nodes[idx - 1] if idx > 0 else 0
            travel_from_prev_m = distances[prev_node][node_idx]
            travel_from_prev_s = durations[prev_node][node_idx]

            # Calculate distance and time to next stop
            next_node = ordered_stop_nodes[idx + 1] if idx + 1 < len(ordered_stop_nodes) else 0
            segment_distance_m = distances[node_idx][next_node]
            segment_duration_s = durations[node_idx][next_node]

            route_stops.append(
                {
                    "id": order.id,
                    "name": order.name,
                    "lat": order.lat,
                    "lng": order.lng,
                    "demand_kg": order.demand_kg,
                    "service_minutes": order.service_minutes,
                    "district_label": order.district_label,
                    "area_label": order.area_label,
                    "distance_to_next_km": round(segment_distance_m / 1000, 2),
                    "time_to_next_min": round(segment_duration_s / 60, 1),
                    "distance_from_prev_km": round(travel_from_prev_m / 1000, 2),
                    "time_from_prev_min": round(travel_from_prev_s / 60, 1),
                }
            )
            path.append(order.name)
        path.append(depot.name)

        total_distance_m += route_distance_m
        total_duration_s += route_duration_s
        routes.append(
            {
                "vehicle_id": vehicle.id,
                "area_id": orders[0].area_id if orders else 0,
                "area_label": orders[0].area_label if orders else "Area 1",
                "capacity_kg": vehicle.capacity_kg,
                "load_kg": route_load_kg,
                "utilization_pct": round((route_load_kg / vehicle.capacity_kg) * 100, 2),
                "stop_count": len(stop_ids),
                "distance_km": round(route_distance_m / 1000, 2),
                "duration_minutes": round(route_duration_s / 60, 1),
                "stop_ids": stop_ids,
                "stop_names": stop_names,
                "stops": route_stops,
                "path": path,
                "districts": sorted(
                    {order.district_label for order in stop_lookup.values() if order.district_label}
                ),
            }
        )

    return {
        "solver_used": f"greedy_fill_{GREEDY_FILL_THRESHOLD_PCT}",
        "recommended_vehicle_count": len(routes),
        "total_distance_km": round(total_distance_m / 1000, 2),
        "total_duration_minutes": round(total_duration_s / 60, 1),
        "unassigned_order_ids": [],
        "routes": routes,
    }


def solve_with_greedy(
    depot: Depot,
    vehicles: Sequence[Vehicle],
    orders: Sequence[Order],
    distances: List[List[int]],
    durations: List[List[int]],
) -> Dict[str, Any]:
    if not orders:
        return {
            "solver_used": f"greedy_fill_{GREEDY_FILL_THRESHOLD_PCT}",
            "recommended_vehicle_count": 0,
            "total_distance_km": 0.0,
            "total_duration_minutes": 0.0,
            "unassigned_order_ids": [],
            "routes": [],
        }

    compress_zones_to_vehicle_limit(orders, vehicles, len(vehicles))
    expand_zones_for_compactness(orders, len(vehicles))

    zone_groups: Dict[int, List[Order]] = {}
    for order in orders:
        zone_groups.setdefault(order.area_id, []).append(order)

    ordered_zones = sorted(
        zone_groups.items(),
        key=lambda item: sum(order.demand_kg for order in item[1]),
        reverse=True,
    )

    zone_demands = [sum(order.demand_kg for order in zone_orders) for _, zone_orders in ordered_zones]
    partition = find_vehicle_partition_for_demands(zone_demands, vehicles)
    if partition is None:
        raise RuntimeError("vehicle allocation failed after zone compression")
    zone_allocations: List[Tuple[List[Order], List[Vehicle]]] = [
        (zone_orders, partition[idx]) for idx, (_, zone_orders) in enumerate(ordered_zones)
    ]

    combined_routes: List[Dict[str, Any]] = []
    total_distance_km = 0.0
    total_duration_minutes = 0.0
    used_vehicle_count = 0

    for zone_orders, allocated in zone_allocations:
        zone_demand = sum(order.demand_kg for order in zone_orders)
        capacity_acc = sum(vehicle.capacity_kg for vehicle in allocated)

        if capacity_acc < zone_demand:
            raise RuntimeError(
                f"zone {zone_orders[0].area_label} demand {zone_demand} kg exceeds available vehicle capacity"
            )

        zone_order_ids = {order.id for order in zone_orders}
        zone_node_indexes = [
            idx
            for idx, order in enumerate(orders, start=1)
            if order.id in zone_order_ids
        ]
        sub_orders = [orders[idx - 1] for idx in zone_node_indexes]
        node_map = [0] + zone_node_indexes

        sub_distances = [[distances[src][dst] for dst in node_map] for src in node_map]
        sub_durations = [[durations[src][dst] for dst in node_map] for src in node_map]

        zone_result = solve_zone_greedy(
            depot=depot,
            vehicles=allocated,
            orders=sub_orders,
            distances=sub_distances,
            durations=sub_durations,
        )
        combined_routes.extend(zone_result["routes"])
        total_distance_km += zone_result["total_distance_km"]
        total_duration_minutes += zone_result["total_duration_minutes"]
        used_vehicle_count += zone_result["recommended_vehicle_count"]

    return {
        "solver_used": f"greedy_fill_{GREEDY_FILL_THRESHOLD_PCT}_zoned",
        "recommended_vehicle_count": used_vehicle_count,
        "total_distance_km": round(total_distance_km, 2),
        "total_duration_minutes": round(total_duration_minutes, 1),
        "unassigned_order_ids": [],
        "routes": combined_routes,
    }


def run_solver(
    depot: Depot,
    vehicles: Sequence[Vehicle],
    orders: Sequence[Order],
    distances: List[List[int]],
    durations: List[List[int]],
    solver_choice: str,
) -> Dict[str, Any]:
    if solver_choice == "ortools":
        return solve_with_ortools(depot, vehicles, orders, distances, durations)
    if solver_choice == "greedy":
        return solve_with_greedy(depot, vehicles, orders, distances, durations)

    if pywrapcp is not None and routing_enums_pb2 is not None:
        return solve_with_ortools(depot, vehicles, orders, distances, durations)
    return solve_with_greedy(depot, vehicles, orders, distances, durations)


def summarize_result(result: Dict[str, Any], source: str, order_count: int) -> str:
    lines = [
        f"Matrix source: {source}",
        f"Solver used: {result['solver_used']}",
        f"Orders planned: {order_count}",
        f"Recommended vehicles used: {result['recommended_vehicle_count']}",
        f"Total distance: {result['total_distance_km']} km",
        f"Total duration: {result['total_duration_minutes']} minutes",
        "",
    ]
    for route in result["routes"]:
        districts = route.get("districts") or []
        lines.append(
            (
                f"{route['vehicle_id']} ({route.get('area_label', 'Area 1')}): "
                f"load {route['load_kg']}/{route['capacity_kg']} kg "
                f"({route['utilization_pct']}%), stops {route['stop_count']}, "
                f"distance {route['distance_km']} km, duration {route['duration_minutes']} min"
            )
        )
        if districts:
            lines.append("  Kecamatan: " + ", ".join(districts))
        lines.append("  " + " -> ".join(route["path"]))
    return "\n".join(lines)


def build_group_summary(routes: Sequence[Dict[str, Any]]) -> List[Dict[str, Any]]:
    summary: Dict[str, Dict[str, Any]] = {}
    for route in routes:
        area_label = route.get("area_label", "Area 1")
        entry = summary.setdefault(
            area_label,
            {
                "group_label": area_label,
                "vehicle_count": 0,
                "order_count": 0,
                "load_kg": 0,
                "distance_km": 0.0,
                "duration_minutes": 0.0,
                "districts": set(),
                "vehicles": [],
            },
        )
        entry["vehicle_count"] += 1
        entry["order_count"] += int(route.get("stop_count", 0))
        entry["load_kg"] += int(route.get("load_kg", 0))
        entry["distance_km"] += float(route.get("distance_km", 0.0))
        entry["duration_minutes"] += float(route.get("duration_minutes", 0.0))
        entry["districts"].update(route.get("districts") or [])
        entry["vehicles"].append(route.get("vehicle_id", "-"))

    result = []
    for area_label in sorted(summary.keys()):
        entry = summary[area_label]
        result.append(
            {
                "group_label": area_label,
                "vehicle_count": entry["vehicle_count"],
                "order_count": entry["order_count"],
                "load_kg": entry["load_kg"],
                "distance_km": round(entry["distance_km"], 2),
                "duration_minutes": round(entry["duration_minutes"], 1),
                "districts": sorted(entry["districts"]),
                "vehicles": entry["vehicles"],
            }
        )
    return result


def plan_routes(
    payload: Dict[str, Any],
    solver_choice: str = "auto",
    use_ors: bool = False,
    ors_api_key: Optional[str] = None,
    district_group_map: Optional[Dict[str, str]] = None,
) -> Dict[str, Any]:
    depot, vehicles, orders = load_payload(payload)
    validate_input(depot, vehicles, orders)
    assign_area_clusters(vehicles, orders, district_group_map=district_group_map)
    distances, durations, matrix_source = select_matrices(
        depot,
        orders,
        use_ors=use_ors,
        ors_api_key=ors_api_key,
    )
    result = run_solver(
        depot=depot,
        vehicles=vehicles,
        orders=orders,
        distances=distances,
        durations=durations,
        solver_choice=solver_choice,
    )
    attach_ors_geometries(
        depot=depot,
        result=result,
        use_ors=use_ors,
        ors_api_key=ors_api_key,
    )
    return {
        "matrix_source": matrix_source,
        "depot": {
            "name": depot.name,
            "lat": depot.lat,
            "lng": depot.lng,
        },
        "summary": {
            "orders_planned": len(orders),
            "recommended_vehicle_count": result["recommended_vehicle_count"],
            "total_distance_km": result["total_distance_km"],
            "total_duration_minutes": result["total_duration_minutes"],
            "solver_used": result["solver_used"],
        },
        "group_summary": build_group_summary(result["routes"]),
        "routes": result["routes"],
        "text_summary": summarize_result(result, matrix_source, len(orders)),
    }


def main() -> int:
    args = parse_args()
    try:
        with open(args.input, "r", encoding="utf-8") as fh:
            payload = json.load(fh)
        output = plan_routes(
            payload,
            solver_choice=args.solver,
            use_ors=args.use_ors,
            ors_api_key=args.ors_api_key,
        )
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(output["text_summary"])

    if args.output:
        with open(args.output, "w", encoding="utf-8") as fh:
            json.dump(output, fh, indent=2)
        print(f"\nSaved result to {args.output}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
