"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState, useCallback } from "react";

const LeafletMap = dynamic(() => import("../components/LeafletMap"), { ssr: false });

const TRUCK_COLORS = [
  "#1a73e8", "#ea4335", "#fbbc04", "#34a853",
  "#9334e6", "#ff6d00", "#00bcd4", "#e91e63",
  "#795548", "#607d8b", "#9c27b0", "#3f51b5"
];

function getTruckColor(index) {
  return TRUCK_COLORS[index % TRUCK_COLORS.length];
}

export default function Page() {
  // ── State ──
  const [payload, setPayload] = useState(null);
  const [appConfig, setAppConfig] = useState({
    databaseConfigured: false,
    defaultCity: "surabaya",
    defaultDummyCount: 100,
    orsApiKeyConfigured: false,
  });
  const [dbConfig, setDbConfig] = useState({
    databaseUrl: "",
    city: "surabaya",
    dummyCount: 100,
    orsApiKey: "",
  });
  const [solver, setSolver] = useState("auto");
  const [status, setStatus] = useState({ state: "idle", label: "Siap" });
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [result, setResult] = useState(null);
  const [activePanel, setActivePanel] = useState("customers"); // customers | trucks | routes
  const [selectedOrders, setSelectedOrders] = useState(new Set());
  const [truckAssignments, setTruckAssignments] = useState({}); // orderId -> truckIndex
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterDistrict, setFilterDistrict] = useState("");
  const [showRouteResult, setShowRouteResult] = useState(false);

  // ── Boot ──
  useEffect(() => {
    async function boot() {
      const [sampleRes, appConfigRes] = await Promise.all([
        fetch("/api/sample"),
        fetch("/api/app-config"),
      ]);
      const sample = await sampleRes.json();
      const runtimeConfig = await appConfigRes.json();
      if (!sampleRes.ok) throw new Error(sample.error || "Gagal load sample");
      if (!appConfigRes.ok) throw new Error(runtimeConfig.error || "Gagal load config");
      setPayload(sample);
      setAppConfig(runtimeConfig);
      setDbConfig((c) => ({
        ...c,
        city: runtimeConfig.defaultCity || "surabaya",
        dummyCount: runtimeConfig.defaultDummyCount || 100,
      }));
    }
    boot().catch((err) => {
      setStatus({ state: "error", label: "Error" });
      setError(err.message);
    });
  }, []);

  const depot = payload?.depot || { name: "Gudang Surabaya", lat: -7.2575, lng: 112.7521 };
  const vehicles = payload?.vehicles || [];
  const orders = payload?.orders || [];

  // ── Derived: filtered orders ──
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (o.name || "").toLowerCase().includes(q) ||
        (o.id || "").toLowerCase().includes(q) ||
        (o.district || "").toLowerCase().includes(q) ||
        (o.kecamatan || "").toLowerCase().includes(q);
      const matchCity = !filterCity || (o.kota || "").toLowerCase().includes(filterCity.toLowerCase());
      const matchDistrict = !filterDistrict || (o.district || o.kecamatan || "").toLowerCase().includes(filterDistrict.toLowerCase());
      return matchSearch && matchCity && matchDistrict;
    });
  }, [orders, searchQuery, filterCity, filterDistrict]);

  // ── Derived: unique cities & districts ──
  const uniqueCities = useMemo(() => {
    const cities = new Set(orders.map((o) => o.kota).filter(Boolean));
    return Array.from(cities).sort();
  }, [orders]);

  const uniqueDistricts = useMemo(() => {
    const districts = new Set(orders.map((o) => o.district || o.kecamatan).filter(Boolean));
    return Array.from(districts).sort();
  }, [orders]);

  // ── Derived: truck stats ──
  const truckStats = useMemo(() => {
    const stats = vehicles.map((v, i) => ({
      ...v,
      index: i,
      assignedOrders: [],
      totalLoad: 0,
      color: getTruckColor(i),
    }));
    Object.entries(truckAssignments).forEach(([orderId, truckIdx]) => {
      const order = orders.find((o) => o.id === orderId);
      if (order && stats[truckIdx]) {
        stats[truckIdx].assignedOrders.push(order);
        stats[truckIdx].totalLoad += Number(order.demand_kg || 0);
      }
    });
    return stats;
  }, [vehicles, truckAssignments, orders]);

  // ── Actions ──
  const toggleOrderSelection = useCallback((order) => {
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      if (next.has(order.id)) next.delete(order.id);
      else next.add(order.id);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback(() => {
    const visibleIds = new Set(filteredOrders.map((o) => o.id));
    setSelectedOrders((prev) => {
      const next = new Set(prev);
      visibleIds.forEach((id) => next.add(id));
      return next;
    });
  }, [filteredOrders]);

  const clearSelection = useCallback(() => {
    setSelectedOrders(new Set());
  }, []);

  const assignToTruck = useCallback((truckIndex) => {
    setTruckAssignments((prev) => {
      const next = { ...prev };
      selectedOrders.forEach((orderId) => {
        next[orderId] = truckIndex;
      });
      return next;
    });
    setSelectedOrders(new Set());
  }, [selectedOrders]);

  const unassignFromTruck = useCallback((orderId) => {
    setTruckAssignments((prev) => {
      const next = { ...prev };
      delete next[orderId];
      return next;
    });
  }, []);

  const addVehicle = useCallback(() => {
    setPayload((current) => ({
      ...current,
      vehicles: [
        ...current.vehicles,
        { id: `TRUCK-${current.vehicles.length + 1}`, capacity_kg: 3000 },
      ],
    }));
  }, []);

  const removeVehicle = useCallback((index) => {
    setPayload((current) => ({
      ...current,
      vehicles: current.vehicles.filter((_, i) => i !== index),
    }));
    // Also unassign orders from this truck
    setTruckAssignments((prev) => {
      const next = {};
      Object.entries(prev).forEach(([oid, ti]) => {
        if (ti !== index) next[oid] = ti;
      });
      return next;
    });
  }, []);

  const updateVehicle = useCallback((index, key, value) => {
    setPayload((current) => ({
      ...current,
      vehicles: current.vehicles.map((v, i) =>
        i === index ? { ...v, [key]: value } : v
      ),
    }));
  }, []);

  const loadDummyOrders = useCallback(async () => {
    setError("");
    setInfo("");
    setStatus({ state: "loading", label: "Loading..." });
    const databaseUrl = dbConfig.databaseUrl.trim();
    const city = dbConfig.city.trim() || appConfig.defaultCity || "surabaya";
    const limit = Number(dbConfig.dummyCount || 100);

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
      setError(data.error || "Gagal generate dummy orders");
      return;
    }
    setPayload(data.payload);
    setTruckAssignments({});
    setSelectedOrders(new Set());
    setShowRouteResult(false);
    setResult(null);
    setStatus({ state: "success", label: `${data.customer_count} Toko` });
    setInfo(`Total demand: ${data.total_dummy_demand_kg} kg / Kapasitas: ${data.total_capacity_kg} kg`);
  }, [dbConfig, appConfig, vehicles, depot]);

  const generatePlan = useCallback(async () => {
    setError("");
    setInfo("");
    setStatus({ state: "loading", label: "Planning..." });

    // Build payload with manual assignments as manual_group_label
    const ordersWithGroups = orders.map((o) => {
      const truckIdx = truckAssignments[o.id];
      return {
        ...o,
        manual_group_label: truckIdx !== undefined ? `TRUCK-${truckIdx + 1}` : "",
      };
    });

    const response = await fetch("/api/plan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: { ...payload, orders: ordersWithGroups },
        solver,
        use_ors: true,
        ors_api_key: dbConfig.orsApiKey.trim() || undefined,
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      setStatus({ state: "error", label: "Error" });
      setError(data.error || "Planning gagal");
      return;
    }
    setResult(data);
    setShowRouteResult(true);
    setStatus({ state: "success", label: "Selesai" });
  }, [payload, orders, truckAssignments, solver, dbConfig]);

  if (!payload) {
    return (
      <div className="flex items-center justify-center h-screen bg-surface-50">
        <div className="text-center">
          <div className="w-10 h-10 border-3 border-primary-200 border-t-primary-500 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-surface-600 font-medium">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-surface-50 overflow-hidden">
      {/* Top Navigation Bar */}
      <header className="h-14 bg-white border-b border-surface-200 flex items-center justify-between px-4 shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🚛</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-surface-900 leading-tight">Route Planner</h1>
            <p className="text-[10px] text-surface-500 leading-tight">Logistik Jawa Timur</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Solver selector */}
          <select
            value={solver}
            onChange={(e) => setSolver(e.target.value)}
            className="text-xs px-3 py-1.5 border border-surface-300 rounded-full bg-white outline-none focus:border-primary-400"
          >
            <option value="auto">Auto Solver</option>
            <option value="ortools">OR-Tools</option>
            <option value="greedy">Greedy</option>
          </select>

          {/* DB Config */}
          <input
            type="text"
            placeholder="Kota..."
            value={dbConfig.city}
            onChange={(e) => setDbConfig((c) => ({ ...c, city: e.target.value }))}
            className="text-xs px-3 py-1.5 border border-surface-300 rounded-full w-28 outline-none focus:border-primary-400"
          />
          <input
            type="number"
            placeholder="Jumlah"
            value={dbConfig.dummyCount}
            onChange={(e) => setDbConfig((c) => ({ ...c, dummyCount: e.target.value }))}
            className="text-xs px-3 py-1.5 border border-surface-300 rounded-full w-20 outline-none focus:border-primary-400"
          />

          <button onClick={loadDummyOrders} className="btn-secondary text-xs py-1.5 px-3">
            🔄 Load Data
          </button>
          <button
            onClick={generatePlan}
            disabled={status.state === "loading"}
            className="btn-primary text-xs py-1.5 px-4"
          >
            {status.state === "loading" ? "⏳ Planning..." : "▶ Generate Rute"}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-96 bg-white border-r border-surface-200 flex flex-col shrink-0 z-10">
          {/* Sidebar Tabs */}
          <div className="flex border-b border-surface-200">
            {[
              { key: "customers", label: `📋 Toko (${orders.length})` },
              { key: "trucks", label: `🚛 Truck (${vehicles.length})` },
              { key: "routes", label: "🗺 Rute" },
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActivePanel(tab.key)}
                className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${
                  activePanel === tab.key
                    ? "text-primary-600 border-b-2 border-primary-500 bg-primary-50"
                    : "text-surface-500 hover:text-surface-700 hover:bg-surface-50"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto">
            {/* ── CUSTOMERS PANEL ── */}
            {activePanel === "customers" && (
              <div className="p-3 space-y-3">
                {/* Search & Filters */}
                <div className="space-y-2">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-surface-400 text-sm">🔍</span>
                    <input
                      type="text"
                      placeholder="Cari nama toko, kecamatan..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="search-input text-sm"
                    />
                  </div>
                  <div className="flex gap-2">
                    <select
                      value={filterCity}
                      onChange={(e) => setFilterCity(e.target.value)}
                      className="flex-1 text-xs px-2 py-1.5 border border-surface-300 rounded-lg bg-white outline-none"
                    >
                      <option value="">Semua Kota</option>
                      {uniqueCities.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <select
                      value={filterDistrict}
                      onChange={(e) => setFilterDistrict(e.target.value)}
                      className="flex-1 text-xs px-2 py-1.5 border border-surface-300 rounded-lg bg-white outline-none"
                    >
                      <option value="">Semua Kecamatan</option>
                      {uniqueDistricts.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Selection Actions */}
                {selectedOrders.size > 0 && (
                  <div className="floating-panel p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary-700">
                        {selectedOrders.size} toko dipilih
                      </span>
                      <button onClick={clearSelection} className="btn-ghost text-xs py-1">
                        Batal
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {vehicles.map((v, i) => (
                        <button
                          key={i}
                          onClick={() => assignToTruck(i)}
                          className="text-xs px-2.5 py-1 rounded-full font-medium text-white"
                          style={{ background: getTruckColor(i) }}
                        >
                          {v.id}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Quick Actions */}
                <div className="flex gap-2">
                  <button onClick={selectAllVisible} className="btn-ghost text-xs flex-1 py-1.5">
                    Pilih Semua
                  </button>
                  <button onClick={clearSelection} className="btn-ghost text-xs flex-1 py-1.5">
                    Bersihkan
                  </button>
                </div>

                {/* Orders List */}
                <div className="space-y-1.5">
                  {filteredOrders.map((order) => {
                    const isSelected = selectedOrders.has(order.id);
                    const truckIdx = truckAssignments[order.id];
                    const truckColor = truckIdx !== undefined ? getTruckColor(truckIdx) : null;

                    return (
                      <div
                        key={order.id}
                        onClick={() => toggleOrderSelection(order)}
                        className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary-400 bg-primary-50 shadow-sm"
                            : "border-surface-200 bg-white hover:border-surface-300"
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          <div
                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 mt-0.5 ${
                              isSelected
                                ? "border-primary-500 bg-primary-500"
                                : "border-surface-300"
                            }`}
                          >
                            {isSelected && <span className="text-white text-xs">✓</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="text-xs font-semibold text-surface-900 truncate">
                                {order.name || order.id}
                              </p>
                              {truckColor && (
                                <span
                                  className="w-2.5 h-2.5 rounded-full shrink-0"
                                  style={{ background: truckColor }}
                                  title={`Truck ${truckIdx + 1}`}
                                />
                              )}
                            </div>
                            <p className="text-[11px] text-surface-500 truncate">
                              📍 {order.district || order.kecamatan || "-"} | {order.kota || "-"}
                            </p>
                            <div className="flex items-center gap-3 mt-1">
                              <span className="text-[11px] text-surface-600">
                                📦 {order.demand_kg} kg
                              </span>
                              {truckIdx !== undefined && (
                                <span
                                  className="text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                                  style={{
                                    background: truckColor + "20",
                                    color: truckColor,
                                  }}
                                >
                                  🚛 {vehicles[truckIdx]?.id || `Truck ${truckIdx + 1}`}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {filteredOrders.length === 0 && (
                  <div className="text-center py-8">
                    <p className="text-surface-400 text-sm">Tidak ada toko ditemukan</p>
                  </div>
                )}
              </div>
            )}

            {/* ── TRUCKS PANEL ── */}
            {activePanel === "trucks" && (
              <div className="p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-bold text-surface-800">Daftar Truck</h3>
                  <button onClick={addVehicle} className="btn-secondary text-xs py-1.5 px-3">
                    + Tambah
                  </button>
                </div>

                <div className="space-y-2">
                  {truckStats.map((truck) => {
                    const utilization = truck.capacity_kg > 0
                      ? Math.round((truck.totalLoad / truck.capacity_kg) * 100)
                      : 0;
                    const isOverloaded = utilization > 100;

                    return (
                      <div
                        key={truck.index}
                        className="floating-panel p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
                            style={{ background: truck.color }}
                          >
                            {truck.index + 1}
                          </div>
                          <div className="flex-1 min-w-0">
                            <input
                              value={truck.id}
                              onChange={(e) => updateVehicle(truck.index, "id", e.target.value)}
                              className="text-sm font-semibold text-surface-900 bg-transparent border-none outline-none w-full p-0"
                            />
                          </div>
                          <button
                            onClick={() => removeVehicle(truck.index)}
                            className="btn-ghost text-xs py-1 px-2 text-surface-400 hover:text-red-500"
                          >
                            🗑
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex-1">
                            <label className="text-[10px] text-surface-500 font-medium">Kapasitas (kg)</label>
                            <input
                              type="number"
                              value={truck.capacity_kg}
                              onChange={(e) => updateVehicle(truck.index, "capacity_kg", Number(e.target.value))}
                              className="w-full text-xs px-2 py-1 border border-surface-200 rounded-lg outline-none focus:border-primary-400"
                            />
                          </div>
                          <div className="flex-1">
                            <label className="text-[10px] text-surface-500 font-medium">Max Stops</label>
                            <input
                              type="number"
                              value={truck.max_stops || ""}
                              onChange={(e) => updateVehicle(truck.index, "max_stops", e.target.value ? Number(e.target.value) : "")}
                              className="w-full text-xs px-2 py-1 border border-surface-200 rounded-lg outline-none focus:border-primary-400"
                            />
                          </div>
                        </div>

                        {/* Load bar */}
                        <div>
                          <div className="flex justify-between text-[10px] mb-1">
                            <span className="text-surface-500">Load</span>
                            <span className={isOverloaded ? "text-red-500 font-bold" : "text-surface-700 font-medium"}>
                              {truck.totalLoad} / {truck.capacity_kg} kg ({utilization}%)
                            </span>
                          </div>
                          <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${Math.min(utilization, 100)}%`,
                                background: isOverloaded ? "#ea4335" : truck.color,
                              }}
                            />
                          </div>
                        </div>

                        {/* Assigned orders */}
                        {truck.assignedOrders.length > 0 && (
                          <div className="pt-1">
                            <p className="text-[10px] text-surface-500 font-medium mb-1">
                              {truck.assignedOrders.length} toko ter-assign:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {truck.assignedOrders.map((o) => (
                                <span
                                  key={o.id}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    unassignFromTruck(o.id);
                                  }}
                                  className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600 cursor-pointer hover:bg-red-50 hover:text-red-500 transition-colors"
                                  title="Klik untuk hapus"
                                >
                                  {o.name || o.id} ×
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ROUTES PANEL ── */}
            {activePanel === "routes" && (
              <div className="p-3 space-y-3">
                {!result ? (
                  <div className="text-center py-12">
                    <div className="text-4xl mb-3">🗺</div>
                    <p className="text-sm text-surface-500">Belum ada rute yang di-generate</p>
                    <p className="text-xs text-surface-400 mt-1">
                      Pilih toko → assign ke truck → klik "Generate Rute"
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Summary */}
                    <div className="floating-panel p-3">
                      <h3 className="text-sm font-bold text-surface-800 mb-2">Ringkasan</h3>
                      <div className="grid grid-cols-2 gap-2">
                        {[
                          { label: "Truck", value: result.summary?.recommended_vehicle_count || "-" },
                          { label: "Jarak", value: `${result.summary?.total_distance_km || "-"} km` },
                          { label: "Waktu", value: `${result.summary?.total_duration_minutes || "-"} min` },
                          { label: "Toko", value: result.summary?.orders_planned || "-" },
                        ].map((item) => (
                          <div key={item.label} className="bg-surface-50 rounded-lg p-2">
                            <p className="text-[10px] text-surface-500">{item.label}</p>
                            <p className="text-sm font-bold text-surface-800">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Route Cards */}
                    <div className="space-y-2">
                      {result.routes?.map((route, idx) => (
                        <div key={idx} className="floating-panel p-3">
                          <div className="flex items-center gap-2 mb-2">
                            <div
                              className="w-6 h-6 rounded-md flex items-center justify-center text-white text-xs font-bold"
                              style={{ background: getTruckColor(idx) }}
                            >
                              {idx + 1}
                            </div>
                            <div className="flex-1">
                              <p className="text-xs font-bold text-surface-800">{route.vehicle_id}</p>
                              <p className="text-[10px] text-surface-500">
                                {route.load_kg}/{route.capacity_kg} kg ({route.utilization_pct}%)
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1 mb-2">
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                              {route.stop_count} stop
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                              {route.distance_km} km
                            </span>
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600">
                              {route.duration_minutes} min
                            </span>
                          </div>
                          <div className="text-[11px] text-surface-500 space-y-0.5">
                            {route.path?.map((stop, sIdx) => (
                              <div key={sIdx} className="flex items-center gap-1.5">
                                <span className="text-surface-300">{sIdx === 0 ? "🏭" : sIdx === route.path.length - 1 ? "🏁" : `${sIdx}.`}</span>
                                <span className={sIdx === 0 || sIdx === route.path.length - 1 ? "font-medium text-surface-700" : ""}>
                                  {stop}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Text Summary */}
                    {result.text_summary && (
                      <div className="floating-panel p-3">
                        <h4 className="text-xs font-bold text-surface-700 mb-1">Detail</h4>
                        <pre className="text-[11px] text-surface-600 whitespace-pre-wrap leading-relaxed">
                          {result.text_summary}
                        </pre>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>

          {/* Status Bar */}
          <div className="border-t border-surface-200 p-2.5 bg-surface-50">
            <div className="flex items-center justify-between">
              <span className={`status-badge ${status.state}`}>
                {status.label}
              </span>
              {info && <span className="text-[10px] text-surface-500 truncate ml-2">{info}</span>}
            </div>
            {error && (
              <p className="text-[11px] text-red-500 mt-1.5 bg-red-50 px-2 py-1 rounded-lg">{error}</p>
            )}
          </div>
        </aside>

        {/* Map Area */}
        <main className="flex-1 relative">
          <LeafletMap
            depot={depot}
            orders={showRouteResult && result ? [] : orders}
            routes={showRouteResult && result ? result.routes : []}
            selectedOrders={selectedOrders}
            onOrderClick={toggleOrderSelection}
            truckAssignments={truckAssignments}
            showAllOrders={!showRouteResult}
            fitBounds={showRouteResult}
          />

          {/* Floating Info on Map */}
          <div className="absolute top-3 left-3 z-[400] space-y-2">
            <div className="floating-panel px-3 py-2">
              <p className="text-xs font-semibold text-surface-800">
                {showRouteResult ? "🗺 Hasil Rute" : "📍 Peta Customer"}
              </p>
              <p className="text-[10px] text-surface-500">
                {orders.length} toko | {vehicles.length} truck
              </p>
            </div>

            {showRouteResult && result && (
              <button
                onClick={() => setShowRouteResult(false)}
                className="floating-panel px-3 py-2 text-xs font-medium text-primary-600 hover:text-primary-700 cursor-pointer"
              >
                ← Kembali ke Peta Customer
              </button>
            )}
          </div>

          {/* Legend */}
          <div className="absolute bottom-4 right-4 z-[400] floating-panel px-3 py-2">
            <p className="text-[10px] font-semibold text-surface-600 mb-1.5">Truck</p>
            <div className="space-y-1">
              {vehicles.slice(0, 6).map((v, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: getTruckColor(i) }}
                  />
                  <span className="text-[10px] text-surface-600">{v.id}</span>
                </div>
              ))}
              {vehicles.length > 6 && (
                <p className="text-[10px] text-surface-400">+{vehicles.length - 6} lainnya</p>
              )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
