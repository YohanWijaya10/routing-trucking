const vehiclesTable = document.getElementById("vehiclesTable");
const ordersTable = document.getElementById("ordersTable");
const districtGroupsTable = document.getElementById("districtGroupsTable");
const vehicleTemplate = document.getElementById("vehicleRowTemplate");
const orderTemplate = document.getElementById("orderRowTemplate");
const districtGroupTemplate = document.getElementById("districtGroupRowTemplate");

const statusPill = document.getElementById("statusPill");
const errorBox = document.getElementById("errorBox");
const textSummary = document.getElementById("textSummary");
const groupsList = document.getElementById("groupsList");
const routesList = document.getElementById("routesList");
const solverBadge = document.getElementById("solverBadge");
const matrixBadge = document.getElementById("matrixBadge");
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

let map;
let mapLayers = [];
let defaultDistrictGroupMapping = {};

function getDepotFallback(data) {
  if (data?.depot?.lat != null && data?.depot?.lng != null) {
    return data.depot;
  }
  return {
    name: document.getElementById("depotName").value.trim() || "Depot",
    lat: Number(document.getElementById("depotLat").value),
    lng: Number(document.getElementById("depotLng").value),
  };
}

function ensureMap() {
  if (map) return;
  map = L.map("map", { zoomControl: true }).setView([-7.2575, 112.7521], 11);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);
}

function clearMapLayers() {
  mapLayers.forEach((layer) => layer.remove());
  mapLayers = [];
}

function setStatus(state, label) {
  statusPill.className = `status-pill ${state}`;
  statusPill.textContent = label;
}

function clearError() {
  errorBox.classList.add("hidden");
  errorBox.classList.remove("info");
  errorBox.textContent = "";
}

function showError(message) {
  errorBox.classList.remove("hidden");
  errorBox.classList.remove("info");
  errorBox.textContent = message;
}

function showInfo(message) {
  errorBox.classList.remove("hidden");
  errorBox.classList.add("info");
  errorBox.textContent = message;
}

function colorForGroup(groupLabel) {
  const label = groupLabel || "default";
  const prefix = Object.keys(groupColorMap).find((key) => label.startsWith(key));
  if (prefix) {
    return groupColorMap[prefix];
  }
  let hash = 0;
  for (let i = 0; i < label.length; i += 1) {
    hash = ((hash << 5) - hash + label.charCodeAt(i)) | 0;
  }
  return fallbackColorPalette[Math.abs(hash) % fallbackColorPalette.length];
}

function createVehicleRow(values = {}) {
  const node = vehicleTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".vehicle-id").value = values.id || "";
  node.querySelector(".vehicle-capacity").value = values.capacity_kg || "";
  node.querySelector(".vehicle-maxstops").value = values.max_stops || "";
  node.querySelector(".remove-row").addEventListener("click", () => node.remove());
  vehiclesTable.appendChild(node);
}

function createOrderRow(values = {}) {
  const node = orderTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".order-id").value = values.id || "";
  node.querySelector(".order-name").value = values.name || "";
  node.querySelector(".order-lat").value = values.lat || "";
  node.querySelector(".order-lng").value = values.lng || "";
  node.querySelector(".order-demand").value = values.demand_kg || "";
  node.querySelector(".order-service").value = values.service_minutes || 12;
  node.querySelector(".remove-row").addEventListener("click", () => node.remove());
  ordersTable.appendChild(node);
}

function createDistrictGroupRow(district, groupLabel = "") {
  const node = districtGroupTemplate.content.firstElementChild.cloneNode(true);
  node.querySelector(".district-name").value = district;
  node.querySelector(".group-label").value = groupLabel;
  districtGroupsTable.appendChild(node);
}

function collectPayload() {
  const vehicles = [...vehiclesTable.querySelectorAll(".vehicle-row")].map((row) => ({
    id: row.querySelector(".vehicle-id").value.trim(),
    capacity_kg: Number(row.querySelector(".vehicle-capacity").value),
    ...(row.querySelector(".vehicle-maxstops").value
      ? { max_stops: Number(row.querySelector(".vehicle-maxstops").value) }
      : {}),
  }));

  const orders = [...ordersTable.querySelectorAll(".order-row")].map((row) => ({
    id: row.querySelector(".order-id").value.trim(),
    name: row.querySelector(".order-name").value.trim(),
    lat: Number(row.querySelector(".order-lat").value),
    lng: Number(row.querySelector(".order-lng").value),
    demand_kg: Number(row.querySelector(".order-demand").value),
    service_minutes: Number(row.querySelector(".order-service").value || 12),
  }));

  return {
    depot: {
      name: document.getElementById("depotName").value.trim(),
      lat: Number(document.getElementById("depotLat").value),
      lng: Number(document.getElementById("depotLng").value),
    },
    vehicles,
    orders,
  };
}

function collectDistrictGroupMap() {
  const rows = [...districtGroupsTable.querySelectorAll(".district-group-row")];
  const mapping = {};
  for (const row of rows) {
    const district = row.querySelector(".district-name").value.trim();
    const groupLabel = row.querySelector(".group-label").value.trim();
    if (district && groupLabel) {
      mapping[district] = groupLabel;
    }
  }
  return mapping;
}

function renderSummary(data) {
  document.getElementById("vehiclesUsed").textContent = data.summary.recommended_vehicle_count;
  document.getElementById("totalDistance").textContent = `${data.summary.total_distance_km} km`;
  document.getElementById("totalDuration").textContent = `${data.summary.total_duration_minutes} min`;
  document.getElementById("ordersPlanned").textContent = data.summary.orders_planned;
  solverBadge.textContent = data.summary.solver_used;
  matrixBadge.textContent = data.matrix_source;
  textSummary.textContent = data.text_summary;
  groupsList.innerHTML = "";
  routesList.innerHTML = "";

  const groups = Array.isArray(data.group_summary) ? data.group_summary : [];
  if (!groups.length) {
    groupsList.innerHTML = `<p class="muted">Belum ada grup.</p>`;
  } else {
    for (const group of groups) {
      const el = document.createElement("article");
      el.className = "group-card";
      const districts = Array.isArray(group.districts) && group.districts.length
        ? group.districts.join(", ")
        : "Tidak ada kecamatan terdeteksi";
      el.innerHTML = `
        <div class="group-head">
          <h5>${group.group_label}</h5>
          <strong>${group.load_kg} kg</strong>
        </div>
        <div class="group-meta">
          <span>${group.vehicle_count} truck</span>
          <span>${group.order_count} order</span>
          <span>${group.distance_km} km</span>
          <span>${group.duration_minutes} min</span>
        </div>
        <div class="group-note">Kecamatan: ${districts}</div>
      `;
      groupsList.appendChild(el);
    }
  }

  if (!data.routes.length) {
    routesList.innerHTML = `<p class="muted">Tidak ada rute yang terbentuk.</p>`;
    return;
  }

  for (const route of data.routes) {
    const el = document.createElement("article");
    el.className = "route-card";
    const districts = Array.isArray(route.districts) && route.districts.length
      ? route.districts.join(", ")
      : "Tidak ada kecamatan";
    el.innerHTML = `
      <div class="route-head">
        <h5>${route.vehicle_id}</h5>
        <strong>${route.load_kg}/${route.capacity_kg} kg</strong>
      </div>
      <div class="route-meta">
        <span>${route.area_label || "Area 1"}</span>
        <span>Utilization ${route.utilization_pct}%</span>
        <span>${route.stop_count} stop</span>
        <span>${route.distance_km} km</span>
        <span>${route.duration_minutes} min</span>
      </div>
      <div class="group-note">Kecamatan: ${districts}</div>
      <div class="path">${route.path.join(" -> ")}</div>
    `;
    routesList.appendChild(el);
  }

  renderMap(data);
}

function renderMap(data) {
  ensureMap();
  clearMapLayers();

  const bounds = [];
  const depot = getDepotFallback(data);
  if (Number.isNaN(depot.lat) || Number.isNaN(depot.lng)) {
    return;
  }

  const depotLatLng = [depot.lat, depot.lng];
  const depotMarker = L.marker(depotLatLng, { title: depot.name }).bindPopup(
    `<strong>${depot.name}</strong><br/>Depot`
  );
  depotMarker.addTo(map);
  mapLayers.push(depotMarker);
  bounds.push(depotLatLng);

  data.routes.forEach((route, index) => {
    const color = colorForGroup(route.area_label || String(index));
    const latlngs = [depotLatLng];
    const stops = Array.isArray(route.stops) ? route.stops : [];
    stops.forEach((stop, stopIndex) => {
      if (stop?.lat == null || stop?.lng == null) {
        return;
      }
      const latlng = [stop.lat, stop.lng];
      latlngs.push(latlng);
      bounds.push(latlng);
      const marker = L.circleMarker(latlng, {
        radius: 6,
        color,
        fillColor: color,
        fillOpacity: 0.8,
        weight: 2,
      }).bindPopup(
        `<strong>${route.vehicle_id}</strong><br/>#${stopIndex + 1} ${stop.name}<br/>${stop.demand_kg} kg`
      );
      marker.addTo(map);
      mapLayers.push(marker);
    });
    const routeGeometry = Array.isArray(route.geometry) && route.geometry.length > 1
      ? route.geometry
      : null;
    if (routeGeometry) {
      routeGeometry.forEach((point) => bounds.push(point));
    }
    if (latlngs.length > 1 || routeGeometry) {
      if (!routeGeometry) {
        latlngs.push(depotLatLng);
      }
      const line = L.polyline(routeGeometry || latlngs, {
        color,
        weight: 4,
        opacity: 0.82,
      });
      line.addTo(map);
      mapLayers.push(line);
    }
  });

  if (bounds.length) {
    map.fitBounds(bounds, { padding: [24, 24] });
  }

  const geometryRouteCount = data.routes.filter(
    (route) => Array.isArray(route.geometry) && route.geometry.length > 1
  ).length;
  if ((data.matrix_source || "").toLowerCase() === "openrouteservice" && geometryRouteCount === 0) {
    showError("ORS aktif untuk matrix, tapi geometry jalan tidak ikut balik. Peta fallback ke garis lurus.");
  }
}

async function loadSample() {
  clearError();
  const response = await fetch("/api/sample");
  const data = await response.json();
  document.getElementById("depotName").value = data.depot.name;
  document.getElementById("depotLat").value = data.depot.lat;
  document.getElementById("depotLng").value = data.depot.lng;
  vehiclesTable.innerHTML = "";
  ordersTable.innerHTML = "";
  data.vehicles.forEach(createVehicleRow);
  data.orders.forEach(createOrderRow);
}

async function loadGroupConfig() {
  const response = await fetch("/api/group-config");
  const data = await response.json();
  defaultDistrictGroupMapping = data.mapping || {};
  districtGroupsTable.innerHTML = "";
  for (const district of data.districts || []) {
    createDistrictGroupRow(district, defaultDistrictGroupMapping[district] || "");
  }
}

async function generatePlan() {
  clearError();
  setStatus("loading", "Planning");

  const solver = document.getElementById("solver").value;
  const useOrs = true;
  document.getElementById("useOrs").checked = true;
  const orsApiKey = document.getElementById("orsApiKey").value.trim();

  try {
    const response = await fetch(`/api/plan?solver=${encodeURIComponent(solver)}&use_ors=${useOrs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payload: collectPayload(),
        ors_api_key: orsApiKey || undefined,
        district_group_map: collectDistrictGroupMap(),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Planning failed");
    }

    renderSummary(data);
    setStatus("success", "Ready");
  } catch (error) {
    setStatus("error", "Error");
    showError(error.message);
  }
}

function fillFromPayload(data) {
  document.getElementById("depotName").value = data.depot.name;
  document.getElementById("depotLat").value = data.depot.lat;
  document.getElementById("depotLng").value = data.depot.lng;
  vehiclesTable.innerHTML = "";
  ordersTable.innerHTML = "";
  data.vehicles.forEach(createVehicleRow);
  data.orders.forEach(createOrderRow);
}

async function loadDummyOrders() {
  clearError();
  setStatus("loading", "Loading");

  try {
    const payload = collectPayload();
    const response = await fetch("/api/dummy-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        database_url: document.getElementById("databaseUrl").value.trim() || undefined,
        city: document.getElementById("cityName").value.trim() || "surabaya",
        limit: Number(document.getElementById("dummyCount").value || 100),
        vehicles: payload.vehicles,
        depot_name: document.getElementById("depotName").value.trim() || "Gudang Surabaya",
        depot_lat: Number(document.getElementById("depotLat").value || -7.2575),
        depot_lng: Number(document.getElementById("depotLng").value || 112.7521),
      }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to generate dummy orders");
    }
    fillFromPayload(data.payload);
    setStatus("success", `Dummy ${data.customer_count}`);
    showInfo(
      `Dummy ready: demand ${data.total_dummy_demand_kg} kg / capacity ${data.total_capacity_kg} kg`
    );
  } catch (error) {
    setStatus("error", "Error");
    showError(error.message);
  }
}

document.getElementById("addVehicleBtn").addEventListener("click", () => createVehicleRow());
document.getElementById("addOrderBtn").addEventListener("click", () => createOrderRow());
document.getElementById("loadSampleBtn").addEventListener("click", loadSample);
document.getElementById("loadDummyBtn").addEventListener("click", loadDummyOrders);
document.getElementById("planBtn").addEventListener("click", generatePlan);
document.getElementById("resetGroupsBtn").addEventListener("click", () => {
  districtGroupsTable.innerHTML = "";
  Object.keys(defaultDistrictGroupMapping)
    .sort()
    .forEach((district) => createDistrictGroupRow(district, defaultDistrictGroupMapping[district]));
});

Promise.all([loadSample(), loadGroupConfig()])
  .then(() => setStatus("idle", "Idle"))
  .catch((error) => {
    setStatus("error", "Error");
    showError(error.message);
  });
