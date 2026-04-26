"use client";

import { useState, useEffect } from "react";

const DEFAULT_AREAS = [
  {
    id: "area-1",
    name: "Surabaya Barat",
    color: "#1a73e8",
    kecamatan: ["Lakarsantri", "Sambikerep", "Tandes", "Benowo", "Pakal", "Asemrowo", "Suko Manunggal"],
  },
  {
    id: "area-2",
    name: "Surabaya Selatan",
    color: "#ea4335",
    kecamatan: ["Karang Pilang", "Jambangan", "Gayungan", "Wonocolo", "Wiyung", "Dukuh Pakis", "Wonokromo"],
  },
  {
    id: "area-3",
    name: "Surabaya Timur",
    color: "#fbbc04",
    kecamatan: ["Rungkut", "Gunung Anyar", "Sukolilo", "Mulyorejo", "Tenggilis Mejoyo", "Tambaksari"],
  },
  {
    id: "area-4",
    name: "Surabaya Pusat",
    color: "#34a853",
    kecamatan: ["Gubeng", "Tegalsari", "Genteng", "Sawahan", "Bubutan", "Simokerto"],
  },
  {
    id: "area-5",
    name: "Surabaya Utara",
    color: "#9334e6",
    kecamatan: ["Krembangan", "Semampir", "Kenjeran", "Bulak", "Pabean Cantian"],
  },
  {
    id: "area-6",
    name: "Gresik",
    color: "#ff6d00",
    kecamatan: ["Gresik", "Kebomas", "Menganti", "Cerme", "Duduk Sampeyan", "Balong Panggang", "Driyorejo", "Kedamean", "Wringin Anom", "Manyar", "Ujung Pangkah", "Sidayu", "Sangkapura", "Tambak"],
  },
  {
    id: "area-7",
    name: "Sidoarjo",
    color: "#00bcd4",
    kecamatan: ["Sidoarjo", "Buduran", "Candi", "Porong", "Taman", "Tanggulangin", "Waru", "Gedangan", "Krian", "Sedati", "Tulangan", "Wonoayu", "Jabon", "Krembung", "Balong Bendo"],
  },
  {
    id: "area-8",
    name: "Jombang",
    color: "#e91e63",
    kecamatan: ["Jombang", "Mojowarno", "Bareng", "Diwek", "Wonosalam", "Mojoagung", "Sumobito", "Kesamben", "Gudo", "Ngusikan", "Ploso", "Kabuh", "Plandaan", "Bandar Kedung Mulyo", "Perak", "Tembelang", "Kudu", "Peterongan", "Ngoro", "Megaluh"],
  },
];

export default function AreasPage() {
  const [areas, setAreas] = useState(DEFAULT_AREAS);
  const [newAreaName, setNewAreaName] = useState("");
  const [newAreaColor, setNewAreaColor] = useState("#1a73e8");
  const [selectedKecamatan, setSelectedKecamatan] = useState([]);
  const [editingArea, setEditingArea] = useState(null);
  const [allKecamatan, setAllKecamatan] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Load all kecamatan from database
  useEffect(() => {
    async function loadKecamatan() {
      try {
        const res = await fetch("/api/dummy-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: "surabaya", limit: 500 }),
        });
        const data = await res.json();
        if (data.payload?.orders) {
          const kecSet = new Set();
          data.payload.orders.forEach((o) => {
            if (o.district) kecSet.add(o.district);
          });
          setAllKecamatan(Array.from(kecSet).sort());
        }
      } catch (e) {
        console.error("Failed to load kecamatan:", e);
      }
    }
    loadKecamatan();
  }, []);

  const addArea = () => {
    if (!newAreaName.trim()) return;
    const newArea = {
      id: `area-${Date.now()}`,
      name: newAreaName,
      color: newAreaColor,
      kecamatan: selectedKecamatan,
    };
    setAreas([...areas, newArea]);
    setNewAreaName("");
    setSelectedKecamatan([]);
  };

  const deleteArea = (id) => {
    setAreas(areas.filter((a) => a.id !== id));
  };

  const updateAreaKecamatan = (areaId, kecamatan) => {
    setAreas(areas.map((a) => (a.id === areaId ? { ...a, kecamatan } : a)));
  };

  const filteredKecamatan = allKecamatan.filter((k) =>
    k.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unassigned kecamatan
  const assignedKecamatan = new Set(areas.flatMap((a) => a.kecamatan));
  const unassignedKecamatan = allKecamatan.filter((k) => !assignedKecamatan.has(k));

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="h-14 bg-white border-b border-surface-200 flex items-center px-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🗺</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-surface-900">Area Management</h1>
            <p className="text-[10px] text-surface-500">Kelompokkan kecamatan ke area pengiriman</p>
          </div>
        </div>
      </header>

      <div className="p-4 max-w-6xl mx-auto">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mb-6">
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Total Area</p>
            <p className="text-xl font-bold text-surface-800">{areas.length}</p>
          </div>
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Total Kecamatan</p>
            <p className="text-xl font-bold text-surface-800">{allKecamatan.length}</p>
          </div>
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Kecamatan Ter-assign</p>
            <p className="text-xl font-bold text-primary-600">{assignedKecamatan.size}</p>
          </div>
          <div className="floating-panel p-3">
            <p className="text-[10px] text-surface-500">Belum Ter-assign</p>
            <p className="text-xl font-bold text-red-500">{unassignedKecamatan.length}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Add New Area */}
          <div className="floating-panel p-4">
            <h3 className="text-sm font-bold text-surface-800 mb-3">Tambah Area Baru</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Nama Area</label>
                <input
                  type="text"
                  value={newAreaName}
                  onChange={(e) => setNewAreaName(e.target.value)}
                  placeholder="Contoh: Surabaya Barat"
                  className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Warna</label>
                <div className="flex gap-2 mt-1 flex-wrap">
                  {["#1a73e8", "#ea4335", "#fbbc04", "#34a853", "#9334e6", "#ff6d00", "#00bcd4", "#e91e63"].map(
                    (c) => (
                      <button
                        key={c}
                        onClick={() => setNewAreaColor(c)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          newAreaColor === c ? "border-surface-800" : "border-transparent"
                        }`}
                        style={{ background: c }}
                      />
                    )
                  )}
                </div>
              </div>
              <div>
                <label className="text-[11px] text-surface-500 font-medium">Pilih Kecamatan</label>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari kecamatan..."
                  className="w-full text-xs px-3 py-1.5 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mt-1"
                />
                <div className="mt-2 max-h-48 overflow-y-auto border border-surface-200 rounded-lg p-2">
                  {filteredKecamatan.map((k) => {
                    const isAssigned = assignedKecamatan.has(k);
                    const isSelected = selectedKecamatan.includes(k);
                    return (
                      <label
                        key={k}
                        className={`flex items-center gap-2 py-1 px-1 rounded cursor-pointer text-xs ${
                          isAssigned && !isSelected ? "text-surface-400" : "text-surface-700 hover:bg-surface-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedKecamatan([...selectedKecamatan, k]);
                            } else {
                              setSelectedKecamatan(selectedKecamatan.filter((sk) => sk !== k));
                            }
                          }}
                          disabled={isAssigned && !isSelected}
                          className="w-3.5 h-3.5"
                        />
                        <span className="truncate">{k}</span>
                        {isAssigned && !isSelected && (
                          <span className="text-[9px] text-red-400 ml-auto">sudah di area lain</span>
                        )}
                      </label>
                    );
                  })}
                </div>
                <p className="text-[10px] text-surface-500 mt-1">
                  {selectedKecamatan.length} kecamatan dipilih
                </p>
              </div>
              <button
                onClick={addArea}
                disabled={!newAreaName.trim() || selectedKecamatan.length === 0}
                className="btn-primary w-full text-sm py-2"
              >
                + Tambah Area
              </button>
            </div>
          </div>

          {/* Area List */}
          <div className="lg:col-span-2 space-y-3">
            <h3 className="text-sm font-bold text-surface-800">Daftar Area ({areas.length})</h3>
            {areas.map((area) => (
              <div key={area.id} className="floating-panel p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-4 h-4 rounded-full shrink-0"
                    style={{ background: area.color }}
                  />
                  <h4 className="text-sm font-bold text-surface-800 flex-1">{area.name}</h4>
                  <span className="text-[11px] text-surface-500">
                    {area.kecamatan.length} kecamatan
                  </span>
                  <button
                    onClick={() => deleteArea(area.id)}
                    className="btn-ghost text-xs py-1 px-2 text-red-500 hover:bg-red-50"
                  >
                    🗑
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {area.kecamatan.map((k) => (
                    <span
                      key={k}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-surface-100 text-surface-600"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* Unassigned Kecamatan */}
            {unassignedKecamatan.length > 0 && (
              <div className="floating-panel p-4 border border-red-200">
                <h4 className="text-sm font-bold text-red-600 mb-2">
                  ⚠️ Kecamatan Belum Ter-assign ({unassignedKecamatan.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {unassignedKecamatan.map((k) => (
                    <span
                      key={k}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 text-red-600"
                    >
                      {k}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
