"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, CircleMarker } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import L from "leaflet";
import MarkerClusterGroup from "react-leaflet-cluster";
import { getImageUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";

import { LatLngBoundsExpression } from "leaflet";

// Initial center
const center: [number, number] = [12.9000, 77.5850];

// Allowed bounds: South West [lat, lng] to North East [lat, lng]
// Strictly covers JP Nagar, Jayanagar, and BTM Layout
const allowedBounds: LatLngBoundsExpression = [
  [12.865, 77.550], // South West 
  [12.945, 77.625]  // North East
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
  const [guardian, setGuardian] = useState<string>("Loading...");

  useEffect(() => {
    const fetchReports = async () => {
      try {
        const { data, error } = await supabase.from('reports').select('*');
        if (error || !data) return;
        const formattedData = data.map((r: any) => ({ 
          ...r, 
          pos: [
            r.lat + (Math.random() - 0.5) * 0.0002, 
            r.lng + (Math.random() - 0.5) * 0.0002
          ] 
        }));
        cachedHotspots = formattedData;
        setHotspots(formattedData);
        
        // Fetch guardian
        const { data: users } = await supabase.from('users').select('name, xp').order('xp', { ascending: false }).limit(1);
        if (users && users.length > 0) {
          setGuardian(users[0].name);
        }
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

        {userLoc && (
          <Marker
            position={[userLoc.lat, userLoc.lng]}
            icon={L.divIcon({
              className: 'user-location-marker',
              html: `
                <div class="relative flex items-center justify-center w-12 h-12">
                  <div class="absolute inset-0 bg-[#3b82f6] rounded-full opacity-30 animate-ping"></div>
                  <div class="absolute inset-2 bg-[#3b82f6]/20 rounded-full border-2 border-[#3b82f6] shadow-[0_0_15px_#3b82f6] flex items-center justify-center backdrop-blur-sm">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </div>
                </div>
              `,
              iconSize: [48, 48],
              iconAnchor: [24, 24]
            })}
          >
            <Popup className="custom-popup">
              <div className="font-bold text-[#3b82f6] text-center">Eco-Warrior (You)</div>
            </Popup>
          </Marker>
        )}

        <MarkerClusterGroup
          chunkedLoading
          spiderfyOnMaxZoom={false}
          showCoverageOnHover={false}
          maxClusterRadius={40}
          zoomToBoundsOnClick={true}
          disableClusteringAtZoom={17}
          iconCreateFunction={(cluster: any) => {
            const count = cluster.getChildCount();
            const size = Math.max(50, Math.min(70, count * 3 + 40));
            return L.divIcon({
              html: `
                <div style="width: ${size}px; height: ${size}px;" class="relative flex items-center justify-center">
                  <svg class="absolute inset-0 w-full h-full text-[#990000] opacity-40 animate-pulse" viewBox="0 0 100 100" fill="currentColor">
                    <polygon points="50 1 95 25 95 75 50 99 5 75 5 25" />
                  </svg>
                  <svg class="absolute w-[80%] h-[80%] text-[#cc0000] drop-shadow-[0_0_10px_#ff0000]" viewBox="0 0 100 100" fill="none" stroke="currentColor" stroke-width="4">
                    <polygon points="50 1 95 25 95 75 50 99 5 75 5 25" />
                  </svg>
                  <span class="relative z-10 text-white font-black text-xl drop-shadow-md">${count}</span>
                </div>
              `,
              className: 'custom-cluster',
              iconSize: L.point(size, size, true),
            });
          }}
        >
          {hotspots.map((spot) => {
            let level = 1;
            let color = '#f59e0b'; // Yellow/Orange
            let glowColor = '#d97706';
            let iconSvg = '';
            let size = 44;

            if (spot.severity === 'critical') {
              level = 4;
              color = '#800000'; // Dark Maroon
              glowColor = '#4a0404';
              iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="9" r="2"/><circle cx="9" cy="9" r="2"/></svg>`;
              size = 64;
            } else if (spot.severity === 'severe' || spot.severity === 'high') {
              level = 3;
              color = '#ff0000'; // Bright proper red
              glowColor = '#cc0000';
              iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16l-2-10H6L4 21z"/><path d="M7 11V8a1 1 0 0 1 1-1h1"/><path d="M11 11V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M17 11V9a1 1 0 0 0-1-1h-1"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`;
              size = 56;
            } else if (spot.severity === 'moderate' || spot.severity === 'medium') {
              level = 2;
              color = '#ff7f50'; // Coral
              glowColor = '#ff6347'; // Tomato (Coral glow)
              iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
              size = 50;
            } else {
              iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
            }
            
            const customIcon = L.divIcon({
              className: 'custom-div-icon',
              html: `
                <div class="relative flex items-center justify-center transition-transform hover:scale-110" style="width: ${size}px; height: ${size}px; color: ${color};">
                  <!-- Toxic Aura -->
                  <div class="absolute inset-0 rounded-full opacity-50 animate-ping" style="background-color: ${glowColor}; animation-duration: 2.5s;"></div>
                  
                  <!-- Solid Token Base -->
                  <div class="absolute inset-1 rounded-full border-[3px] flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black shadow-lg" style="border-color: ${glowColor}; box-shadow: 0 0 15px ${glowColor}, inset 0 0 10px ${glowColor};">
                     ${iconSvg}
                  </div>
                  
                  <!-- Level Badge (Game Style) -->
                  <div class="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-black border-2 flex items-center justify-center font-black text-[9px] text-white z-10" style="border-color: ${glowColor}; box-shadow: 0 0 8px ${glowColor}">
                    L${level}
                  </div>
                </div>
              `,
              iconSize: [size, size],
              iconAnchor: [size/2, size/2]
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
        <h3 className="text-white font-bold text-lg leading-tight">South Bengaluru</h3>
        <p className="text-[#ff4d6d] font-black text-xs mb-2">{hotspots.length} reports live</p>
        
        <div className="bg-[#d4af37]/10 border border-[#d4af37]/30 rounded-lg p-2 flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-[#d4af37] flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 6 6 1-4 4 1 6-6-3-6 3 1-6-4-4 6-1z"/></svg>
          </div>
          <div>
            <p className="text-[10px] text-[#d4af37] font-bold uppercase tracking-widest leading-none">Sector Guardian</p>
            <p className="text-white font-black text-sm leading-none mt-1">@{guardian}</p>
          </div>
        </div>
      </div>

      {/* Border Overlay perfectly overlaying the map */}
      <div className="absolute inset-0 z-[999] pointer-events-none rounded-2xl border border-white/20" />
    </div>
  );
}
