"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Map, { Marker, Popup, MapRef, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";
import useSupercluster from "use-supercluster";
import { getImageUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Navigation, X, Loader2 } from "lucide-react";

// Initial center
const center: [number, number] = [12.9000, 77.5850];

// Allowed bounds: MapLibre uses [westLng, southLat, eastLng, northLat]
// Strictly covers JP Nagar, Jayanagar, and BTM Layout
const allowedBounds: [number, number, number, number] = [
  77.550, 12.865, // South West [lng, lat]
  77.625, 12.945  // North East [lng, lat]
];

const rasterMapStyle = {
  version: 8,
  sources: {
    'carto-dark': {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
      ],
      tileSize: 256
    }
  },
  layers: [
    {
      id: 'carto-dark-layer',
      type: 'raster',
      source: 'carto-dark',
      minzoom: 0,
      maxzoom: 22
    }
  ]
};

interface Hotspot {
  id: number;
  pos: [number, number]; // [lat, lng]
  reports: number;
  severity: string;
  image_base64?: string;
  status?: string;
  cleanup_image_base64?: string;
}

let cachedHotspots: Hotspot[] | null = null;

interface GarbageMapProps {
  userLoc?: { lat: number; lng: number } | null;
}

export default function GarbageMap({ userLoc }: GarbageMapProps) {
  const mapRef = useRef<MapRef>(null);
  
  const [viewState, setViewState] = useState({
    latitude: userLoc?.lat || center[0],
    longitude: userLoc?.lng || center[1],
    zoom: 15
  });

  const [hotspots, setHotspots] = useState<Hotspot[]>(cachedHotspots || []);
  const [guardian, setGuardian] = useState<string>("Loading...");
  const [selectedSpot, setSelectedSpot] = useState<Hotspot | null>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const [activeRoute, setActiveRoute] = useState<[number, number][] | null>(null);
  const [isRouting, setIsRouting] = useState(false);

  const handleNavigate = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!userLoc || !selectedSpot) return;
    setIsRouting(true);
    try {
      const start = { lng: userLoc.lng, lat: userLoc.lat };
      const end = { lng: selectedSpot.pos[1], lat: selectedSpot.pos[0] };
      const response = await fetch(
        `https://router.project-osrm.org/route/v1/driving/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson`
      );
      const data = await response.json();
      if (data.routes?.length > 0) {
        const coords = data.routes[0].geometry.coordinates;
        setActiveRoute(coords);
        setSelectedSpot(null); // Hide popup to view route
        
        // Calculate bounding box of the route to fit the camera
        const routeBounds = coords.reduce((acc: [[number, number], [number, number]], coord: [number, number]) => {
          return [
            [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
            [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
          ] as [[number, number], [number, number]];
        }, [[Infinity, Infinity], [-Infinity, -Infinity]]);
        
        if (mapRef.current) {
          mapRef.current.fitBounds(routeBounds, { padding: 60, duration: 1500 });
        }
      }
    } catch (error) {
      console.error("Failed to fetch route:", error);
      alert("Failed to fetch routing data. Please try again.");
    } finally {
      setIsRouting(false);
    }
  };

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

    const subscription = supabase
      .channel('public:reports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reports' }, () => {
        fetchReports();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, []);

  // Center on user exactly once when location is available
  useEffect(() => {
    if (userLoc && !hasCentered && mapRef.current) {
      mapRef.current.flyTo({
        center: [userLoc.lng, userLoc.lat],
        duration: 1500,
        zoom: 15
      });
      setHasCentered(true);
    }
  }, [userLoc, hasCentered]);

  // Clustering logic
  const points = hotspots.map(spot => ({
    type: "Feature" as const,
    properties: { cluster: false, hotspot: spot, hotspotId: spot.id },
    geometry: {
      type: "Point" as const,
      coordinates: [spot.pos[1], spot.pos[0]] // GeoJSON expects [lng, lat]
    }
  }));

  const bounds = mapRef.current ? mapRef.current.getMap().getBounds().toArray().flat() as [number, number, number, number] : null;

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds: bounds || undefined,
    zoom: viewState.zoom,
    options: { radius: 40, maxZoom: 17 }
  });

  return (
    <div className="w-full h-full relative z-0 bg-black">
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        ref={mapRef}
        mapStyle={rasterMapStyle as any}
        maxBounds={allowedBounds}
        maxZoom={22}
        minZoom={13}
        attributionControl={false}
      >
        <Source 
          id="route" 
          type="geojson" 
          data={{
            type: "FeatureCollection",
            features: activeRoute ? [{
              type: "Feature",
              properties: {},
              geometry: {
                type: "LineString",
                coordinates: activeRoute
              }
            }] : []
          }}
        >
          <Layer
            id="route-layer"
            type="line"
            source="route"
            layout={{
              "line-join": "round",
              "line-cap": "round",
              "visibility": activeRoute && activeRoute.length > 0 ? "visible" : "none"
            }}
            paint={{
              "line-color": "#f14f4f",
              "line-width": 6,
              "line-opacity": 1
            }}
          />
        </Source>
        
        {userLoc && (
          <Marker
            longitude={userLoc.lng}
            latitude={userLoc.lat}
            anchor="bottom"
          >
            <div className="relative flex flex-col items-center justify-center w-24">
              <div className="bg-black/80 px-2 py-0.5 rounded text-[10px] font-black text-[#adc34b] tracking-wide uppercase mb-1">
                You (Eco-Guardian)
              </div>
              <div className="relative w-12 h-12 flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-12 h-12 filter drop-shadow-[0_0_12px_rgba(173,195,75,0.9)]">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2c-4.42 0-8 3.58-8 8 0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="#adc34b" />
                </svg>
              </div>
            </div>
          </Marker>
        )}

        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = cluster.properties;

          if (isCluster) {
            const size = Math.max(50, Math.min(70, pointCount * 3 + 40));
            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={longitude}
                latitude={latitude}
                anchor="center"
                onClick={() => {
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(cluster.id as number),
                    22
                  );
                  mapRef.current?.flyTo({
                    center: [longitude, latitude],
                    zoom: expansionZoom,
                    duration: 500
                  });
                }}
              >
                <div style={{ width: size, height: size }} className="relative flex items-center justify-center cursor-pointer">
                  <svg className="absolute inset-0 w-full h-full text-[#990000] opacity-40 animate-pulse" viewBox="0 0 100 100" fill="currentColor">
                    <polygon points="50 1 95 25 95 75 50 99 5 75 5 25" />
                  </svg>
                  <svg className="absolute w-[80%] h-[80%] text-[#cc0000] drop-shadow-[0_0_10px_#ff0000]" viewBox="0 0 100 100" fill="none" stroke="currentColor" strokeWidth="4">
                    <polygon points="50 1 95 25 95 75 50 99 5 75 5 25" />
                  </svg>
                  <span className="relative z-10 text-white font-black text-xl drop-shadow-md">{pointCount}</span>
                </div>
              </Marker>
            );
          }

          const spot = cluster.properties.hotspot as Hotspot;
          let level = 1;
          let color = '#f59e0b';
          let glowColor = '#d97706';
          let iconSvg = '';
          let size = 44;

          if (spot.status === 'CLEANED') {
            level = 0;
            color = '#10b981';
            glowColor = '#059669';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>`;
            size = 50;
          } else if (spot.severity === 'critical') {
            level = 4;
            color = '#800000';
            glowColor = '#4a0404';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m12.5 17-.5-1-.5 1h1z"/><path d="M15 22a1 1 0 0 0 1-1v-1a2 2 0 0 0 1.56-3.25 8 8 0 1 0-11.12 0A2 2 0 0 0 8 20v1a1 1 0 0 0 1 1z"/><circle cx="15" cy="9" r="2"/><circle cx="9" cy="9" r="2"/></svg>`;
            size = 64;
          } else if (spot.severity === 'severe' || spot.severity === 'high') {
            level = 3;
            color = '#ff0000';
            glowColor = '#cc0000';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21h16l-2-10H6L4 21z"/><path d="M7 11V8a1 1 0 0 1 1-1h1"/><path d="M11 11V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v5"/><path d="M17 11V9a1 1 0 0 0-1-1h-1"/><line x1="8" y1="16" x2="16" y2="16"/></svg>`;
            size = 56;
          } else if (spot.severity === 'moderate' || spot.severity === 'medium') {
            level = 2;
            color = '#ff7f50';
            glowColor = '#ff6347';
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`;
            size = 50;
          } else {
            iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>`;
          }

          return (
            <Marker
              key={spot.id}
              longitude={longitude}
              latitude={latitude}
              anchor="center"
              onClick={e => {
                e.originalEvent.stopPropagation();
                setSelectedSpot(spot);
                setActiveRoute(null); // Clear previous route
              }}
            >
              <div 
                className="relative flex items-center justify-center transition-transform hover:scale-110 cursor-pointer" 
                style={{ width: size, height: size, color }}
              >
                <div className="absolute inset-0 rounded-full opacity-50 animate-ping" style={{ backgroundColor: glowColor, animationDuration: '2.5s' }} />
                <div 
                  className="absolute inset-1 rounded-full border-[3px] flex items-center justify-center bg-gradient-to-b from-zinc-900 to-black shadow-lg" 
                  style={{ borderColor: glowColor, boxShadow: `0 0 15px ${glowColor}, inset 0 0 10px ${glowColor}` }}
                  dangerouslySetInnerHTML={{ __html: iconSvg }}
                />
                {spot.status !== 'CLEANED' && (
                  <div 
                    className="absolute -top-1 -right-1 w-[22px] h-[22px] rounded-full bg-black border-2 flex items-center justify-center font-black text-[11px] text-white z-10" 
                    style={{ borderColor: glowColor, boxShadow: `0 0 8px ${glowColor}` }}
                  >
                    L{level}
                  </div>
                )}
              </div>
            </Marker>
          );
        })}

        {selectedSpot && (
          <Popup
            longitude={selectedSpot.pos[1]}
            latitude={selectedSpot.pos[0]}
            anchor="bottom"
            onClose={() => setSelectedSpot(null)}
            closeOnClick={false}
            className="custom-maplibre-popup z-[1000]"
            maxWidth="280px"
          >
            <div className="text-center font-bold flex flex-col items-center bg-zinc-900 rounded-xl p-3 border border-white/10 shadow-xl w-60 relative">
              <button 
                onClick={(e) => { e.stopPropagation(); setSelectedSpot(null); setActiveRoute(null); }}
                className="absolute -top-3 -right-3 bg-zinc-800 border border-white/10 rounded-full p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-700 shadow-md transition-colors z-50"
              >
                <X className="w-4 h-4" />
              </button>
              
              {selectedSpot.status === 'CLEANED' && selectedSpot.cleanup_image_base64 ? (
                <div className="grid grid-cols-2 gap-1 w-full mb-2">
                  <div className="relative">
                    <img src={getImageUrl(selectedSpot.image_base64 || "")} alt="Before" className="w-full h-20 object-cover rounded-l-lg" crossOrigin="anonymous" />
                    <div className="absolute top-1 left-1 bg-black/60 px-1 py-0.5 rounded text-[8px] font-bold text-white tracking-widest uppercase">Before</div>
                  </div>
                  <div className="relative">
                    <img src={getImageUrl(selectedSpot.cleanup_image_base64)} alt="After" className="w-full h-20 object-cover rounded-r-lg" crossOrigin="anonymous" />
                    <div className="absolute top-1 left-1 bg-[#2E6F40]/80 px-1 py-0.5 rounded text-[8px] font-bold text-white tracking-widest uppercase">Cleaned</div>
                  </div>
                </div>
              ) : selectedSpot.image_base64 ? (
                <img src={getImageUrl(selectedSpot.image_base64)} alt="Hotspot" className="w-full h-24 object-cover rounded-lg mb-2" crossOrigin="anonymous" />
              ) : null}
              
              {selectedSpot.status === 'CLEANED' ? (
                 <>
                   <span className="text-[#10b981] text-lg mt-1 tracking-tight">Cleaned</span>
                   <span className="text-xs text-slate-500/80 uppercase tracking-widest font-black">Restored Area</span>
                 </>
              ) : (
                 <>
                   <span className="text-zinc-400 text-xl">{selectedSpot.reports}</span>
                   <span className="text-xs text-slate-500/80 uppercase tracking-widest font-black">Active Reports</span>
                   
                   <button
                     onClick={handleNavigate}
                     disabled={isRouting}
                     className="mt-3 w-full bg-[#f14f4f] text-white font-black py-2 rounded-lg flex items-center justify-center space-x-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(241,79,79,0.3)] disabled:opacity-50"
                   >
                     {isRouting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                     <span>{isRouting ? "Routing..." : "Navigate"}</span>
                   </button>
                 </>
              )}
            </div>
          </Popup>
        )}
      </Map>

      <div className="absolute bottom-4 left-3 z-[400] glass-panel p-2.5 bg-[rgba(13,27,10,0.95)] shadow-[0_0_10px_rgba(0,0,0,0.8)] border border-[#10b981]/20 rounded-xl">
        <h3 className="text-white font-bold text-sm leading-tight">South Bengaluru</h3>
        <p className="text-[#ff4d6d] font-black text-[10px] mb-1.5">{hotspots.length} reports live</p>
        
        <div className="mt-2 flex flex-col">
          <p className="text-[9px] text-[#d4af37] font-bold uppercase tracking-widest leading-none">Sector Guardian</p>
          <p className="text-white font-black text-xs leading-none mt-1">@{guardian}</p>
        </div>
      </div>

      {/* Border Overlay perfectly overlaying the map */}
      <div className="absolute inset-0 z-[999] pointer-events-none rounded-2xl border border-white/20 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />
    </div>
  );
}
