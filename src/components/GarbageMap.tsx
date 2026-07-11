"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { apiFetch } from "@/lib/api";

import { LatLngBoundsExpression } from "leaflet";

// Central JP Nagar approximate center
const center: [number, number] = [12.9000, 77.5850];

// JP Nagar Boundaries (Phases 1-9)
const jpBounds: LatLngBoundsExpression = [
  [12.8800, 77.5600], // South-West (approx Kanakapura Road / 9th Phase)
  [12.9300, 77.6100], // North-East (approx Bannerghatta Road / Jayanagar border)
];

interface Hotspot {
  id: number;
  pos: [number, number];
  reports: number;
  severity: string;
  image_base64?: string;
}

export default function GarbageMap() {
  const [hotspots, setHotspots] = useState<Hotspot[]>([]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await apiFetch('/reports');
        const data = await res.json();
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
    <div className="w-full h-full relative z-0">
      <MapContainer
        center={center}
        zoom={14}
        minZoom={13}
        maxBounds={jpBounds}
        maxBoundsViscosity={1.0}
        scrollWheelZoom={true}
        className="w-full h-full rounded-2xl border border-[#10b981]/20 shadow-2xl"
        zoomControl={false}
        attributionControl={false}
      >
        <TileLayer
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {hotspots.map((spot) => {
          const radius = Math.max(10, Math.min(30, spot.reports * 5 + 8));
          const color = spot.severity === 'high' ? '#ff4d6d' : spot.severity === 'medium' ? '#ff8fa3' : '#ffb3c1';

          return (
            <CircleMarker
              key={spot.id}
              center={spot.pos}
              radius={radius}
              pathOptions={{
                color: color,
                fillColor: color,
                fillOpacity: 0.6,
                weight: 2,
              }}
            >
              <Popup className="custom-popup" minWidth={150}>
                <div className="text-center font-bold flex flex-col items-center">
                  {spot.image_base64 && (
                    <img src={spot.image_base64} alt="Hotspot" className="w-full h-24 object-cover rounded-lg mb-2" />
                  )}
                  <span className="text-zinc-400 text-xl">{spot.reports}</span>
                  <span className="text-[10px] text-slate-500 uppercase tracking-widest font-black">Active Reports</span>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="absolute bottom-6 left-4 z-[400] glass-panel p-4 bg-[rgba(13,27,10,0.95)] shadow-[0_0_15px_rgba(0,0,0,0.8)] border border-[#10b981]/20 rounded-2xl">
        <h3 className="text-white font-bold text-lg leading-tight">J.P. Nagar</h3>
        {/* <p className="text-zinc-400 text-xs mb-1 font-semibold">Phases 1-9 locked</p> */}
        <p className="text-[#ff4d6d] font-black text-sm">{hotspots.reduce((acc, s) => acc + s.reports, 0)} reports live</p>
      </div>
    </div>
  );
}
