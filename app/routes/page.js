"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), { ssr: false });

const AREA_COLORS = [
  "#1a73e8", "#ea4335", "#fbbc04", "#34a853",
  "#9334e6", "#ff6d00", "#00bcd4", "#e91e63",
];

export default function RoutesPage() {
  const [areas, setAreas] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingAreaId, setEditingAreaId] = useState(null);
  const [showNameModal, setShowNameModal] = useState(false);
  const [pendingPolygon, setPendingPolygon] = useState(null);
  const [modalName, setModalName] = useState("");

  // Load ALL saved areas from DB (all cities)
  const loadAreas = useCallback(async () => {
    try {
      const res = await fetch("/api/areas?kota=");
      const data = await res.json();
      if (data.areas) {
        setAreas(data.areas);
      }
    } catch (e) {
      console.error("Failed to load areas:", e);
    }
  }, []);

  // Load ALL active customers (all cities)
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      setOrders([]);
      setEditingAreaId(null);
      setPendingPolygon(null);
      await loadAreas();
      try {
        const res = await fetch("/api/dummy-orders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ city: null }),
        });
        const data = await res.json();
        if (data.payload?.orders) {
          setOrders(data.payload.orders);
        }
      } catch (e) {
        console.error("Failed to load orders:", e);
      }
      setLoading(false);
    };
    loadData();
  }, [loadAreas]);

  // Check if point is inside polygon
  const isPointInPolygon = (point, polygon) => {
    if (!polygon || polygon.length < 3) return false;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const xi = polygon[i].lng, yi = polygon[i].lat;
      const xj = polygon[j].lng, yj = polygon[j].lat;
      const intersect = ((yi > point.lat) !== (yj > point.lat))
        && (point.lng < (xj - xi) * (point.lat - yi) / (yj - yi) + xi);
      if (intersect) inside = !inside;
    }
    return inside;
  };

  // Count orders in each area
  const areasWithCount = areas.map((area) => {
    const count = orders.filter((o) => {
      const point = { lat: Number(o.lat), lng: Number(o.lng) };
      return isPointInPolygon(point, area.polygon);
    }).length;
    return { ...area, count };
  });

  const unassignedCount = orders.filter((o) => {
    const point = { lat: Number(o.lat), lng: Number(o.lng) };
    return !areas.some((a) => isPointInPolygon(point, a.polygon));
  }).length;

  // When polygon is drawn → show modal to name it
  const handlePolygonCreated = useCallback((polygon) => {
    setPendingPolygon(polygon);
    setModalName("");
    setShowNameModal(true);
    setDrawMode(false);
  }, []);

  // Save area to DB
  const saveArea = async () => {
    if (!modalName.trim() || !pendingPolygon) return;
    
    setSaving(true);
    const color = AREA_COLORS[areas.length % AREA_COLORS.length];
    
    try {
      const res = await fetch("/api/areas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: modalName.trim(),
          kota: "jatim",
          color,
          polygon: pendingPolygon,
        }),
      });
      const data = await res.json();
      if (data.success) {
        await loadAreas();
        setShowNameModal(false);
        setPendingPolygon(null);
        setModalName("");
      }
    } catch (e) {
      console.error("Failed to save area:", e);
      alert("Gagal simpan area: " + e.message);
    }
    setSaving(false);
  };

  const cancelSave = () => {
    setShowNameModal(false);
    setPendingPolygon(null);
    setModalName("");
  };

  // Update area polygon after edit
  const handleEditArea = async (areaId, newPolygon) => {
    try {
      const res = await fetch("/api/areas", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: areaId, polygon: newPolygon }),
      });
      await res.json();
      await loadAreas();
    } catch (e) {
      console.error("Failed to update area:", e);
    }
  };

  const deleteArea = async (id) => {
    if (!confirm("Hapus area ini?")) return;
    try {
      await fetch(`/api/areas?id=${id}`, { method: "DELETE" });
      if (editingAreaId === id) setEditingAreaId(null);
      await loadAreas();
    } catch (e) {
      console.error("Failed to delete area:", e);
    }
  };

  const toggleEdit = (areaId) => {
    setEditingAreaId((prev) => (prev === areaId ? null : areaId));
    setDrawMode(false);
  };

  // Format polygons for map
  const mapPolygons = areas.map((a) => ({
    id: a.id,
    name: a.name,
    color: a.color,
    polygon: a.polygon,
  }));

  return (
    <div className="h-screen flex flex-col bg-surface-50 overflow-hidden">
      {/* Header */}
      <header className="h-14 bg-white border-b border-surface-200 flex items-center justify-between px-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-500 rounded-lg flex items-center justify-center">
            <span className="text-white text-lg">🗺</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-surface-900">Area Mapping</h1>
            <p className="text-[10px] text-surface-500">{orders.length.toLocaleString()} toko aktif</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {loading && <span className="text-xs text-surface-500 animate-pulse">⏳ Memuat...</span>}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-surface-200 flex flex-col shrink-0 overflow-hidden">
          {/* Create Area */}
          <div className="p-3 border-b border-surface-200 bg-surface-50">
            <label className="text-[10px] font-semibold text-surface-500 uppercase tracking-wider mb-1.5 block">Buat Area Baru</label>
            <button
              onClick={() => {
                setDrawMode(!drawMode);
                setEditingAreaId(null);
              }}
              disabled={saving}
              className={`w-full text-xs px-3 py-2 rounded-lg font-medium transition-colors ${
                drawMode 
                  ? "bg-primary-500 text-white" 
                  : "bg-white border border-surface-300 text-surface-700 hover:bg-surface-100"
              }`}
            >
              {saving ? "⏳" : drawMode ? "✏️ Klik di peta untuk gambar polygon..." : "✏️ Draw Area Baru"}
            </button>
            {drawMode && (
              <p className="text-[10px] text-primary-600 mt-1.5">
                Klik titik-titik di peta untuk buat polygon, lalu klik titik awal untuk selesai
              </p>
            )}
          </div>

          {/* Area List */}
          <div className="flex-1 overflow-y-auto">
            <div className="p-3 border-b border-surface-200 flex items-center justify-between">
              <h3 className="text-xs font-bold text-surface-700">📍 Area ({areas.length})</h3>
            </div>
            <div className="divide-y divide-surface-100">
              {areasWithCount.map((area) => (
                <div key={area.id} className={`p-3 ${editingAreaId === area.id ? "bg-amber-50" : "hover:bg-surface-50"}`}>
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: area.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-surface-800 truncate">{area.name}</div>
                      <div className="text-[10px] text-surface-500">{area.count} toko</div>
                    </div>
                    <button
                      onClick={() => toggleEdit(area.id)}
                      className={`text-[10px] px-1.5 py-0.5 rounded ${
                        editingAreaId === area.id 
                          ? "bg-amber-500 text-white" 
                          : "text-surface-400 hover:text-amber-600"
                      }`}
                    >
                      {editingAreaId === area.id ? "✓" : "✏️"}
                    </button>
                    <button
                      onClick={() => deleteArea(area.id)}
                      className="text-[10px] text-red-400 hover:text-red-600 px-1"
                    >
                      🗑
                    </button>
                  </div>
                  {editingAreaId === area.id && (
                    <p className="text-[10px] text-amber-600 mt-1">
                      Tarik titik sudut untuk edit polygon
                    </p>
                  )}
                </div>
              ))}

              {areas.length === 0 && (
                <p className="p-4 text-[11px] text-surface-400 text-center">Belum ada area</p>
              )}

              {/* Unassigned */}
              <div className="p-3">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-red-700 truncate">Belum Ter-assign</div>
                    <div className="text-[10px] text-red-500">{unassignedCount} toko</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative">
          <LeafletMap
            depot={{ name: "Gudang", lat: -7.2575, lng: 112.7521 }}
            onPolygonCreated={drawMode ? handlePolygonCreated : null}
            areaPolygons={mapPolygons}
            drawEnabled={drawMode}
            editingAreaId={editingAreaId}
            onEditArea={handleEditArea}
          />
        </div>
      </div>

      {/* Name Modal */}
      {showNameModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-5 w-80">
            <h3 className="text-sm font-bold text-surface-900 mb-1">Simpan Area Baru</h3>
            <p className="text-[11px] text-surface-500 mb-3">
              {pendingPolygon?.length || 0} titik polygon
            </p>
            <input
              type="text"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder="Nama area..."
              className="w-full text-sm px-3 py-2 border border-surface-300 rounded-lg outline-none focus:border-primary-400 mb-3"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveArea()}
            />
            <div className="flex gap-2">
              <button
                onClick={cancelSave}
                className="flex-1 text-xs px-3 py-2 rounded-lg border border-surface-300 text-surface-600 hover:bg-surface-100"
              >
                Batal
              </button>
              <button
                onClick={saveArea}
                disabled={!modalName.trim() || saving}
                className="flex-1 text-xs px-3 py-2 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50"
              >
                {saving ? "⏳ Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
