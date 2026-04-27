"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TRUCK_COLORS = [
  "#1a73e8", "#ea4335", "#fbbc04", "#34a853",
  "#9334e6", "#ff6d00", "#00bcd4", "#e91e63",
];

function NavLink({ href, label, activePath }) {
  const isActive = activePath === href;
  return (
    <Link
      href={href}
      className={`text-sm px-4 py-2 rounded-lg font-medium transition-colors ${
        isActive
          ? "bg-primary-500 text-white shadow-sm"
          : "text-surface-600 hover:bg-surface-100 hover:text-surface-900"
      }`}
    >
      {label}
    </Link>
  );
}

function Spinner({ className = "" }) {
  return (
    <div className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
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
        capacity_kg: parseInt(form.capacity_kg) || 0,
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

  // Get area names for a truck
  const getAreaNames = (areaIds) => {
    return areaIds
      .map((id) => areas.find((a) => a.id === id)?.name)
      .filter(Boolean);
  };

  return (
    <div className="h-screen flex flex-col bg-surface-50 overflow-hidden">
      {/* Header */}
      <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold tracking-wider">TM</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-surface-900">Truck Management</h1>
            <p className="text-[11px] text-surface-500">{trucks.length} truck terdaftar</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NavLink href="/routes" label="Area" activePath={pathname} />
          <NavLink href="/trucks" label="Trucks" activePath={pathname} />
          {loading && (
            <span className="ml-2 text-xs text-surface-500 flex items-center gap-1.5">
              <Spinner />
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Truck List */}
        <aside className="w-96 bg-white border-r border-surface-200 flex flex-col shrink-0 overflow-hidden">
          <div className="p-4 border-b border-surface-200 bg-surface-50">
            <button
              onClick={openCreate}
              className="w-full text-sm px-4 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 font-medium shadow-sm transition-colors"
            >
              Tambah Truck
            </button>
          </div>

          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 border-b border-surface-200 bg-white">
              <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                Daftar Truck ({trucks.length})
              </h3>
            </div>
            <div className="divide-y divide-surface-100">
              {trucks.map((truck) => {
                const areaNames = getAreaNames(truck.area_ids || []);
                return (
                  <div 
                    key={truck.id} 
                    className={`p-4 transition-colors cursor-pointer ${showForm && editingTruck?.id === truck.id ? "bg-primary-50 border-l-4 border-l-primary-500" : "hover:bg-surface-50 border-l-4 border-l-transparent"}`}
                    onClick={() => openEdit(truck)}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-3.5 h-3.5 rounded-full shrink-0 shadow-sm" style={{ background: truck.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-surface-800 truncate">{truck.name}</div>
                        <div className="text-[11px] text-surface-500 mt-0.5">
                          {truck.plate_number && (
                            <span className="inline-block mr-2">{truck.plate_number}</span>
                          )}
                          {truck.capacity_kg > 0 && (
                            <span className="inline-block mr-2">{truck.capacity_kg.toLocaleString()} kg</span>
                          )}
                          {areaNames.length > 0 ? (
                            <span className="text-primary-600 font-medium">{areaNames.join(", ")}</span>
                          ) : (
                            <span className="text-amber-500">Belum ada area</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(truck); }}
                          className="text-[11px] text-surface-400 hover:text-amber-600 hover:bg-amber-50 px-2 py-1 rounded-md font-medium transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteTruck(truck.id); }}
                          className="text-[11px] text-surface-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md font-medium transition-colors"
                        >
                          Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {trucks.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-[13px] text-surface-400">Belum ada truck</p>
                  <p className="text-[11px] text-surface-300 mt-1">Klik tombol di atas untuk menambahkan truck baru</p>
                </div>
              )}
            </div>
          </div>
        </aside>

        {/* Main - Form or Empty */}
        <main className="flex-1 overflow-y-auto p-8 bg-surface-50">
          {showForm ? (
            <div className="max-w-xl mx-auto bg-white rounded-xl border border-surface-200 p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="text-base font-bold text-surface-900">
                  {editingTruck ? "Edit Truck" : "Truck Baru"}
                </h2>
                <p className="text-[12px] text-surface-500 mt-0.5">
                  {editingTruck ? "Ubah detail truck yang sudah ada" : "Tambahkan truck baru ke sistem"}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider block mb-1.5">
                    Nama Truck
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Contoh: Truck A"
                    className="w-full text-sm px-4 py-2.5 border border-surface-300 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider block mb-1.5">
                      Plat Nomor
                    </label>
                    <input
                      type="text"
                      value={form.plate_number}
                      onChange={(e) => setForm({ ...form, plate_number: e.target.value })}
                      placeholder="L 1234 AB"
                      className="w-full text-sm px-4 py-2.5 border border-surface-300 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider block mb-1.5">
                      Kapasitas (kg)
                    </label>
                    <input
                      type="number"
                      value={form.capacity_kg}
                      onChange={(e) => setForm({ ...form, capacity_kg: e.target.value })}
                      placeholder="5000"
                      className="w-full text-sm px-4 py-2.5 border border-surface-300 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 transition-all"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider block mb-2">
                    Warna
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    {TRUCK_COLORS.map((c) => (
                      <button
                        key={c}
                        onClick={() => setForm({ ...form, color: c })}
                        className={`w-8 h-8 rounded-full border-2 transition-all ${form.color === c ? "border-surface-800 scale-110 shadow-md" : "border-transparent hover:scale-105"}`}
                        style={{ background: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider block mb-2">
                    Assign Area ({form.area_ids.length} area)
                  </label>
                  {areas.length === 0 ? (
                    <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <p className="text-[12px] text-amber-700">
                        Belum ada area. Buat area dulu di <Link href="/routes" className="underline font-medium">Area Mapping</Link>.
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {areas.map((area) => {
                        const selected = form.area_ids.includes(area.id);
                        return (
                          <button
                            key={area.id}
                            onClick={() => toggleArea(area.id)}
                            className={`text-[12px] px-3 py-1.5 rounded-full border transition-all ${
                              selected
                                ? "border-primary-400 bg-primary-50 text-primary-700 shadow-sm"
                                : "border-surface-300 text-surface-500 hover:border-surface-400 hover:bg-surface-50"
                            }`}
                          >
                            <span className="inline-block w-2 h-2 rounded-full mr-1.5" style={{ background: area.color }} />
                            {area.name}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex gap-3 mt-6 pt-4 border-t border-surface-100">
                <button
                  onClick={resetForm}
                  className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-surface-300 text-surface-600 hover:bg-surface-50 font-medium transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={saveTruck}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 text-sm px-4 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 font-medium transition-colors flex items-center justify-center gap-2"
                >
                  {saving && <Spinner className="text-white" />}
                  {saving ? "Menyimpan..." : editingTruck ? "Simpan Perubahan" : "Simpan Truck"}
                </button>
              </div>
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="w-16 h-16 bg-surface-200 rounded-2xl mx-auto mb-4 flex items-center justify-center">
                  <div className="w-8 h-8 border-2 border-surface-400 border-dashed rounded-lg" />
                </div>
                <p className="text-sm font-medium text-surface-500">Klik "Tambah Truck" untuk mulai</p>
                <p className="text-[12px] text-surface-400 mt-1">Atau pilih truck di sidebar untuk mengedit</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
