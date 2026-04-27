"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), { ssr: false });

const TRUCK_COLORS = [
  "#1a73e8", "#ea4335", "#fbbc04", "#34a853",
  "#9334e6", "#ff6d00", "#00bcd4", "#e91e63",
];

function Spinner({ className = "" }) {
  return (
    <div className={`inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent ${className}`} />
  );
}

function SidebarIcon({ active = false, children }) {
  return (
    <div
      className={`flex h-11 w-11 items-center justify-center rounded-2xl border transition-all ${
        active
          ? "border-emerald-100 bg-emerald-50 text-emerald-600 shadow-[0_8px_24px_rgba(16,185,129,0.16)]"
          : "border-transparent bg-transparent text-slate-400 hover:border-slate-200 hover:bg-white hover:text-slate-700"
      }`}
    >
      {children}
    </div>
  );
}

function RailIcon({ name }) {
  const common = "none";

  if (name === "map") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={common} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 18 3 21V6l6-3 6 3 6-3v15l-6 3-6-3Z" />
        <path d="M9 3v15" />
        <path d="M15 6v15" />
      </svg>
    );
  }

  if (name === "truck") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={common} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M10 17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h8v11Z" />
        <path d="M10 9h5l3 3v3a2 2 0 0 1-2 2h-1" />
        <circle cx="7.5" cy="17.5" r="1.5" />
        <circle cx="16.5" cy="17.5" r="1.5" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={common} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V5" />
        <path d="M17 16v-4" />
      </svg>
    );
  }

  if (name === "layers") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={common} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="m12 3 9 5-9 5-9-5 9-5Z" />
        <path d="m3 12 9 5 9-5" />
        <path d="m3 16 9 5 9-5" />
      </svg>
    );
  }

  if (name === "db") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={common} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="12" cy="5" rx="7" ry="3" />
        <path d="M5 5v7c0 1.7 3.1 3 7 3s7-1.3 7-3V5" />
        <path d="M5 12v7c0 1.7 3.1 3 7 3s7-1.3 7-3v-7" />
      </svg>
    );
  }

  if (name === "settings") {
    return (
      <svg width="20" height="20" viewBox="0 0 24 24" fill={common} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 15.5A3.5 3.5 0 1 0 12 8.5a3.5 3.5 0 0 0 0 7Z" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.2a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.2a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3h.1a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.2a1.7 1.7 0 0 0 1 1.5h.1a1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8v.1a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.2a1.7 1.7 0 0 0-1.5 1Z" />
      </svg>
    );
  }

  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={common} stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
    </svg>
  );
}

export default function TrucksPage() {
  const pathname = usePathname();
  const [trucks, setTrucks] = useState([]);
  const [areas, setAreas] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingTruck, setEditingTruck] = useState(null);
  const [searchTruck, setSearchTruck] = useState("");

  const [form, setForm] = useState({
    name: "",
    plate_number: "",
    capacity_kg: "",
    color: TRUCK_COLORS[0],
    area_ids: [],
  });

  const loadTrucks = useCallback(async () => {
    try {
      const res = await fetch("/api/trucks");
      const data = await res.json();
      if (data.trucks) setTrucks(data.trucks);
    } catch (e) {
      console.error("Failed to load trucks:", e);
    }
  }, []);

  const loadAreas = useCallback(async () => {
    try {
      const res = await fetch("/api/areas?kota=");
      const data = await res.json();
      if (data.areas) setAreas(data.areas);
    } catch (e) {
      console.error("Failed to load areas:", e);
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([loadTrucks(), loadAreas()]).then(() => setLoading(false));
  }, [loadTrucks, loadAreas]);

  const resetForm = () => {
    setForm({ name: "", plate_number: "", capacity_kg: "", color: TRUCK_COLORS[0], area_ids: [] });
    setEditingTruck(null);
    setShowForm(false);
  };

  const openCreate = () => {
    resetForm();
    setShowForm(true);
  };

  const openEdit = (truck) => {
    setEditingTruck(truck);
    setForm({
      name: truck.name,
      plate_number: truck.plate_number || "",
      capacity_kg: truck.capacity_kg || "",
      color: truck.color || TRUCK_COLORS[0],
      area_ids: truck.area_ids || [],
    });
    setShowForm(true);
  };

  const saveTruck = async () => {
    if (!form.name.trim()) {
      alert("Nama truck wajib diisi!");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        plate_number: form.plate_number.trim(),
        capacity_kg: parseInt(form.capacity_kg, 10) || 0,
        color: form.color,
        area_ids: form.area_ids,
      };
      const res = await fetch("/api/trucks", {
        method: editingTruck ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editingTruck ? { ...payload, id: editingTruck.id } : payload),
      });
      await res.json();
      await loadTrucks();
      resetForm();
    } catch (e) {
      console.error("Failed to save truck:", e);
      alert("Gagal simpan truck");
    }
    setSaving(false);
  };

  const deleteTruck = async (id) => {
    if (!confirm("Hapus truck ini?")) return;
    try {
      await fetch(`/api/trucks?id=${id}`, { method: "DELETE" });
      await loadTrucks();
      if (editingTruck?.id === id) resetForm();
    } catch (e) {
      console.error("Failed to delete truck:", e);
    }
  };

  const toggleArea = (areaId) => {
    setForm((prev) => ({
      ...prev,
      area_ids: prev.area_ids.includes(areaId)
        ? prev.area_ids.filter((id) => id !== areaId)
        : [...prev.area_ids, areaId],
    }));
  };

  const getAreaNames = (areaIds) => {
    return areaIds
      .map((id) => areas.find((area) => area.id === id)?.name)
      .filter(Boolean);
  };

  const activeAreaIds = showForm
    ? form.area_ids
    : editingTruck?.area_ids || [];

  const mapPolygons = areas
    .filter((area) => activeAreaIds.length === 0 || activeAreaIds.includes(area.id))
    .map((area) => ({
      id: area.id,
      name: area.name,
      color: area.color,
      polygon: area.polygon,
    }));

  const filteredTrucks = trucks.filter((truck) => {
    if (!searchTruck) return true;
    const q = searchTruck.toLowerCase();
    return (
      truck.name?.toLowerCase().includes(q) ||
      truck.plate_number?.toLowerCase().includes(q) ||
      getAreaNames(truck.area_ids || []).join(" ").toLowerCase().includes(q)
    );
  });

  return (
    <div className="h-screen overflow-hidden bg-[#f4f7fb]">
      <div className="flex h-full">
        <aside className="hidden md:flex w-[86px] shrink-0 flex-col items-center justify-between border-r border-white/70 bg-[#fbfcfe] py-5 shadow-[8px_0_30px_rgba(148,163,184,0.08)]">
          <div className="flex flex-col items-center gap-5">
            <Link href="/routes" className="mb-1">
              <SidebarIcon active={pathname === "/routes" || pathname === "/"}>
                <RailIcon name="map" />
              </SidebarIcon>
            </Link>
            <Link href="/trucks">
              <SidebarIcon active={pathname === "/trucks"}>
                <RailIcon name="truck" />
              </SidebarIcon>
            </Link>
            <SidebarIcon>
              <RailIcon name="chart" />
            </SidebarIcon>
            <SidebarIcon>
              <RailIcon name="layers" />
            </SidebarIcon>
            <SidebarIcon>
              <RailIcon name="db" />
            </SidebarIcon>
            <SidebarIcon>
              <RailIcon name="settings" />
            </SidebarIcon>
          </div>
          <div className="flex flex-col items-center gap-4">
            <button className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-400 transition hover:text-slate-700">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 3v2.5" />
                <path d="M12 18.5V21" />
                <path d="m5.6 5.6 1.8 1.8" />
                <path d="m16.6 16.6 1.8 1.8" />
                <path d="M3 12h2.5" />
                <path d="M18.5 12H21" />
                <path d="m5.6 18.4 1.8-1.8" />
                <path d="m16.6 7.4 1.8-1.8" />
              </svg>
            </button>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-[0_8px_24px_rgba(15,23,42,0.1)] ring-1 ring-slate-200">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#1e293b,#64748b)] text-[11px] font-bold text-white">
                YW
              </div>
            </div>
          </div>
        </aside>

        <aside className="flex min-h-0 w-full max-w-[390px] shrink-0 flex-col border-r border-white/70 bg-[linear-gradient(180deg,#fcfdff_0%,#f7f9fc_100%)] shadow-[14px_0_40px_rgba(148,163,184,0.12)]">
          <div className="border-b border-slate-200/80 px-5 pb-5 pt-6">
            <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Buat Truck Baru</p>
            <button
              onClick={openCreate}
              className="mt-4 flex w-full items-center gap-4 rounded-[22px] border border-slate-200 bg-white px-4 py-4 text-left text-slate-700 shadow-[0_18px_40px_rgba(148,163,184,0.12)] transition-all hover:border-slate-300 hover:bg-slate-50"
            >
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 7h13" />
                  <path d="M14 7h1l3 4v6h-2" />
                  <path d="M3 7v10h2" />
                  <path d="M8 17h5" />
                  <circle cx="7" cy="17" r="2" />
                  <circle cx="16" cy="17" r="2" />
                  <path d="M19 8v5h-5" />
                </svg>
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[18px] font-semibold leading-tight">Tambah Truck</div>
                <div className="mt-1 text-[13px] text-slate-500">Buat armada baru dan assign ke area</div>
              </div>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
                <path d="m9 6 6 6-6 6" />
              </svg>
            </button>
          </div>

          <div className="border-b border-slate-200/80 bg-white px-5 py-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                Truck ({trucks.length})
              </h3>
              {loading && (
                <span className="flex items-center gap-2 text-[11px] text-slate-500">
                  <Spinner />
                  Memuat...
                </span>
              )}
            </div>
            <div className="mt-4 flex items-center gap-2">
              <div className="flex flex-1 items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                  <circle cx="11" cy="11" r="7" />
                  <path d="m20 20-3.5-3.5" />
                </svg>
                <input
                  type="text"
                  value={searchTruck}
                  onChange={(e) => setSearchTruck(e.target.value)}
                  placeholder="Cari truck..."
                  className="w-full border-0 bg-transparent text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
                />
              </div>
              <button className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h16" />
                  <path d="M7 12h10" />
                  <path d="M10 17h4" />
                </svg>
              </button>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-3 px-4 py-4">
              {filteredTrucks.map((truck) => {
                const areaNames = getAreaNames(truck.area_ids || []);
                const active = showForm && editingTruck?.id === truck.id;

                return (
                  <div
                    key={truck.id}
                    className={`rounded-[20px] border bg-white px-4 py-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] transition-all ${
                      active
                        ? "border-emerald-300 bg-emerald-50/60"
                        : "border-white hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(148,163,184,0.16)]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 shrink-0 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.9)]" style={{ background: truck.color }} />
                      <div className="min-w-0 flex-1 cursor-pointer" onClick={() => openEdit(truck)}>
                        <div className="truncate text-[15px] font-semibold text-slate-900">{truck.name}</div>
                        <div className="mt-1 text-[12px] text-slate-500">
                          {truck.plate_number || "Tanpa plat"} {truck.capacity_kg > 0 ? `· ${truck.capacity_kg.toLocaleString("id-ID")} kg` : ""}
                        </div>
                        <div className="mt-1 text-[12px]">
                          {areaNames.length > 0 ? (
                            <span className="text-emerald-600">{areaNames.join(", ")}</span>
                          ) : (
                            <span className="text-amber-500">Belum ada area</span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => openEdit(truck)}
                        className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                        aria-label={`Edit ${truck.name}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <path d="m9 18 6-6-6-6" />
                        </svg>
                      </button>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <button
                        onClick={() => openEdit(truck)}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-primary-600 transition-colors hover:bg-primary-50"
                      >
                        Detail
                      </button>
                      <button
                        onClick={() => openEdit(truck)}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-slate-100 hover:text-amber-600"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => deleteTruck(truck.id)}
                        className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredTrucks.length === 0 && (
                <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/70 p-8 text-center">
                  <p className="text-[13px] text-slate-400">{searchTruck ? "Truck tidak ditemukan" : "Belum ada truck"}</p>
                  <p className="mt-1 text-[11px] text-slate-300">Klik tombol di atas untuk menambahkan truck baru</p>
                </div>
              )}
            </div>

            {showForm && (
              <div className="border-t border-slate-200/80 px-4 py-4">
                <div className="rounded-[24px] border border-white/80 bg-white/95 p-4 shadow-[0_18px_40px_rgba(148,163,184,0.16)]">
                  <div className="mb-4 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        {editingTruck ? "Edit Truck" : "Truck Baru"}
                      </p>
                      <h2 className="mt-1 text-xl font-bold text-slate-900">
                        {editingTruck ? editingTruck.name : "Tambah Armada"}
                      </h2>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right">
                      <div className="text-[10px] uppercase tracking-[0.18em] text-slate-400">Area</div>
                      <div className="mt-1 text-base font-semibold text-slate-900">{form.area_ids.length}</div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Nama Truck
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Contoh: Colt Diesel Timur"
                        className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Plat
                        </label>
                        <input
                          type="text"
                          value={form.plate_number}
                          onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                          placeholder="L 1234 AB"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
                        />
                      </div>
                      <div>
                        <label className="mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                          Kg
                        </label>
                        <input
                          type="number"
                          value={form.capacity_kg}
                          onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
                          placeholder="5000"
                          className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition-all focus:border-primary-400 focus:bg-white focus:ring-2 focus:ring-primary-100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Warna
                      </label>
                      <div className="flex flex-wrap gap-3">
                        {TRUCK_COLORS.map((color) => (
                          <button
                            key={color}
                            onClick={() => setForm({ ...form, color })}
                            className={`h-9 w-9 rounded-full border-2 transition-all ${
                              form.color === color ? "scale-110 border-slate-900 shadow-[0_12px_24px_rgba(15,23,42,0.2)]" : "border-white hover:scale-105"
                            }`}
                            style={{ background: color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                        Assign Area ({form.area_ids.length})
                      </label>
                      {areas.length === 0 ? (
                        <div className="rounded-[22px] border border-amber-200 bg-amber-50 p-4">
                          <p className="text-[12px] text-amber-700">
                            Belum ada area. Buat dulu di <Link href="/routes" className="font-medium underline">Area Mapping</Link>.
                          </p>
                        </div>
                      ) : (
                        <div className="max-h-[260px] space-y-2 overflow-y-auto rounded-[22px] border border-slate-200 bg-slate-50 p-3">
                          {areas.map((area) => {
                            const selected = form.area_ids.includes(area.id);
                            return (
                              <button
                                key={area.id}
                                onClick={() => toggleArea(area.id)}
                                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left transition-all ${
                                  selected
                                    ? "border-primary-300 bg-primary-50 text-primary-700 shadow-sm"
                                    : "border-transparent bg-white text-slate-600 hover:border-slate-200"
                                }`}
                              >
                                <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: area.color }} />
                                <span className="flex-1 truncate text-[13px] font-medium">{area.name}</span>
                                <span className="text-[11px] text-slate-400">{selected ? "Terpilih" : "Pilih"}</span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-5 flex gap-3 border-t border-slate-100 pt-4">
                    <button
                      onClick={resetForm}
                      className="flex-1 rounded-2xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                    >
                      Batal
                    </button>
                    <button
                      onClick={saveTruck}
                      disabled={saving || !form.name.trim()}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
                    >
                      {saving && <Spinner className="text-white" />}
                      {saving ? "Menyimpan..." : editingTruck ? "Simpan" : "Tambah"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="relative min-h-0 flex-1 overflow-hidden bg-[#dceefe]">
          <div className="pointer-events-none absolute inset-0 z-[400] bg-[radial-gradient(circle_at_left_center,rgba(255,255,255,0.45),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08))]" />
          <div className="pointer-events-none absolute left-8 top-8 z-[401] hidden rounded-2xl border border-white/60 bg-white/75 px-4 py-3 shadow-[0_24px_60px_rgba(148,163,184,0.18)] backdrop-blur md:block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Truck Mapping</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {showForm ? `${form.area_ids.length} area dipilih` : `${trucks.length.toLocaleString("id-ID")} truck terdaftar`}
            </div>
          </div>
          <LeafletMap
            depot={{ name: "Gudang", lat: -7.2575, lng: 112.7521 }}
            areaPolygons={mapPolygons}
            drawEnabled={false}
            theme="light"
          />
        </main>
      </div>
    </div>
  );
}
