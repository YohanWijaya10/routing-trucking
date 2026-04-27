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

function Spinner({ className = "" }) {
  return (
    <div className={`inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin ${className}`} />
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

function formatRupiah(num) {
  if (!num && num !== 0) return "-";
  return "Rp " + Math.round(num).toLocaleString("id-ID");
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
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

  // Area detail state
  const [selectedArea, setSelectedArea] = useState(null);
  const [areaDetail, setAreaDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [areaSearch, setAreaSearch] = useState("");

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

  // Load area detail
  const loadAreaDetail = useCallback(async (area) => {
    setSelectedArea(area);
    setDetailLoading(true);
    setAreaDetail(null);
    try {
      const res = await fetch(`/api/area-detail?id=${area.id}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAreaDetail(data);
    } catch (e) {
      console.error("Failed to load area detail:", e);
      alert("Gagal memuat detail area: " + e.message);
      setSelectedArea(null);
    }
    setDetailLoading(false);
  }, []);

  const closeAreaDetail = () => {
    setSelectedArea(null);
    setAreaDetail(null);
  };

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
      if (selectedArea?.id === id) closeAreaDetail();
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

  // (no customer list view anymore - shows 100 latest SO directly)

  const filteredAreas = areasWithCount.filter((area) => {
    if (!areaSearch) return true;
    const q = areaSearch.toLowerCase();
    return area.name?.toLowerCase().includes(q);
  });

  const isAreaRoute = pathname === "/routes" || pathname === "/";

  return (
    <div className="h-screen overflow-hidden bg-[#f4f7fb]">
      <div className="flex h-full">
        <aside className="hidden md:flex w-[86px] shrink-0 flex-col items-center justify-between border-r border-white/70 bg-[#fbfcfe] py-5 shadow-[8px_0_30px_rgba(148,163,184,0.08)]">
          <div className="flex flex-col items-center gap-5">
            <Link href="/routes" className="mb-1">
              <SidebarIcon active={isAreaRoute}>
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
          {selectedArea ? (
            <div className="flex h-full min-h-0 flex-col">
              <div className="border-b border-slate-200/80 px-5 pb-5 pt-6">
                <button
                  onClick={closeAreaDetail}
                  className="mb-4 flex items-center gap-2 text-[12px] font-medium text-slate-500 transition-colors hover:text-slate-900"
                >
                  <span className="text-base leading-none">&#8592;</span> Kembali ke daftar area
                </button>
                <div className="flex items-center gap-3">
                  <div className="h-3 w-3 shrink-0 rounded-full" style={{ background: selectedArea.color }} />
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Detail Area</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-900">{selectedArea.name}</h2>
                  </div>
                </div>
              </div>

              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Spinner className="text-primary-500 mb-2" />
                    <p className="text-xs text-slate-500">Memuat detail...</p>
                  </div>
                </div>
              ) : areaDetail ? (
                <>
                  <div className="border-b border-slate-200/80 bg-white px-5 py-3 pt-4">
                    <p className="text-[11px] font-semibold text-slate-700">100 SO Terbaru</p>
                  </div>

                  <div className="min-h-0 flex-1 overflow-y-auto divide-y divide-slate-100">
                    {(() => {
                      // Group transactions by store name
                      const grouped = {};
                      (areaDetail.transactions || []).forEach((t) => {
                        const key = t.nama_toko || "Tanpa Nama";
                        if (!grouped[key]) grouped[key] = [];
                        grouped[key].push(t);
                      });
                      return Object.entries(grouped).map(([storeName, txs]) => {
                        const total = txs.reduce((sum, t) => sum + (t.total || 0), 0);
                        return (
                          <div key={storeName} className="px-5 py-4 transition-colors hover:bg-slate-50/70">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <div className="text-[12px] font-semibold text-slate-800">{storeName}</div>
                                <div className="mt-0.5 text-[10px] text-slate-500">{txs.length} SO</div>
                              </div>
                              <div className="text-right shrink-0">
                                <div className="text-[12px] font-semibold text-primary-600">{formatRupiah(total)}</div>
                              </div>
                            </div>
                            <div className="mt-2 space-y-1.5 border-t border-slate-100 pt-2">
                              {txs.map((t, i) => (
                                <div key={t.idso + i} className="flex items-center justify-between gap-2">
                                  <div className="text-[10px] text-slate-500">{t.idso}</div>
                                  <div className="flex items-center gap-3">
                                    <div className="text-[10px] font-medium text-slate-700">{formatRupiah(t.total)}</div>
                                    <div className="text-[10px] text-slate-400 w-16 text-right">{formatDate(t.tanggal)}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      });
                    })()}
                    {(!areaDetail.transactions || areaDetail.transactions.length === 0) && (
                      <div className="p-6 text-center">
                        <p className="text-[12px] text-slate-400">Tidak ada transaksi di area ini</p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-xs text-slate-400">Gagal memuat detail</p>
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="border-b border-slate-200/80 px-5 pb-5 pt-6">
                <p className="text-[12px] font-semibold uppercase tracking-[0.18em] text-slate-400">Buat Area Baru</p>
                <button
                  onClick={() => {
                    setDrawMode(!drawMode);
                    setEditingAreaId(null);
                  }}
                  disabled={saving}
                  className={`mt-4 flex w-full items-center gap-4 rounded-[22px] border px-4 py-4 text-left transition-all ${
                    drawMode 
                      ? "border-primary-500 bg-primary-500 text-white shadow-[0_20px_40px_rgba(26,115,232,0.22)]"
                      : "border-slate-200 bg-white text-slate-700 shadow-[0_18px_40px_rgba(148,163,184,0.12)] hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border ${
                    drawMode ? "border-white/30 bg-white/10" : "border-slate-200 bg-slate-50"
                  }`}>
                    {saving ? (
                      <Spinner className="text-current" />
                    ) : (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 5v14" />
                        <path d="M5 12h14" />
                        <path d="M3.5 8.5V5.7A2.2 2.2 0 0 1 5.7 3.5h2.8" />
                        <path d="M15.5 3.5h2.8a2.2 2.2 0 0 1 2.2 2.2v2.8" />
                        <path d="M20.5 15.5v2.8a2.2 2.2 0 0 1-2.2 2.2h-2.8" />
                        <path d="M8.5 20.5H5.7a2.2 2.2 0 0 1-2.2-2.2v-2.8" />
                      </svg>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[18px] font-semibold leading-tight">
                      {saving ? "Menyimpan..." : "Draw Area Baru"}
                    </div>
                    <div className={`mt-1 text-[13px] ${drawMode ? "text-blue-100" : "text-slate-500"}`}>
                      {drawMode ? "Klik titik di peta untuk membuat polygon" : "Buat area baru di peta"}
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-70">
                    <path d="m9 6 6 6-6 6" />
                  </svg>
                </button>
                {drawMode && (
                  <p className="mt-3 text-[12px] leading-relaxed text-primary-600">
                    Klik titik-titik di peta untuk buat polygon, lalu klik titik awal untuk selesai
                  </p>
                )}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="border-b border-slate-200/80 bg-white px-5 py-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-600">
                    Area ({areas.length})
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
                        value={areaSearch}
                        onChange={(e) => setAreaSearch(e.target.value)}
                        placeholder="Cari area..."
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
                <div className="space-y-3 px-4 py-4">
                  {filteredAreas.map((area) => (
                    <div 
                      key={area.id} 
                      className={`rounded-[20px] border bg-white px-4 py-4 shadow-[0_18px_40px_rgba(148,163,184,0.12)] transition-all ${
                        editingAreaId === area.id
                          ? "border-amber-300 bg-amber-50/70"
                          : "border-white hover:-translate-y-0.5 hover:shadow-[0_22px_44px_rgba(148,163,184,0.16)]"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-4 w-4 shrink-0 rounded-full shadow-[0_0_0_4px_rgba(255,255,255,0.9)]" style={{ background: area.color }} />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-[15px] font-semibold text-slate-900">{area.name}</div>
                          <div className="mt-1 text-[12px] text-slate-500">{area.count.toLocaleString("id-ID")} toko</div>
                        </div>
                        <button
                          onClick={() => loadAreaDetail(area)}
                          className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                          aria-label={`Lihat detail ${area.name}`}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="m9 18 6-6-6-6" />
                          </svg>
                        </button>
                      </div>
                      <div className="mt-3 flex items-center gap-2">
                        <button
                          onClick={() => loadAreaDetail(area)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-primary-600 transition-colors hover:bg-primary-50"
                        >
                          Detail
                        </button>
                        <button
                          onClick={() => toggleEdit(area.id)}
                          className={`rounded-lg px-2.5 py-1.5 text-[11px] font-medium transition-colors ${
                            editingAreaId === area.id 
                              ? "bg-amber-500 text-white" 
                              : "text-slate-400 hover:bg-slate-100 hover:text-amber-600"
                          }`}
                        >
                          {editingAreaId === area.id ? "Selesai" : "Edit"}
                        </button>
                        <button
                          onClick={() => deleteArea(area.id)}
                          className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-400 transition-colors hover:bg-red-50 hover:text-red-600"
                        >
                          Hapus
                        </button>
                      </div>
                      {editingAreaId === area.id && (
                        <p className="mt-2 text-[11px] text-amber-600">
                          Tarik titik sudut untuk edit polygon
                        </p>
                      )}
                    </div>
                  ))}

                  {filteredAreas.length === 0 && (
                    <div className="rounded-[20px] border border-dashed border-slate-200 bg-white/70 p-8 text-center">
                      <p className="text-[13px] text-slate-400">{areaSearch ? "Area tidak ditemukan" : "Belum ada area"}</p>
                      <p className="mt-1 text-[11px] text-slate-300">Klik tombol di atas untuk membuat area baru</p>
                    </div>
                  )}

                  <div className="rounded-[20px] border border-red-100 bg-[linear-gradient(135deg,rgba(254,242,242,0.95),rgba(255,255,255,0.85))] px-4 py-4 shadow-[0_18px_40px_rgba(248,113,113,0.08)]">
                    <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500">
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="m15 9-6 6" />
                        <path d="m9 9 6 6" />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate text-[15px] font-semibold text-red-600">Belum Ter-assign</div>
                      <div className="mt-1 text-[12px] text-red-400">{unassignedCount.toLocaleString("id-ID")} toko</div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </aside>

        <div className="relative flex-1 overflow-hidden bg-[#dceefe]">
          <div className="pointer-events-none absolute inset-0 z-[400] bg-[radial-gradient(circle_at_left_center,rgba(255,255,255,0.45),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.26),rgba(255,255,255,0.08))]" />
          <div className="pointer-events-none absolute left-8 top-8 z-[401] hidden rounded-2xl border border-white/60 bg-white/75 px-4 py-3 shadow-[0_24px_60px_rgba(148,163,184,0.18)] backdrop-blur md:block">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Area Mapping</div>
            <div className="mt-1 text-sm font-semibold text-slate-900">{orders.length.toLocaleString("id-ID")} toko aktif</div>
          </div>
          <LeafletMap
            depot={{ name: "Gudang", lat: -7.2575, lng: 112.7521 }}
            onPolygonCreated={drawMode ? handlePolygonCreated : null}
            areaPolygons={mapPolygons}
            drawEnabled={drawMode}
            editingAreaId={editingAreaId}
            onEditArea={handleEditArea}
            theme="light"
          />
        </div>
      </div>

      {showNameModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="w-[360px] rounded-[24px] border border-white/70 bg-white p-5 shadow-[0_30px_80px_rgba(15,23,42,0.22)]">
            <h3 className="mb-1 text-base font-bold text-slate-900">Simpan Area Baru</h3>
            <p className="mb-4 text-[12px] text-slate-500">
              {pendingPolygon?.length || 0} titik polygon tercatat
            </p>
            <input
              type="text"
              value={modalName}
              onChange={(e) => setModalName(e.target.value)}
              placeholder="Nama area..."
              className="mb-4 w-full rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none transition-all focus:border-primary-400 focus:ring-2 focus:ring-primary-100"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && saveArea()}
            />
            <div className="flex gap-3">
              <button
                onClick={cancelSave}
                className="flex-1 rounded-xl border border-slate-300 px-4 py-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                onClick={saveArea}
                disabled={!modalName.trim() || saving}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary-500 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-primary-600 disabled:opacity-50"
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
