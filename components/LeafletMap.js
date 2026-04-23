"use client";

import { MapContainer, TileLayer, Marker, Popup, CircleMarker, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const depotIcon = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

export default function LeafletMap({ depot, routes, colorForGroup }) {
  const center = depot?.lat && depot?.lng ? [depot.lat, depot.lng] : [-7.2575, 112.7521];

  return (
    <MapContainer center={center} zoom={11} className="map-box">
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {depot ? (
        <Marker position={[depot.lat, depot.lng]} icon={depotIcon}>
          <Popup>
            <strong>{depot.name}</strong>
            <br />
            Depot
          </Popup>
        </Marker>
      ) : null}
      {routes.map((route, routeIndex) => {
        const color = colorForGroup(route.area_label || String(routeIndex));
        const routeGeometry =
          Array.isArray(route.geometry) && route.geometry.length > 1 ? route.geometry : null;
        const fallbackPoints = [
          [depot.lat, depot.lng],
          ...(route.stops || []).map((stop) => [stop.lat, stop.lng]),
          [depot.lat, depot.lng],
        ];
        return (
          <div key={`${route.vehicle_id}-${routeIndex}`}>
            {(route.stops || []).map((stop, stopIndex) => (
              <CircleMarker
                key={`${route.vehicle_id}-${stop.id}-${stopIndex}`}
                center={[stop.lat, stop.lng]}
                radius={6}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.8, weight: 2 }}
              >
                <Popup>
                  <strong>{route.vehicle_id}</strong>
                  <br />#{stopIndex + 1} {stop.name}
                  <br />
                  {stop.demand_kg} kg
                </Popup>
              </CircleMarker>
            ))}
            <Polyline
              positions={routeGeometry || fallbackPoints}
              pathOptions={{ color, weight: 4, opacity: 0.82 }}
            />
          </div>
        );
      })}
    </MapContainer>
  );
}
