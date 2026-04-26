"use client";

import { useState } from "react";

const DEFAULT_TRUCKS = [
  { id: "TRUCK-1", name: "Isuzu Elf", capacity_kg: 2500, plat: "L 1234 AB", driver: "Budi", phone: "08123456789", assignedArea: "area-1" },
  { id: "TRUCK-2", name: "Mitsubishi Canter", capacity_kg: 3000, plat: "L 5678 CD", driver: "Andi", phone: "08198765432", assignedArea: "area-2" },
  { id: "TRUCK-3", name: "Hino Dutro", capacity_kg: 3500, plat: "L 9012 EF", driver: "Siti", phone: "08234567890", assignedArea: "area-3" },
  { id: "TRUCK-4", name: "Toyota Dyna", capacity_kg: 4000, plat: "L 3456 GH", driver: "Rudi", phone: "08345678901", assignedArea: null },
  { id: "TRUCK-5", name: "Isuzu Giga", capacity_kg: 5000, plat: "L 7890 IJ", driver: "Dewi", phone: "08456789012", assignedArea: null },
];

const DEFAULT_AREAS = [
  { id: "area-1", name: "Surabaya Barat", color: "#1a73e8" },
  { id: "area-2", name: "Surabaya Selatan", color: "#ea4335" },
  { id: "area-3", name: "Surabaya Timur", color: "#fbbc04" },
  { id: "area-4", name: "Surabaya Pusat", color: "#34a853" },
  { id: "area-5", name: "Surabaya Utara", color: "#9334e6" },
  { id: "area-6", name: "Gresik", color: "#ff6d00" },
  { id: "area-7", name: "Sidoarjo", color: "#00bcd4" },
  { id: "area-8", name: "Jombang", color: "#e91e63" },
];

export default function TrucksPage() {
  const [trucks, setTrucks] = useState(DEFAULT_TRUCKS);
  const [areas] = useState(DEFAULT_AREAS);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newTruck, setNewTruck] = useState({
    name: "",
    capacity_kg: "",
    plat: "",
    driver: "",
    phone: "",
    assignedArea: "",
  });

  const addTruck = () => {
    if (!newTruck.name.trim() || !newTruck.capacity_kg) return;
    const truck = {
      id: `TRUCK-${trucks.length + 1}`,
      ...newTruck,
      capacity_kg: Number(newTruck.capacity_kg),
    };
    setTrucks([...trucks, truck]);
    setNewTruck({ name: "", capacity_kg: "", plat: "", driver: "", phone: "", assignedArea: "" });
    setShowAddForm(false);
  };

  const deleteTruck = (id) => {
    setTrucks(trucks.filter((t) => t.id !== id));
  };

  const assignArea = (truckId, areaId) => {
    setTrucks(trucks.map((t) => (t.id === truckId ? { ...t, assignedArea: areaId || null } : t)));
  };

  const getAreaName = (areaId) => {
    const area = areas.find((a) => a.id === areaId);
    return area ? area.name : "Belum di-assign";
  };

  const getAreaColor = (areaId) => {
    const area = areas.find((a) => a.id === areaId);
    return area ? area.color : "#9aa0a6";
  };

  return (
    <div className="min-h-screen bg-surface-50">
      <header className="h-14 bg-white border-b border-surface-200 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🚛</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-surface-900">Truck Management</h1>
            <p className="text-[10px] text-surface-500">Kelola truck dan assign ke area</p>
          </div>
        </div>
        <button onClick={() => setShowAddForm(!showAddForm)} className="btn-primary text-xs py-1.5 px-3">
          {showAddForm ? "Batal" : "+ Tambah Truck"}
        </button>
      </header>

      <div className="p-4 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Total Truck</p>
            <p className="text-xl font-bold text-surface-800">{trucks.length}</p>
          </div>
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Total Kapasitas</p>
            <p className="text-xl font-bold text-surface-800">
              {trucks.reduce((sum, t) => sum + t.capacity_kg, 0).toLocaleString()} kg
            </p>
          </div>
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Sudah Assign</p>
            <p className="text-xl font-bold text-primary-600">
              {trucks.filter((t) => t.assignedArea).length}
            </p>
          </div>
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Belum Assign</p>
            <p className="text-xl font-bold text-red-500">
              {trucks.filter((t) => !t.assignedArea).length}
            </p>
          </div>
        </div>

        {/* Add Form */}
        {showAddForm && (
          <div className="floating-panel p-4 mb-4">
            <h3 className="text-sm font-bold text-surface-800 mb-3">Tambah Truck Baru</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Nama Truck</label>
                <input
                  type="text"
                  value={newTruck.name}
                  onChange={(e) => setNewTruck({ ...newTruck, name: e.target.value })}
                  placeholder="Isuzu Elf"
                  className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Kapasitas (kg)</label>
                <input
                  type="number"
                  value={newTruck.capacity_kg}
                  onChange={(e) => setNewTruck({ ...newTruck, capacity_kg: e.target.value })}
                  placeholder="2500"
                  className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Plat Nomor</label>
                <input
                  type="text"
                  value={newTruck.plat}
                  onChange={(e) => setNewTruck({ ...newTruck, plat: e.target.value })}
                  placeholder="L 1234 AB"
                  className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Nama Driver</label>
                <input
                  type="text"
                  value={newTruck.driver}
                  onChange={(e) => setNewTruck({ ...newTruck, driver: e.target.value })}
                  placeholder="Budi"
                  className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-surface-500 font-medium">No HP Driver</label>
                <input
                  type="text"
                  value={newTruck.phone}
                  onChange={(e) => setNewTruck({ ...newTruck, phone: e.target.value })}
                  placeholder="08123456789"
                  className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Area Default</label>
                <select
                  value={newTruck.assignedArea}
                  onChange={(e) => setNewTruck({ ...newTruck, assignedArea: e.target.value })}
                  className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                >
                  <option value="">Pilih Area (opsional)</option>
                  {areas.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <button onClick={addTruck} className="btn-primary text-sm py-2 px-4 mt-3">
              Simpan Truck
            </button>
          </div>
        )}

        {/* Truck List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {trucks.map((truck) => (
            <div key={truck.id} className="floating-panel p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-surface-100 rounded-lg flex items-center justify-center text-xl">
                    🚛
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-surface-800">{truck.name}</h4>
                    <p className="text-[11px] text-surface-500">{truck.plat}</p>
                  </div>
                </div>
                <button
                  onClick={() => deleteTruck(truck.id)}
                  className="btn-ghost text-xs py-1 px-2 text-red-500 hover:bg-red-50"
                >
                  🗑
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 mt-3">
                <div className="bg-surface-50 rounded-lg p-2">
                  <p className="text-[10px] text-surface-500">Kapasitas</p>
                  <p className="text-sm font-semibold text-surface-800">{truck.capacity_kg.toLocaleString()} kg</p>
                </div>
                <div className="bg-surface-50 rounded-lg p-2">
                  <p className="text-[10px] text-surface-500">Driver</p>
                  <p className="text-sm font-semibold text-surface-800">{truck.driver || "-"}</p>
                </div>
              </div>

              <div className="mt-3">
                <label className="text-[11px] text-surface-500 font-medium">Assign ke Area:</label>
                <div className="flex items-center gap-2 mt-1">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ background: getAreaColor(truck.assignedArea) }}
                  />
                  <select
                    value={truck.assignedArea || ""}
                    onChange={(e) => assignArea(truck.id, e.target.value)}
                    className="flex-1 text-sm px-2 py-1.5 border border-surface-300 rounded-lg outline-none focus:border-primary-400"
                  >
                    <option value="">Belum di-assign</option>
                    {areas.map((a) => (
                      <option key={a.id} value={a.id}>{a.name}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
