"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LeafletMap = dynamic(() => import("../../components/LeafletMap"), { ssr: false });

const AREA_COLORS = [
  "#1a73e8", "#ea4335", "#fbbc04", "#34a853",
  "#9334e6", "#ff6d00", "#00bcd4", "#e91e63",
];

function NavLink({ href, label, activePath }) {
  const isActive = activePath === href || (href === "/routes" && activePath === "/");
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

export default function RoutesPage() {
  const pathname = usePathname();
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

  // When polygon is drawn -> show modal to name it
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
      <header className="h-16 bg-white border-b border-surface-200 flex items-center justify-between px-6 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-500 rounded-lg flex items-center justify-center shadow-sm">
            <span className="text-white text-xs font-bold tracking-wider">AM</span>
          </div>
          <div>
            <h1 className="text-sm font-bold text-surface-900">Area Mapping</h1>
            <p className="text-[11px] text-surface-500">{orders.length.toLocaleString()} toko aktif</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <NavLink href="/routes" label="Area" activePath={pathname} />
          <NavLink href="/trucks" label="Trucks" activePath={pathname} />
          {loading && (
            <span className="ml-2 text-xs text-surface-500 flex items-center gap-1.5">
              <Spinner />
              Memuat...
            </span>
          )}
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-80 bg-white border-r border-surface-200 flex flex-col shrink-0 overflow-hidden">
          {/* Create Area */}
          <div className="p-4 border-b border-surface-200 bg-surface-50">
            <label className="text-[11px] font-semibold text-surface-500 uppercase tracking-wider mb-2 block">
              Buat Area Baru
            </label>
            <button
              onClick={() => {
                setDrawMode(!drawMode);
                setEditingAreaId(null);
              }}
              disabled={saving}
              className={`w-full text-sm px-4 py-2.5 rounded-lg font-medium transition-all ${
                drawMode 
                  ? "bg-primary-500 text-white shadow-sm" 
                  : "bg-white border border-surface-300 text-surface-700 hover:bg-surface-100 hover:border-surface-400"
              }`}
            >
              {saving ? (
                <span className="flex items-center justify-center gap-2">
                  <Spinner className="text-current" />
                  Menyimpan...
                </span>
              ) : drawMode ? (
                "Klik di peta untuk gambar polygon..."
              ) : (
                "Draw Area Baru"
              )}
            </button>
            {drawMode && (
              <p className="text-[11px] text-primary-600 mt-2 leading-relaxed">
                Klik titik-titik di peta untuk buat polygon, lalu klik titik awal untuk selesai
              </p>
            )}
          </div>

          {/* Area List */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-4 py-3 border-b border-surface-200 flex items-center justify-between bg-white">
              <h3 className="text-xs font-bold text-surface-700 uppercase tracking-wider">
                Area ({areas.length})
              </h3>
            </div>
            <div className="divide-y divide-surface-100">
              {areasWithCount.map((area) => (
                <div 
                  key={area.id} 
                  className={`p-4 transition-colors ${editingAreaId === area.id ? "bg-amber-50" : "hover:bg-surface-50"}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full shrink-0 shadow-sm" style={{ background: area.color }} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-surface-800 truncate">{area.name}</div>
                      <div className="text-[11px] text-surface-500">{area.count} toko</div>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => toggleEdit(area.id)}
                        className={`text-[11px] px-2 py-1 rounded-md font-medium transition-colors ${
                          editingAreaId === area.id 
                            ? "bg-amber-500 text-white" 
                            : "text-surface-400 hover:text-amber-600 hover:bg-surface-100"
                        }`}
                      >
                        {editingAreaId === area.id ? "Selesai" : "Edit"}
                      </button>
                      <button
                        onClick={() => deleteArea(area.id)}
                        className="text-[11px] text-surface-400 hover:text-red-600 hover:bg-red-50 px-2 py-1 rounded-md font-medium transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                  {editingAreaId === area.id && (
                    <p className="text-[11px] text-amber-600 mt-2">
                      Tarik titik sudut untuk edit polygon
                    </p>
                  )}
                </div>
              ))}

              {areas.length === 0 && (
                <div className="p-6 text-center">
                  <p className="text-[13px] text-surface-400">Belum ada area</p>
                  <p className="text-[11px] text-surface-300 mt-1">Klik tombol di atas untuk membuat area baru</p>
                </div>
              )}

              {/* Unassigned */}
              <div className="p-4 bg-red-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-red-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-red-700 truncate">Belum Ter-assign</div>
                    <div className="text-[11px] text-red-500">{unassignedCount} toko</div>
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
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-96 border border-surface-100">
            <h3 className="text-base font-bold text-surface-900 mb-1">Simpan Area Baru</h3>
            <p className="text-[12px] text-surface-500 mb-4">
              {pendingPolygon?.length || 0} titik polygon tercatat
            </p>
            <input
              type="text"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder="Nama area..."
              className="w-full text-sm px-4 py-2.5 border border-surface-300 rounded-lg outline-none focus:border-primary-400 focus:ring-2 focus:ring-primary-100 mb-4 transition-all"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveArea()}
            />
            <div className="flex gap-3">
              <button
                onClick={cancelSave}
                className="flex-1 text-sm px-4 py-2.5 rounded-lg border border-surface-300 text-surface-600 hover:bg-surface-50 font-medium transition-colors"
              >
                Batal
              </button>
              <button
                onClick={saveArea}
                disabled={!modalName.trim() || saving}
                className="flex-1 text-sm px-4 py-2.5 rounded-lg bg-primary-500 text-white hover:bg-primary-600 disabled:opacity-50 font-medium transition-colors flex items-center justify-center gap-2"
              >
                {saving && <Spinner className="text-white" />}
                {saving ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
