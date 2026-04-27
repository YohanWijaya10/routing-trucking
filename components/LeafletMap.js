"use client";

import { Fragment, useEffect, useRef } from "react";
import { MapContainer, TileLayer, Marker, Popup, Polyline, CircleMarker, useMap, ZoomControl } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-draw/dist/leaflet.draw.css";

let leafletDrawLoaded = false;
function loadLeafletDraw() {
  if (leafletDrawLoaded) return Promise.resolve();
  return import("leaflet-draw").then(() => {
    leafletDrawLoaded = true;
  });
}

const depotIcon = new L.DivIcon({
  className: "custom-depot-marker",
  html: `
    <div style="
      width: 36px; height: 36px; 
      background: #1a73e8; 
      border-radius: 50% 50% 50% 0; 
      transform: rotate(-45deg); 
      border: 3px solid white; 
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      display: flex; align-items: center; justify-content: center;
    ">
      <span style="transform: rotate(45deg); font-size: 14px;">🏭</span>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 36],
  popupAnchor: [0, -36],
});

// Vertex marker icon (colored dot)
function createVertexIcon(color) {
  return L.divIcon({
    className: "vertex-marker",
    html: `<div style="
      width: 16px; height: 16px;
      background: ${color};
      border: 3px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 4px rgba(0,0,0,0.3);
      cursor: move;
    "></div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
}

// Midpoint marker icon (white dot with colored border)
function createMidpointIcon(color) {
  return L.divIcon({
    className: "midpoint-marker",
    html: `<div style="
      width: 12px; height: 12px;
      background: white;
      border: 2px solid ${color};
      border-radius: 50%;
      box-shadow: 0 1px 3px rgba(0,0,0,0.3);
      cursor: crosshair;
    "></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });
}

// Draw control for creating new areas
function DrawControl({ onPolygonCreated, enabled }) {
  const map = useMap();
  const controlRef = useRef(null);
  const handlerRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      if (controlRef.current) {
        map.removeControl(controlRef.current);
        controlRef.current = null;
      }
      if (handlerRef.current) {
        map.off(L.Draw.Event.CREATED, handlerRef.current);
        handlerRef.current = null;
      }
      return;
    }

    loadLeafletDraw().then(() => {
      if (!map || controlRef.current) return;

      const drawnItems = new L.FeatureGroup();
      map.addLayer(drawnItems);

      const drawControl = new L.Control.Draw({
        position: "topright",
        draw: {
          polygon: {
            allowIntersection: false,
            showArea: true,
            drawError: { color: "#e74c3c", timeout: 1000 },
            shapeOptions: { color: "#1a73e8", weight: 3, fillOpacity: 0.15 },
          },
          polyline: false,
          rectangle: false,
          circle: false,
          circlemarker: false,
          marker: false,
        },
        edit: false,
      });
      
      map.addControl(drawControl);
      controlRef.current = drawControl;

      const handleCreated = (e) => {
        const layer = e.layer;
        drawnItems.addLayer(layer);
        const latlngs = layer.getLatLngs()[0];
        const polygon = latlngs.map((ll) => ({ lat: ll.lat, lng: ll.lng }));
        if (onPolygonCreated) onPolygonCreated(polygon);
        drawnItems.clearLayers();
      };
      
      handlerRef.current = handleCreated;
      map.on(L.Draw.Event.CREATED, handleCreated);

      return () => {
        if (handlerRef.current) {
          map.off(L.Draw.Event.CREATED, handlerRef.current);
          handlerRef.current = null;
        }
        if (controlRef.current) {
          map.removeControl(controlRef.current);
          controlRef.current = null;
        }
        map.removeLayer(drawnItems);
      };
    });
  }, [map, enabled]);

  return null;
}

// Map fitter for editing area
function EditAreaFitter({ editingAreaId, polygons }) {
  const map = useMap();
  useEffect(() => {
    if (editingAreaId && polygons.length > 0) {
      const editingPoly = polygons.find((p) => p.id === editingAreaId);
      if (editingPoly && editingPoly.polygon.length > 0) {
        const latlngs = editingPoly.polygon.map((p) => [p.lat, p.lng]);
        map.fitBounds(latlngs, { padding: [100, 100], maxZoom: 16 });
      }
    }
  }, [map, editingAreaId, polygons]);
  return null;
}

function OverviewFitter({ polygons, editingAreaId }) {
  const map = useMap();

  useEffect(() => {
    if (editingAreaId || polygons.length === 0) return;

    const bounds = [];
    polygons.forEach((poly) => {
      if (!Array.isArray(poly.polygon)) return;
      poly.polygon.forEach((point) => {
        if (typeof point?.lat === "number" && typeof point?.lng === "number") {
          bounds.push([point.lat, point.lng]);
        }
      });
    });

    if (bounds.length >= 3) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 11 });
    }
  }, [map, polygons, editingAreaId]);

  return null;
}

function RouteFitter({ routes }) {
  const map = useMap();

  useEffect(() => {
    if (!routes?.length) return;

    const bounds = [];
    routes.forEach((route) => {
      if (Array.isArray(route.geometry) && route.geometry.length > 1) {
        route.geometry.forEach((point) => {
          if (Array.isArray(point) && point.length === 2) bounds.push(point);
        });
      } else if (Array.isArray(route.stops)) {
        route.stops.forEach((stop) => {
          if (typeof stop?.lat === "number" && typeof stop?.lng === "number") {
            bounds.push([stop.lat, stop.lng]);
          }
        });
      }
    });

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 13 });
    }
  }, [map, routes]);

  return null;
}

function RouteLayers({ routes = [] }) {
  const colors = ["#1a73e8", "#ea4335", "#34a853", "#9334e6", "#ff6d00", "#00bcd4"];

  return routes.map((route, routeIndex) => {
    const color = colors[routeIndex % colors.length];
    const geometry = Array.isArray(route.geometry) ? route.geometry : [];
    const stops = Array.isArray(route.stops) ? route.stops : [];

    return (
      <Fragment key={`${route.vehicle_id || "route"}-${routeIndex}`}>
        {geometry.length > 1 && (
          <Polyline
            positions={geometry}
            pathOptions={{
              color,
              weight: 5,
              opacity: 0.9,
            }}
          />
        )}

        {stops.map((stop, stopIndex) => (
          <CircleMarker
            key={`${routeIndex}-${stop.id || stopIndex}`}
            center={[stop.lat, stop.lng]}
            radius={8}
            pathOptions={{
              color: "#ffffff",
              weight: 3,
              fillColor: color,
              fillOpacity: 1,
            }}
          >
            <Popup>
              <div style={{ minWidth: 180 }}>
                <strong style={{ color }}>{stopIndex + 1}. {stop.name}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {stop.district_label || stop.area_label || "-"}
                </div>
              </div>
            </Popup>
          </CircleMarker>
        ))}
      </Fragment>
    );
  });
}

// Editable area polygons with draggable vertices
function AreaPolygons({ polygons, onEdit, editingAreaId }) {
  const map = useMap();
  const layersRef = useRef({});

  useEffect(() => {
    // Clean up removed areas
    const currentIds = polygons.map((p) => p.id).filter(Boolean);
    Object.keys(layersRef.current).forEach((id) => {
      if (!currentIds.includes(Number(id))) {
        const layer = layersRef.current[id];
        if (layer.polygon) map.removeLayer(layer.polygon);
        if (layer.vertexMarkers) layer.vertexMarkers.forEach((m) => map.removeLayer(m));
        if (layer.midpointMarkers) layer.midpointMarkers.forEach((m) => map.removeLayer(m));
        delete layersRef.current[id];
      }
    });

    polygons.forEach((poly) => {
      if (!poly || !Array.isArray(poly.polygon) || poly.polygon.length < 3) return;
      
      const isEditing = editingAreaId === poly.id;
      const existing = layersRef.current[poly.id];
      
      // Remove old layers
      if (existing) {
        if (existing.polygon) map.removeLayer(existing.polygon);
        if (existing.vertexMarkers) existing.vertexMarkers.forEach((m) => map.removeLayer(m));
        if (existing.midpointMarkers) existing.midpointMarkers.forEach((m) => map.removeLayer(m));
      }

      // Create polygon
      const latlngs = poly.polygon.map((p) => [p.lat, p.lng]);
      const polygonLayer = L.polygon(latlngs, {
        color: poly.color || "#1a73e8",
        weight: isEditing ? 2.5 : 2,
        fillOpacity: isEditing ? 0.14 : 0.06,
        dashArray: isEditing ? null : "6, 6",
      }).addTo(map);

      polygonLayer.bindPopup(`<b>${poly.name}</b><br>${poly.polygon.length} titik`);

      const vertexMarkers = [];
      const midpointMarkers = [];

      if (isEditing) {
        // Keep mutable state for current polygon during drag
        const state = { polygon: poly.polygon.map((p) => ({ ...p })) };

        // Function to update midpoints based on current state
        const refreshMidpoints = () => {
          // Remove old midpoints
          midpointMarkers.forEach((m) => map.removeLayer(m));
          midpointMarkers.length = 0;

          const currentPoly = state.polygon;
          for (let i = 0; i < currentPoly.length; i++) {
            const j = (i + 1) % currentPoly.length;
            const midLat = (currentPoly[i].lat + currentPoly[j].lat) / 2;
            const midLng = (currentPoly[i].lng + currentPoly[j].lng) / 2;
            
            const midpoint = L.marker([midLat, midLng], {
              icon: createMidpointIcon(poly.color || "#1a73e8"),
              draggable: false,
            }).addTo(map);

            midpoint.on("click", () => {
              const newPolygon = [...state.polygon];
              newPolygon.splice(j, 0, { lat: midLat, lng: midLng });
              if (onEdit) onEdit(poly.id, newPolygon);
            });

            midpointMarkers.push(midpoint);
          }
        };

        // Create draggable vertex markers
        poly.polygon.forEach((point, idx) => {
          const marker = L.marker([point.lat, point.lng], {
            icon: createVertexIcon(poly.color || "#1a73e8"),
            draggable: true,
          }).addTo(map);

          marker.on("drag", (e) => {
            const newLatLng = e.target.getLatLng();
            state.polygon[idx] = { lat: newLatLng.lat, lng: newLatLng.lng };
            
            // Update polygon shape
            const newLatLngs = state.polygon.map((p) => [p.lat, p.lng]);
            polygonLayer.setLatLngs(newLatLngs);
            
            // Update midpoints
            refreshMidpoints();
          });

          marker.on("dragend", () => {
            if (onEdit) {
              onEdit(poly.id, state.polygon.map((p) => ({ ...p })));
            }
          });

          vertexMarkers.push(marker);
        });

        // Initial midpoints
        refreshMidpoints();
      }

      layersRef.current[poly.id] = { 
        polygon: polygonLayer, 
        vertexMarkers, 
        midpointMarkers 
      };
    });

    return () => {
      Object.values(layersRef.current).forEach((layer) => {
        if (layer.polygon) map.removeLayer(layer.polygon);
        if (layer.vertexMarkers) layer.vertexMarkers.forEach((m) => map.removeLayer(m));
        if (layer.midpointMarkers) layer.midpointMarkers.forEach((m) => map.removeLayer(m));
      });
      layersRef.current = {};
    };
  }, [map, polygons, editingAreaId, onEdit]);

  return null;
}

export default function LeafletMap({
  depot,
  onPolygonCreated,
  areaPolygons = [],
  routes = [],
  drawEnabled = false,
  editingAreaId = null,
  onEditArea = null,
  theme = "light",
}) {
  const center = depot?.lat && depot?.lng ? [depot.lat, depot.lng] : [-7.2575, 112.7521];
  const tileUrl =
    theme === "dark"
      ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  const attribution =
    theme === "dark"
      ? '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
      : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';

  return (
    <MapContainer
      center={center}
      zoom={9}
      zoomControl={false}
      className="route-map"
      style={{ width: "100%", height: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution={attribution}
        url={tileUrl}
      />
      <ZoomControl position="topleft" />

      <DrawControl onPolygonCreated={onPolygonCreated} enabled={drawEnabled} />
      <OverviewFitter polygons={areaPolygons} editingAreaId={editingAreaId} />
      <EditAreaFitter editingAreaId={editingAreaId} polygons={areaPolygons} />
      <RouteFitter routes={routes} />
      <AreaPolygons polygons={areaPolygons} editingAreaId={editingAreaId} onEdit={onEditArea} />
      <RouteLayers routes={routes} />

      {depot && (
        <Marker position={[depot.lat, depot.lng]} icon={depotIcon}>
          <Popup>
            <div style={{ minWidth: 160 }}>
              <strong style={{ fontSize: 14, color: "#1a73e8" }}>🏭 {depot.name}</strong>
            </div>
          </Popup>
        </Marker>
      )}
    </MapContainer>
  );
}
