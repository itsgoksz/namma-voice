"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { apiFetch, getImageUrl } from "@/lib/api";

import { LatLngBoundsExpression } from "leaflet";

// Initial center
const center: [number, number] = [12.9000, 77.5850];

// Allowed bounds: South West [lat, lng] to North East [lat, lng]
// Covers JP Nagar, Jayanagar, and BTM Layout
const allowedBounds: LatLngBoundsExpression = [
  [12.880, 77.550], // South West 
  [12.950, 77.630]  // North East
];

interface Hotspot {
  id: number;
  pos: [number, number];
  reports: number;
  severity: string;
  image_base64?: string;
}

let cachedHotspots: Hotspot[] | null = null;

interface GarbageMapProps {
  userLoc?: { lat: number; lng: number } | null;
}

function LocationTracker({ loc }: { loc?: { lat: number; lng: number } | null }) {
  const map = useMap();
  const [hasCentered, setHasCentered] = useState(false);

  useEffect(() => {
    if (loc && !hasCentered) {
      map.flyTo([loc.lat, loc.lng], 15, { animate: true, duration: 1.5 });
      setHasCentered(true);
    }
  }, [loc, map, hasCentered]);
  return null;
}

export default function GarbageMap({ userLoc }: GarbageMapProps) {
  const [hotspots, setHotspots] = useState<Hotspot[]>(cachedHotspots || []);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await apiFetch('/reports');
        const data = await res.json();
        cachedHotspots = data;
        setHotspots(data);
      } catch (e) {
        console.error("Failed to fetch reports", e);
      }
    };

    fetchReports();
    // Refresh every 5 seconds for live testing
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full h-full relative z-0 bg-black">
      <MapContainer
        center={userLoc ? [userLoc.lat, userLoc.lng] : center}
        zoom={14}
        minZoom={13}
        maxBounds={allowedBounds}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        className="w-full h-full bg-transparent"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <LocationTracker loc={userLoc} />

        {/* User Location Marker */}
        {userLoc && (
          <CircleMarker
            center={[userLoc.lat, userLoc.lng]}
            radius={8}
            pathOptions={{
              color: '#3b82f6',
              fillColor: '#3b82f6',
              fillOpacity: 1,
              weight: 3,
            }}
          >
            <Popup className="custom-popup">
              <div className="font-bold text-[#3b82f6] text-center">You are here</div>
            </Popup>
          </CircleMarker>
        )}

        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom={false}
          showCoverageOnHover={false}
          maxClusterRadius={50}
          zoomToBoundsOnClick={false}
          iconCreateFunction={(cluster: any) => {
            const count = cluster.getChildCount();
            const size = Math.max(40, Math.min(60, count * 2 + 30));
            return L.divIcon({
              html: `
                <div 
                  style="width: ${size}px; height: ${size}px;" 
                  class="relative flex items-center justify-center rounded-full cursor-pointer"
                  onclick="this.querySelector('span').style.color = 'white';"
                >
                  <div class="absolute inset-0 bg-[#ff4d6d] rounded-full opacity-40 animate-ping" style="animation-duration: 3s;"></div>
                  <div class="absolute inset-1 bg-[#ff4d6d] rounded-full border-2 border-white/30 shadow-[0_0_20px_#ff4d6d] flex items-center justify-center">
                    <span class="text-transparent font-black text-xl drop-shadow-md transition-colors duration-300 select-none">${count}</span>
                  </div>
                </div>
              `,
              className: 'custom-cluster',
              iconSize: L.point(size, size, true),
            });
          }}
        >
          {hotspots.map((spot) => {
            const radius = Math.max(10, Math.min(30, spot.reports * 5 + 8));
            const color = spot.severity === 'high' ? '#ff4d6d' : spot.severity === 'medium' ? '#ff8fa3' : '#ffb3c1';
            
            const customIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `<div style="background-color: ${color}; width: ${radius*2}px; height: ${radius*2}px; border-radius: 50%; opacity: 0.6; border: 2px solid ${color}; transform: translate(-50%, -50%);"></div>`,
              iconSize: [0, 0],
              iconAnchor: [0, 0]
            });

            return (
              <Marker
                key={spot.id}
                position={spot.pos}
                icon={customIcon}
              >
                <Popup className="custom-popup" minWidth={150}>
                  <div className="text-center font-bold flex flex-col items-center">
                    {spot.image_base64 && (
                      <img src={getImageUrl(spot.image_base64)} alt="Hotspot" className="w-full h-24 object-cover rounded-lg mb-2" crossOrigin="anonymous" />
                    )}
                    <span className="text-zinc-400 text-xl">{spot.reports}</span>
                    <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Active Reports</span>
                  </div>
                </Popup>
              </Marker>
            );
          })}
        </MarkerClusterGroup>
      </MapContainer>

      <div className="absolute bottom-6 left-4 z-[400] glass-panel p-4 bg-[rgba(13,27,10,0.95)] shadow-[0_0_15px_rgba(0,0,0,0.8)] border border-[#10b981]/20 rounded-2xl">
        <h3 className="text-white font-bold text-lg leading-tight">J.P. Nagar</h3>
        {/* <p className="text-zinc-400 text-xs mb-1 font-semibold">Phases 1-9 locked</p> */}
        <p className="text-[#ff4d6d] font-black text-sm">{hotspots.reduce((acc, s) => acc + s.reports, 0)} reports live</p>
      </div>

      {/* Border Overlay perfectly overlaying the map */}
      <div className="absolute inset-0 z-[999] pointer-events-none rounded-2xl border border-white/20" />
    </div>
  );
}
