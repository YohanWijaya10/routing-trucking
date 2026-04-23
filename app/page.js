"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

const LeafletMap = dynamic(() => import("../components/LeafletMap"), { ssr: false });

const groupColorMap = {
  "Group A": "#0f7b6c",
  "Group B": "#dc2626",
  "Group C": "#2563eb",
  "Group D": "#7c3aed",
  "Group E": "#f59e0b",
  "Group X": "#db2777",
  "Group Y": "#14b8a6",
  "Group Z": "#475569",
};

const fallbackColorPalette = ["#0f7b6c", "#dc2626", "#2563eb", "#7c3aed", "#f59e0b", "#db2777", "#14b8a6", "#475569"];

function colorForGroup(groupLabel) {
  const label = groupLabel || "default";
  const prefix = Object.keys(groupColorMap).find((key) => label.startsWith(key));
  if (prefix) return groupColorMap[prefix];
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  return fallbackColorPalette[Math.abs(hash) % fallbackColorPalette.length];
}

const emptySummary = {
  recommended_vehicle_count: "-",
  total_distance_km: "-",
  total_duration_minutes: "-",
  orders_planned: "-",
  solver_used: "Auto",
};

export default function Page() {
  const [payload, setPayload] = useState(null);
  const [districts, setDistricts] = useState([]);
  const [districtGroupMap, setDistrictGroupMap] = useState({});
  const [defaultDistrictGroupMap, setDefaultDistrictGroupMap] = useState({});
  const [solver, setSolver] = useState("auto");
  const [status, setStatus] = useState({ state: "idle", label: "Idle" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [result, setResult] = useState({
    depot: null,
    summary: emptySummary,
    group_summary: [],
    routes: [],
    text_summary: "Belum ada hasil.",
    matrix_source: "Estimated",
  });

  useEffect(() => {
    async function boot() {
      const [sampleRes, groupRes] = await Promise.all([
        fetch("/api/sample"),
        fetch("/api/group-config"),
      ]);
      const sample = await sampleRes.json();
      const groupConfig = await groupRes.json();
      if (!sampleRes.ok) throw new Error(sample.error || "Failed to load sample");
      if (!groupRes.ok) throw new Error(groupConfig.error || "Failed to load group config");
      setPayload(sample);
      setDistricts(groupConfig.districts || []);
      setDistrictGroupMap(groupConfig.mapping || {});
      setDefaultDistrictGroupMap(groupConfig.mapping || {});
    }

    boot()
      .then(() => setStatus({ state: "idle", label: "Idle" }))
      .catch((err) => {
        setStatus({ state: "error", label: "Error" });
        setError(err.message);
      });
  }, []);

  const depot = payload?.depot || { name: "Gudang Surabaya", lat: -7.2575, lng: 112.7521 };
  const vehicles = payload?.vehicles || [];
  const orders = payload?.orders || [];

  const matrixBadge = useMemo(() => result.matrix_source || "Estimated", [result.matrix_source]);

  function updateDepot(key, value) {
    setPayload((current) => ({ ...current, depot: { ...current.depot, [key]: value } }));
  }

  function updateVehicle(index, key, value) {
    setPayload((current) => ({
      ...current,
      vehicles: current.vehicles.map((vehicle, idx) =>
        idx === index ? { ...vehicle, [key]: value } : vehicle
      ),
    }));
  }

  function updateOrder(index, key, value) {
    setPayload((current) => ({
      ...current,
      orders: current.orders.map((order, idx) => (idx === index ? { ...order, [key]: value } : order)),
    }));
  }

  function addVehicle() {
    setPayload((current) => ({
      ...current,
      vehicles: [...current.vehicles, { id: "", capacity_kg: "", max_stops: "" }],
    }));
  }

  function removeVehicle(index) {
    setPayload((current) => ({
      ...current,
      vehicles: current.vehicles.filter((_, idx) => idx !== index),
    }));
  }

  function addOrder() {
    setPayload((current) => ({
      ...current,
      orders: [
        ...current.orders,
        { id: "", name: "", lat: "", lng: "", demand_kg: "", service_minutes: 12 },
      ],
    }));
  }

  function removeOrder(index) {
    setPayload((current) => ({
      ...current,
      orders: current.orders.filter((_, idx) => idx !== index),
    }));
  }

  async function loadDummyOrders() {
    setError("");
    setInfo("");
    setStatus({ state: "loading", label: "Loading" });
    const databaseUrl = document.getElementById("databaseUrl")?.value?.trim();
    const city = document.getElementById("cityName")?.value?.trim() || "surabaya";
    const limit = Number(document.getElementById("dummyCount")?.value || 100);

    const response = await fetch("/api/dummy-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database_url: databaseUrl,
        city,
        limit,
        vehicles,
        depot_name: depot.name,
        depot_lat: Number(depot.lat),
        depot_lng: Number(depot.lng),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus({ state: "error", label: "Error" });
      setError(data.error || "Failed to generate dummy orders");
      return;
    }
    setPayload(data.payload);
    setStatus({ state: "success", label: `Dummy ${data.customer_count}` });
    setInfo(`Dummy ready: demand ${data.total_dummy_demand_kg} kg / capacity ${data.total_capacity_kg} kg`);
  }

  async function generatePlan() {
    setError("");
    setInfo("");
    setStatus({ state: "loading", label: "Planning" });

    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload,
        solver,
        use_ors: true,
        ors_api_key: document.getElementById("orsApiKey")?.value?.trim() || undefined,
        district_group_map: districtGroupMap,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus({ state: "error", label: "Error" });
      setError(data.error || "Planning failed");
      return;
    }
    setResult(data);
    setStatus({ state: "success", label: "Ready" });
  }

  if (!payload) {
    return <main className="loading-shell">Loading...</main>;
  }

  return (
    <main className="shell">
      <section className="topbar">
        <div className="brandblock">
          <p className="eyebrow">Dispatch Lab</p>
          <h1>Route Planner</h1>
        </div>
        <div className="topbar-meta">
          <div className="top-metric">
            <span>Solver</span>
            <strong>{result.summary.solver_used || "Auto"}</strong>
          </div>
          <div className="top-metric">
            <span>Matrix</span>
            <strong>{matrixBadge}</strong>
          </div>
          <button className="ghost small" onClick={() => location.reload()}>Reload</button>
          <button className="ghost small" onClick={loadDummyOrders}>Dummy 100</button>
          <button className="small" onClick={generatePlan}>Generate</button>
        </div>
      </section>

      <section className="grid-two">
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Input</p>
              <h3>Planner Config</h3>
            </div>
          </div>

          <div className="planner-form">
            <div className="field-row">
              <label>
                <span>Depot Name</span>
                <input value={depot.name} onChange={(e) => updateDepot("name", e.target.value)} />
              </label>
              <label>
                <span>Solver</span>
                <select value={solver} onChange={(e) => setSolver(e.target.value)}>
                  <option value="auto">Auto</option>
                  <option value="ortools">OR-Tools</option>
                  <option value="greedy">Greedy</option>
                </select>
              </label>
            </div>

            <div className="field-row three">
              <label>
                <span>Depot Lat</span>
                <input value={depot.lat} onChange={(e) => updateDepot("lat", e.target.value)} />
              </label>
              <label>
                <span>Depot Lng</span>
                <input value={depot.lng} onChange={(e) => updateDepot("lng", e.target.value)} />
              </label>
              <label>
                <span>ORS API Key</span>
                <input id="orsApiKey" placeholder="Opsional" />
              </label>
            </div>

            <div className="field-row db-row">
              <label>
                <span>Database URL</span>
                <input id="databaseUrl" placeholder="postgresql://..." />
              </label>
              <label>
                <span>City</span>
                <input id="cityName" defaultValue="surabaya" />
              </label>
              <label>
                <span>Dummy Count</span>
                <input id="dummyCount" type="number" min="1" max="500" defaultValue="100" />
              </label>
            </div>

            <div className="subsection">
              <div className="subsection-head">
                <h4>Vehicles</h4>
                <button type="button" className="ghost small" onClick={addVehicle}>Tambah</button>
              </div>
              <div className="table-list">
                {vehicles.map((vehicle, index) => (
                  <div key={`vehicle-${index}`} className="table-row vehicle-row">
                    <input value={vehicle.id ?? ""} onChange={(e) => updateVehicle(index, "id", e.target.value)} />
                    <input value={vehicle.capacity_kg ?? ""} onChange={(e) => updateVehicle(index, "capacity_kg", e.target.value)} />
                    <input value={vehicle.max_stops ?? ""} onChange={(e) => updateVehicle(index, "max_stops", e.target.value)} placeholder="Stops" />
                    <button type="button" className="ghost small" onClick={() => removeVehicle(index)}>Hapus</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="subsection">
              <div className="subsection-head">
                <h4>Orders</h4>
                <button type="button" className="ghost small" onClick={addOrder}>Tambah</button>
              </div>
              <div className="table-list">
                {orders.map((order, index) => (
                  <div key={`order-${index}`} className="table-row order-row">
                    <input value={order.id ?? ""} onChange={(e) => updateOrder(index, "id", e.target.value)} />
                    <input value={order.name ?? ""} onChange={(e) => updateOrder(index, "name", e.target.value)} />
                    <input value={order.lat ?? ""} onChange={(e) => updateOrder(index, "lat", e.target.value)} />
                    <input value={order.lng ?? ""} onChange={(e) => updateOrder(index, "lng", e.target.value)} />
                    <input value={order.demand_kg ?? ""} onChange={(e) => updateOrder(index, "demand_kg", e.target.value)} />
                    <input value={order.service_minutes ?? ""} onChange={(e) => updateOrder(index, "service_minutes", e.target.value)} />
                    <button type="button" className="ghost small" onClick={() => removeOrder(index)}>Hapus</button>
                  </div>
                ))}
              </div>
            </div>

            <div className="subsection">
              <div className="subsection-head">
                <h4>Group Mapping</h4>
                <button
                  type="button"
                  className="ghost small"
                  onClick={() => setDistrictGroupMap(defaultDistrictGroupMap)}
                >
                  Reset
                </button>
              </div>
              <div className="table-list">
                {districts.map((district) => (
                  <div key={district} className="table-row district-group-row">
                    <input value={district} readOnly className="district-name" />
                    <input
                      value={districtGroupMap[district] || ""}
                      onChange={(e) =>
                        setDistrictGroupMap((current) => ({
                          ...current,
                          [district]: e.target.value,
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="panel results">
          <div className="panel-header">
            <div>
              <p className="section-kicker">Output</p>
              <h3>Dispatch Result</h3>
            </div>
            <div className={`status-pill ${status.state}`}>{status.label}</div>
          </div>

          <div className="summary-grid">
            <div className="summary-item">
              <span>Vehicles</span>
              <strong>{result.summary.recommended_vehicle_count}</strong>
            </div>
            <div className="summary-item">
              <span>Distance</span>
              <strong>{result.summary.total_distance_km} km</strong>
            </div>
            <div className="summary-item">
              <span>Duration</span>
              <strong>{result.summary.total_duration_minutes} min</strong>
            </div>
            <div className="summary-item">
              <span>Orders</span>
              <strong>{result.summary.orders_planned}</strong>
            </div>
          </div>

          {error ? <div className="error-box">{error}</div> : null}
          {info ? <div className="error-box info">{info}</div> : null}

          <div className="result-block">
            <h4>Groups</h4>
            <div className="groups-list">
              {result.group_summary.length ? result.group_summary.map((group) => (
                <article className="group-card" key={group.group_label}>
                  <div className="group-head">
                    <h5>{group.group_label}</h5>
                    <strong>{group.load_kg} kg</strong>
                  </div>
                  <div className="group-meta">
                    <span>{group.vehicle_count} truck</span>
                    <span>{group.order_count} order</span>
                    <span>{group.distance_km} km</span>
                    <span>{group.duration_minutes} min</span>
                  </div>
                  <div className="group-note">Kecamatan: {group.districts.join(", ")}</div>
                </article>
              )) : <p className="muted">Belum ada grup.</p>}
            </div>
          </div>

          <div className="result-block">
            <h4>Summary</h4>
            <pre className="code-box">{result.text_summary}</pre>
          </div>

          <div className="result-block">
            <h4>Routes</h4>
            <div className="routes-list">
              {result.routes.length ? result.routes.map((route, index) => (
                <article className="route-card" key={`${route.vehicle_id}-${index}`}>
                  <div className="route-head">
                    <h5>{route.vehicle_id}</h5>
                    <strong>{route.load_kg}/{route.capacity_kg} kg</strong>
                  </div>
                  <div className="route-meta">
                    <span>{route.area_label || "Area 1"}</span>
                    <span>Utilization {route.utilization_pct}%</span>
                    <span>{route.stop_count} stop</span>
                    <span>{route.distance_km} km</span>
                    <span>{route.duration_minutes} min</span>
                  </div>
                  <div className="group-note">Kecamatan: {(route.districts || []).join(", ")}</div>
                  <div className="path">{route.path.join(" -> ")}</div>
                </article>
              )) : <p className="muted">Belum ada rute.</p>}
            </div>
          </div>

          <div className="result-block">
            <h4>Map</h4>
            <LeafletMap depot={result.depot || depot} routes={result.routes} colorForGroup={colorForGroup} />
          </div>
        </section>
      </section>
    </main>
  );
}
