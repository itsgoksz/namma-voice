"use client";

import { useEffect, useState, useRef, useCallback, useMemo } from "react";
import * as maplibregl from "maplibre-gl";
import Map, { Marker, Popup, MapRef, Source, Layer } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl("https://unpkg.com/maplibre-gl@6.0.0/dist/maplibre-gl-worker.mjs");
}

import useSupercluster from "use-supercluster";
import { getImageUrl } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { Navigation, X, Loader2, LocateFixed, Trophy, Shield, AlertTriangle, Footprints, Car } from "lucide-react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import * as turf from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import { calculateTerritoryLeaderboard, AreaStats } from '@/lib/territories';
import GarbageCard from '@/components/GarbageCard';
import { usePostActions } from '@/hooks/usePostActions';
import territoriesData from '@/data/territories.json';
import DynamicIsland from '@/components/DynamicIsland';
import { cn } from '@/lib/utils';

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
  reported_by?: string;
}

let cachedHotspots: Hotspot[] | null = null;

function getDistanceInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getClosestSegmentInfo(point: [number, number], route: [number, number][]) {
  if (!route || route.length < 2) return { index: 0, proj: point };
  let minDist = Infinity;
  let minIndex = 0;
  let bestProj = point;
  
  for (let i = 0; i < route.length - 1; i++) {
    const v = route[i]; // [lng, lat]
    const w = route[i+1];
    
    // planar distance approximation for small segment distances
    const l2 = (v[0] - w[0]) ** 2 + (v[1] - w[1]) ** 2;
    let t = 0;
    if (l2 !== 0) {
      t = ((point[0] - v[0]) * (w[0] - v[0]) + (point[1] - v[1]) * (w[1] - v[1])) / l2;
      t = Math.max(0, Math.min(1, t));
    }
    const proj: [number, number] = [v[0] + t * (w[0] - v[0]), v[1] + t * (w[1] - v[1])];
    const dist = (point[0] - proj[0]) ** 2 + (point[1] - proj[1]) ** 2;
    
    if (dist < minDist) {
      minDist = dist;
      minIndex = i;
      bestProj = proj;
    }
  }
  return { index: minIndex, proj: bestProj };
}

function AnimatedMarker({ targetLng, targetLat, isLiveNavigation, pitchAlignment, rotationAlignment, children }: { targetLng: number, targetLat: number, isLiveNavigation: boolean, pitchAlignment?: 'map' | 'viewport' | 'auto', rotationAlignment?: 'map' | 'viewport' | 'auto', children: React.ReactNode }) {
  const [lng, setLng] = useState(targetLng);
  const [lat, setLat] = useState(targetLat);
  const animationRef = useRef<number | null>(null);
  
  useEffect(() => {
    if (!isLiveNavigation) {
      setLng(targetLng);
      setLat(targetLat);
      return;
    }
    
    let start = performance.now();
    const startLng = lng;
    const startLat = lat;
    const duration = 1000;
    
    const animate = (time: number) => {
      const elapsed = time - start;
      const progress = Math.min(elapsed / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // ease-out
      
      setLng(startLng + (targetLng - startLng) * ease);
      setLat(startLat + (targetLat - startLat) * ease);
      
      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      }
    };
    
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
    animationRef.current = requestAnimationFrame(animate);
    
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [targetLng, targetLat, isLiveNavigation]);

  return (
    <Marker longitude={lng} latitude={lat} anchor="top" pitchAlignment={pitchAlignment} rotationAlignment={rotationAlignment}>
      {children}
    </Marker>
  );
}

interface GarbageMapProps {
  userLoc?: { lat: number; lng: number; heading?: number | null } | null;
  externalRouteDest?: { lat: number; lng: number } | null;
  onActiveRouteChange?: (isActive: boolean) => void;
  xpEvent?: { amount: number; id: string } | null;
  onNavInstructionChange?: (instruction: string | undefined) => void;
  onNavDistanceChange?: (distance: number | undefined) => void;
}

export default function GarbageMap({ userLoc, externalRouteDest, onActiveRouteChange, xpEvent, onNavInstructionChange, onNavDistanceChange }: GarbageMapProps) {
  const mapRef = useRef<MapRef>(null);
  
  const [zoom, setZoom] = useState(13.5);
  const [bounds, setBounds] = useState<[number, number, number, number] | null>(null);

  const [hotspots, setHotspots] = useState<Hotspot[]>(cachedHotspots || []);
  const [guardian, setGuardian] = useState<string>("Loading...");
  const [selectedSpot, setSelectedSpot] = useState<Hotspot | null>(null);
  const [activePost, setActivePost] = useState<Hotspot | null>(null);
  const [errorPopup, setErrorPopup] = useState<{title: string, message: string} | null>(null);
  const [hasCentered, setHasCentered] = useState(false);
  const [activeRoute, setActiveRoute] = useState<[number, number][] | null>(null);
  const [fullRoute, setFullRoute] = useState<[number, number][] | null>(null);
  
  const buzzedSpots = useRef<Set<string>>(new Set());

  const { supportedPosts, handleSupport, handleFlag, handleOrganise, handleUserClick, PostActionModals } = usePostActions({
    onUpdatePost: (id, updater) => {
      setHotspots(prev => prev.map(h => h.id === id ? updater(h as any) as any : h));
      if (activePost && activePost.id === id) setActivePost(updater(activePost as any) as any);
      if (selectedSpot && selectedSpot.id === id) setSelectedSpot(updater(selectedSpot as any) as any);
    },
    onError: (title, message) => setErrorPopup({ title, message }),
    onSuccess: (title, message) => alert(`${title}\n${message}`),
  });
  const [currentDestination, setCurrentDestination] = useState<{lat: number, lng: number} | null>(null);
  const [routingProfile, setRoutingProfile] = useState<'foot' | 'driving'>('foot');
  const [isRouting, setIsRouting] = useState(false);
  const [isLiveNavigation, setIsLiveNavigation] = useState(false);
  const [isCameraLocked, setIsCameraLocked] = useState(true);
  const [navInstruction, setNavInstruction] = useState<string | undefined>(undefined);
  const [navDistance, setNavDistance] = useState<number | undefined>(undefined);
  const [showUserPopup, setShowUserPopup] = useState(false);
  const [routeSteps, setRouteSteps] = useState<any[] | null>(null);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const offRouteCounter = useRef(0);

  const [territories, setTerritories] = useState<any>(territoriesData);
  const hoveredTerritoryId = useRef<number | string | null>(null);
  const [hoveredTerritoryData, setHoveredTerritoryData] = useState<AreaStats | null>(null);
  const [selectedTerritory, setSelectedTerritory] = useState<(AreaStats & { id: number }) | null>(null);
  const [reportSupports, setReportSupports] = useState<any[]>([]);
  const isMarkerClicked = useRef(false);

  const handleMapMove = useCallback(() => {
    if (!mapRef.current || isLiveNavigation) return;
    const center = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();
    if (currentZoom < 14) return;
    
    const centerPx = mapRef.current.project(center);
    
    hotspots.forEach(spot => {
      const spotPx = mapRef.current?.project([spot.pos[1], spot.pos[0]]);
      if (spotPx) {
        const distPx = Math.hypot(centerPx.x - spotPx.x, centerPx.y - spotPx.y);
        if (distPx < 30) {
          if (!buzzedSpots.current.has(String(spot.id))) {
            Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
            buzzedSpots.current.add(String(spot.id));
          }
        } else {
          buzzedSpots.current.delete(String(spot.id));
        }
      }
    });
  }, [hotspots, isLiveNavigation]);

  useEffect(() => {
    if (currentStepIndex !== null && routeSteps && routeSteps[currentStepIndex]) {
      const currentStep = routeSteps[currentStepIndex];
      const isArrive = currentStep.maneuver.type === 'arrive';
      // getDistanceInMeters must be available here. It is defined later in the file.
      // Wait, is getDistanceInMeters in scope here?
      const getDistanceInMetersLocal = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI / 180;
        const φ2 = lat2 * Math.PI / 180;
        const Δφ = (lat2 - lat1) * Math.PI / 180;
        const Δλ = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const distToManeuver = userLoc ? Math.round(getDistanceInMetersLocal(userLoc.lat, userLoc.lng, currentStep.maneuver.location[1], currentStep.maneuver.location[0])) : Math.round(currentStep.distance);
      const hasArrived = isArrive && distToManeuver <= 25;
      
      let inst = "";
      if (hasArrived) inst = "Arrived at location";
      else if (currentStep.maneuver.modifier) inst = `Turn ${currentStep.maneuver.modifier.replace(/-/g, ' ')}`;
      else if (isArrive) inst = "Arrive at destination";
      else inst = "Continue straight";

      if (!hasArrived && !isArrive && currentStep.name) {
        inst += ` on ${currentStep.name}`;
      }

      setNavInstruction(inst);
      setNavDistance(distToManeuver);
      onNavInstructionChange?.(inst);
      onNavDistanceChange?.(distToManeuver);
    }
  }, [currentStepIndex, routeSteps, userLoc, onNavInstructionChange, onNavDistanceChange]);

  // Sync externalRouteDest to currentDestination
  useEffect(() => {
    setCurrentDestination(externalRouteDest || null);
    if (!externalRouteDest) {
      setFullRoute(null);
      setActiveRoute(null);
    }
  }, [externalRouteDest]);

  const handleNavigate = (lat: number, lng: number) => {
    setCurrentDestination({ lat, lng });
    setSelectedSpot(null);
  };

  // Fetch route when currentDestination changes, or if fullRoute is cleared (off-route)
  useEffect(() => {
    if (currentDestination && userLoc && !fullRoute) {
      const fetchRoute = async () => {
        setIsRouting(true);
        try {
          const start = { lng: userLoc.lng, lat: userLoc.lat };
          const end = { lng: currentDestination.lng, lat: currentDestination.lat };
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/${routingProfile}/${start.lng},${start.lat};${end.lng},${end.lat}?overview=full&geometries=geojson&steps=true`
          );
          const data = await response.json();
          if (data.routes?.length > 0) {
            const coords = data.routes[0].geometry.coordinates;
            const steps = data.routes[0].legs[0]?.steps || [];
            
            setFullRoute(coords);
            setActiveRoute(coords);
            setRouteSteps(steps);
            setCurrentStepIndex(0);
            offRouteCounter.current = 0;
            
            const routeBounds = coords.reduce((acc: [[number, number], [number, number]], coord: [number, number]) => {
              return [
                [Math.min(acc[0][0], coord[0]), Math.min(acc[0][1], coord[1])],
                [Math.max(acc[1][0], coord[0]), Math.max(acc[1][1], coord[1])]
              ] as [[number, number], [number, number]];
            }, [[Infinity, Infinity], [-Infinity, -Infinity]]);
            
            if (mapRef.current) {
              mapRef.current.fitBounds(routeBounds, { padding: 60, duration: 1500 });
            }
          } else {
            setCurrentDestination(null);
            alert("No route found to this location.");
          }
        } catch (error) {
          console.error("Failed to fetch route:", error);
          alert("Failed to fetch routing data. Please try again.");
          setCurrentDestination(null);
        } finally {
          setIsRouting(false);
        }
      };
      fetchRoute();
    }
  }, [currentDestination, userLoc, fullRoute, routingProfile]);

  // Dynamic route progression
  useEffect(() => {
    if (!fullRoute || !userLoc) return;
    
    const userPoint: [number, number] = [userLoc.lng, userLoc.lat];
    const { index: closestIdx, proj: snappedPoint } = getClosestSegmentInfo(userPoint, fullRoute);
    
    const offRouteDist = getDistanceInMeters(userPoint[1], userPoint[0], snappedPoint[1], snappedPoint[0]);

    if (offRouteDist > 50 && closestIdx > 2 && closestIdx < fullRoute.length - 2) {
       offRouteCounter.current += 1;
       if (offRouteCounter.current >= 3) {
         setFullRoute(null);
         offRouteCounter.current = 0;
       }
    } else {
       offRouteCounter.current = 0;
       // Snap user to route and prune history
       let prunedRoute = [snappedPoint, ...fullRoute.slice(closestIdx + 1)];
       if (prunedRoute.length < 2) {
         prunedRoute = [snappedPoint, fullRoute[fullRoute.length - 1]];
       }
       setActiveRoute(prunedRoute);
       
       // Step progression
       setRouteSteps(steps => {
         if (steps && steps.length > 0) {
           setCurrentStepIndex(idx => {
             if (idx < steps.length) {
               const currentStep = steps[idx];
               const maneuverLoc = currentStep.maneuver.location; // [lng, lat]
               const distToManeuver = getDistanceInMeters(userPoint[1], userPoint[0], maneuverLoc[1], maneuverLoc[0]);
                if (distToManeuver < 25) {
                  return Math.min(idx + 1, steps.length - 1); // Advance step but don't go out of bounds
                }
             }
             return idx;
           });
         }
         return steps;
       });
    }
  }, [userLoc, fullRoute]);

  useEffect(() => {
    const fetchReports = async () => {
      try {
        let data, error;
        if (typeof window !== 'undefined' && (window as any).__nammaHotspotsPromise) {
          const res = await (window as any).__nammaHotspotsPromise;
          data = res.data;
          error = res.error;
          (window as any).__nammaHotspotsPromise = null;
        } else {
          const res = await supabase.from('reports').select('*');
          data = res.data;
          error = res.error;
        }
        
        const { data: supportsData } = await supabase.from('report_supports').select('report_id, username');
        if (error || !data) return;
        
        if (supportsData) setReportSupports(supportsData);

        const formattedData = data.map((r: any) => ({ 
          ...r, 
          pos: [r.lat, r.lng] 
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
      .channel(`public:reports-${Date.now()}`)
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
    if (userLoc && !hasCentered && mapRef.current && !isLiveNavigation) {
      mapRef.current.flyTo({
        center: [userLoc.lng, userLoc.lat],
        duration: 1500,
        zoom: 13.5
      });
      setHasCentered(true);
    }
  }, [userLoc, hasCentered, isLiveNavigation]);

  // Live Navigation tracking with Low-Pass filter for bearing
  useEffect(() => {
    if (isLiveNavigation && isCameraLocked && userLoc && mapRef.current) {
      const currentBearing = mapRef.current.getBearing();
      let targetBearing = userLoc.heading ?? currentBearing;
      
      let diff = targetBearing - currentBearing;
      while (diff <= -180) diff += 360;
      while (diff > 180) diff -= 360;
      
      const smoothedBearing = currentBearing + diff * 0.15; // LPF: 15% new, 85% old
      
      mapRef.current.easeTo({
        center: [userLoc.lng, userLoc.lat],
        bearing: smoothedBearing,
        pitch: 60,
        zoom: 18,
        duration: 1000,
        easing: (t) => t
      });
    }
  }, [userLoc, isLiveNavigation, isCameraLocked]);

  // Clear territory highlights if a hotspot is selected, as requested
  useEffect(() => {
    if (selectedSpot && mapRef.current) {
      if (selectedTerritory) {
        mapRef.current.setFeatureState(
          { source: 'territories', id: selectedTerritory.id },
          { active: false }
        );
        setSelectedTerritory(null);
      }
      if (hoveredTerritoryId.current !== null) {
        mapRef.current.setFeatureState(
          { source: 'territories', id: hoveredTerritoryId.current },
          { hover: false }
        );
        hoveredTerritoryId.current = null;
        setHoveredTerritoryData(null);
      }
    }
  }, [selectedSpot, selectedTerritory]);

  useEffect(() => {
    if (onActiveRouteChange) {
      onActiveRouteChange(!!activeRoute);
    }
  }, [activeRoute, onActiveRouteChange]);

  // Clustering logic
  const points = useMemo(() => {
    const locationCounts: Record<string, number> = {};
    
    return hotspots.map(spot => {
      const locKey = `${spot.pos[0].toFixed(6)},${spot.pos[1].toFixed(6)}`;
      const order = locationCounts[locKey] || 0;
      locationCounts[locKey] = order + 1;
      
      let renderLat = spot.pos[0];
      let renderLng = spot.pos[1];
      
      if (order > 0) {
        const radius = 0.00015 * Math.ceil(order / 6); // ~15 meters
        const angle = (order * Math.PI * 2) / 6;
        renderLat += Math.cos(angle) * radius;
        renderLng += Math.sin(angle) * radius;
      }

      return {
        type: "Feature" as const,
        properties: { cluster: false, hotspot: spot, point_count: 1, category: spot.severity },
        geometry: {
          type: "Point" as const,
          coordinates: [renderLng, renderLat] // GeoJSON expects [lng, lat]
        }
      };
    });
  }, [hotspots]);

  const { clusters, supercluster } = useSupercluster({
    points,
    bounds: bounds || undefined,
    zoom: zoom,
    options: { radius: 40, maxZoom: 17 }
  });

  return (
    <div className="w-full h-full relative z-0 bg-black">
      <Map
        initialViewState={{
          latitude: userLoc?.lat || center[0],
          longitude: userLoc?.lng || center[1],
          zoom: 13.5
        }}
        padding={{ top: 90, bottom: 90 }}
        onMove={handleMapMove}
        onMoveEnd={evt => {
          setZoom(evt.viewState.zoom);
          setBounds(evt.target.getBounds().toArray().flat() as [number, number, number, number]);
        }}
        onLoad={evt => {
          setZoom(evt.target.getZoom());
          setBounds(evt.target.getBounds().toArray().flat() as [number, number, number, number]);
        }}
        ref={mapRef}
        mapStyle={rasterMapStyle as any}
        maxBounds={allowedBounds}
        maxZoom={22}
        minZoom={13}
        attributionControl={false}
        interactiveLayerIds={['territory-fill']}
        dragPan={!selectedSpot}
        scrollZoom={!selectedSpot}
        doubleClickZoom={!selectedSpot}
        dragRotate={!selectedSpot}
        touchZoomRotate={!selectedSpot}
        onDragStart={() => {
          if (isLiveNavigation) setIsCameraLocked(false);
        }}
        onMouseMove={e => {
          if (activeRoute || currentDestination || isLiveNavigation || selectedTerritory || selectedSpot) {
            if (hoveredTerritoryId.current !== null) {
              mapRef.current?.setFeatureState(
                { source: 'territories', id: hoveredTerritoryId.current },
                { hover: false }
              );
              hoveredTerritoryId.current = null;
              setHoveredTerritoryData(null);
            }
            return;
          }

          if (e.features && e.features.length > 0) {
            const feature = e.features.find((f: any) => f.layer.id === 'territory-fill');
            if (feature && feature.id !== undefined) {
              if (hoveredTerritoryId.current !== feature.id) {
                if (hoveredTerritoryId.current !== null) {
                  mapRef.current?.setFeatureState(
                    { source: 'territories', id: hoveredTerritoryId.current },
                    { hover: false }
                  );
                }
                hoveredTerritoryId.current = feature.id as any;
                mapRef.current?.setFeatureState(
                  { source: 'territories', id: feature.id },
                  { hover: true }
                );
                
                const stats = calculateTerritoryLeaderboard(feature, hotspots, reportSupports);
                setHoveredTerritoryData(stats);
              }
              return;
            }
          }
          if (hoveredTerritoryId.current !== null) {
            mapRef.current?.setFeatureState(
              { source: 'territories', id: hoveredTerritoryId.current },
              { hover: false }
            );
            hoveredTerritoryId.current = null;
            setHoveredTerritoryData(null);
          }
        }}
        onMouseLeave={() => {
          if (hoveredTerritoryId.current !== null) {
            mapRef.current?.setFeatureState(
              { source: 'territories', id: hoveredTerritoryId.current },
              { hover: false }
            );
            hoveredTerritoryId.current = null;
            setHoveredTerritoryData(null);
          }
        }}
        onMouseOut={() => {
          if (hoveredTerritoryId.current !== null) {
            mapRef.current?.setFeatureState(
              { source: 'territories', id: hoveredTerritoryId.current },
              { hover: false }
            );
            hoveredTerritoryId.current = null;
            setHoveredTerritoryData(null);
          }
        }}
        onClick={e => {
          if (activeRoute || isLiveNavigation || selectedSpot) return;
          
          let clientX, clientY;
          if (e.originalEvent) {
            if ('clientX' in e.originalEvent) {
              clientX = (e.originalEvent as any).clientX;
              clientY = (e.originalEvent as any).clientY;
            } else if ((e.originalEvent as any).changedTouches && (e.originalEvent as any).changedTouches.length > 0) {
              clientX = (e.originalEvent as any).changedTouches[0].clientX;
              clientY = (e.originalEvent as any).changedTouches[0].clientY;
            }
          }
          
          if (clientX !== undefined && clientY !== undefined) {
            const element = document.elementFromPoint(clientX, clientY);
            if (element && element.tagName !== 'CANVAS') {
              return;
            }
          }
          
          // Geometric hit-testing as an absolute fallback for iOS Mapbox touch swallowing
          if (mapRef.current && clusters) {
            let hitMarker = false;
            for (const cluster of clusters) {
              const [lng, lat] = cluster.geometry.coordinates;
              const px = mapRef.current.project([lng, lat]);
              const dist = Math.hypot(e.point.x - px.x, e.point.y - px.y);
              if (dist < 38) { // 38px radius covers our largest markers
                hitMarker = true;
                break;
              }
            }
            if (hitMarker) return;
          }
          
          if (e.originalEvent && (e.originalEvent.target as HTMLElement).tagName !== 'CANVAS') return;
          if (isMarkerClicked.current) return;
          
          if (hoveredTerritoryId.current !== null) {
            mapRef.current?.setFeatureState(
              { source: 'territories', id: hoveredTerritoryId.current },
              { hover: false }
            );
            hoveredTerritoryId.current = null;
            setHoveredTerritoryData(null);
          }
          if (e.features && e.features.length > 0) {
            const feature = e.features.find((f: any) => f.layer.id === 'territory-fill');
            if (feature) {
              if (selectedTerritory && selectedTerritory.id === feature.id) {
                mapRef.current?.setFeatureState(
                  { source: 'territories', id: selectedTerritory.id },
                  { active: false }
                );
                setSelectedTerritory(null);
                Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                return;
              }

              Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
              
              const geom = feature.geometry as any;
              
              let poly;
              if (geom.type === 'Polygon' || geom.type === 'MultiPolygon') {
                poly = turf.feature(geom);
              }
              if (poly) {
                const stats = calculateTerritoryLeaderboard(feature, hotspots, reportSupports);
                setSelectedTerritory({ ...stats, id: feature.id as number });
              }
              if (selectedTerritory?.id !== undefined) {
                mapRef.current?.setFeatureState(
                  { source: 'territories', id: selectedTerritory.id },
                  { active: false }
                );
              }
              if (feature.id !== undefined) {
                mapRef.current?.setFeatureState(
                  { source: 'territories', id: feature.id },
                  { active: true }
                );
              }

              return;
            }
          }
          if (selectedTerritory) {
            if (selectedTerritory.id !== undefined) {
              mapRef.current?.setFeatureState(
                { source: 'territories', id: selectedTerritory.id },
                { active: false }
              );
            }
            setSelectedTerritory(null);
          }
        }}
      >
        {activeRoute && activeRoute.length > 0 && (
          <Source 
            id="route" 
            type="geojson" 
            data={{
              type: "FeatureCollection",
              features: [{
                type: "Feature",
                properties: {},
                geometry: {
                  type: "LineString",
                  coordinates: activeRoute
                }
              }]
            }}
          >
            <Layer
              id="route-layer"
              type="line"
              source="route"
              layout={{
                "line-join": "round",
                "line-cap": "round"
              }}
              paint={{
                "line-color": (!fullRoute && isRouting) ? "#888888" : "#f14f4f",
                "line-width": 6,
                "line-dasharray": (!fullRoute && isRouting) ? [2, 2] : [1],
                "line-opacity": (!fullRoute && isRouting) ? 0.6 : 1
              }}
            />
          </Source>
        )}

        {territories && (
          <Source id="territories" type="geojson" data={territories}>
            <Layer
              id="territory-fill"
              type="fill"
              paint={{
                'fill-color': '#10b981',
                'fill-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  0.1,
                  ['boolean', ['feature-state', 'active'], false],
                  0.1,
                  0.0
                ]
              }}
            />
            <Layer
              id="territory-line"
              type="line"
              paint={{
                'line-color': '#10b981',
                'line-width': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  2,
                  ['boolean', ['feature-state', 'active'], false],
                  2,
                  1
                ],
                'line-dasharray': [3, 4],
                'line-opacity': [
                  'case',
                  ['boolean', ['feature-state', 'hover'], false],
                  1.0,
                  ['boolean', ['feature-state', 'active'], false],
                  1.0,
                  0.3
                ]
              }}
            />
          </Source>
        )}


        
        {userLoc && (
          <AnimatedMarker
            targetLng={isLiveNavigation && activeRoute ? activeRoute[0][0] : userLoc.lng}
            targetLat={isLiveNavigation && activeRoute ? activeRoute[0][1] : userLoc.lat}
            isLiveNavigation={isLiveNavigation}
            pitchAlignment={isLiveNavigation ? "map" : "viewport"}
            rotationAlignment="viewport"
          >
            <div className={`relative flex flex-col items-center justify-center ${isLiveNavigation ? 'w-20 h-20' : 'w-12 h-12'}`}>
              <div 
                className={`relative flex items-center justify-center cursor-pointer transition-transform hover:scale-110 active:scale-95 ${isLiveNavigation ? 'w-20 h-20' : 'w-12 h-12'}`}
                onClick={(e) => {
                  if (!!activeRoute) return;
                  e.stopPropagation();
                  setShowUserPopup(true);
                  setSelectedSpot(null);
                }}
              >
                {isLiveNavigation ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-20 h-20 filter drop-shadow-[0_10px_20px_rgba(173,195,75,0.7)]">
                    <path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="#adc34b"/>
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-12 h-12 filter drop-shadow-[0_0_12px_rgba(173,195,75,0.9)]">
                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2c-4.42 0-8 3.58-8 8 0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="#adc34b" />
                  </svg>
                )}
              </div>
            </div>
          </AnimatedMarker>
        )}

        {clusters.map((cluster) => {
          const [longitude, latitude] = cluster.geometry.coordinates;
          const { cluster: isCluster, point_count: pointCount } = cluster.properties;

          if (isCluster) {
            const size = Math.max(50, Math.min(70, pointCount * 3 + 40));
            
            const isNavigating = !!activeRoute;
            let clusterContainsDestination = false;
            if (isNavigating && currentDestination) {
              const leaves = supercluster.getLeaves(cluster.id as number, Infinity);
              clusterContainsDestination = leaves.some((l: any) => l.properties?.hotspot?.pos[0] === currentDestination.lat && l.properties?.hotspot?.pos[1] === currentDestination.lng);
            }
            const isDimmed = isNavigating && !clusterContainsDestination;

            return (
              <Marker
                key={`cluster-${cluster.id}`}
                longitude={longitude}
                latitude={latitude}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  isMarkerClicked.current = true;
                  setTimeout(() => { isMarkerClicked.current = false; }, 1000);
                  if (isLiveNavigation) return;
                  Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                  const expansionZoom = Math.min(
                    supercluster.getClusterExpansionZoom(cluster.id as number),
                    22
                  );
                  mapRef.current?.easeTo({
                    center: [longitude, latitude],
                    zoom: expansionZoom,
                    duration: 800,
                    easing: (t) => t * (2 - t)
                  });
                }}
              >
                <div 
                  style={{ width: size, height: size }} 
                  className={`relative flex items-center justify-center cursor-pointer transition-all duration-500 ${isDimmed ? 'opacity-30 pointer-events-none grayscale' : ''}`}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    isMarkerClicked.current = true;
                    setTimeout(() => { isMarkerClicked.current = false; }, 1000);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                  }}
                >
                  {!isDimmed && (
                    <svg className="absolute inset-0 w-full h-full text-[#990000] opacity-40 animate-pulse" viewBox="0 0 100 100" fill="currentColor">
                      <polygon points="50 1 95 25 95 75 50 99 5 75 5 25" />
                    </svg>
                  )}
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

          const isNavigating = !!activeRoute;
          const isDestination = isNavigating && currentDestination?.lat === spot.pos[0] && currentDestination?.lng === spot.pos[1];
          const isDimmed = isNavigating && !isDestination;

          return (
            <Marker
              key={spot.id}
              longitude={longitude}
              latitude={latitude}
              anchor="center"
              onClick={e => {
                if (isNavigating) return;
                e.originalEvent.stopPropagation();
                isMarkerClicked.current = true;
                setTimeout(() => { isMarkerClicked.current = false; }, 1000);
                Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
                setSelectedSpot(spot);
                setActiveRoute(null); // Clear previous route
                const currentZoom = mapRef.current?.getZoom() || 13.5;
                const targetZoom = Math.max(currentZoom, 15.5);
                const yOffset = typeof window !== 'undefined' && window.innerWidth < 768 ? 150 : 50;
                mapRef.current?.easeTo({
                  center: [longitude, latitude],
                  zoom: targetZoom,
                  offset: [0, yOffset],
                  duration: 800,
                  easing: (t) => t * (2 - t)
                });
              }}
            >
              <div 
                className={`relative flex items-center justify-center transition-all duration-500 hover:scale-110 cursor-pointer ${isDimmed ? 'opacity-30 pointer-events-none grayscale' : ''}`} 
                style={{ width: size, height: size, color }}
                onTouchStart={(e) => {
                  e.stopPropagation();
                  isMarkerClicked.current = true;
                  setTimeout(() => { isMarkerClicked.current = false; }, 1000);
                }}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                }}
              >
                {!isDimmed && <div className="absolute inset-0 rounded-full opacity-50 animate-ping" style={{ backgroundColor: glowColor, animationDuration: '2.5s' }} />}
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

        {selectedSpot && !currentDestination && (
          <Popup
            longitude={selectedSpot.pos[1]}
            latitude={selectedSpot.pos[0]}
            onClose={() => setSelectedSpot(null)}
            closeOnClick={false}
            className="custom-maplibre-popup z-[1000]"
            maxWidth="280px"
            anchor="bottom"
          >
            <motion.div 
              initial={{ opacity: 0, scale: 0.8, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="relative"
            >
              <button 
                onClick={(e) => { 
                  e.stopPropagation(); 
                  isMarkerClicked.current = true;
                  setTimeout(() => { isMarkerClicked.current = false; }, 1000);
                  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                  setSelectedSpot(null); 
                  setActiveRoute(null); 
                }}
                className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm border border-white/10 rounded-full p-2 text-zinc-400 hover:text-white shadow-xl transition-colors z-[60]"
              >
                <X className="w-4 h-4" />
              </button>
              
              <GarbageCard
                layoutId={`post-${selectedSpot.id}`}
                post={selectedSpot as any}
                variant="map"
                onNavigate={handleNavigate}
                onImageClick={() => {
                  Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                  setActivePost(selectedSpot);
                }}
                setErrorPopup={setErrorPopup}
                onSupport={handleSupport}
                onFlag={handleFlag}
                onOrganise={handleOrganise}
                onUserClick={handleUserClick}
                supportedPosts={supportedPosts}
                onCleanupSuccess={(id, severity, imageUrl) => {
                  setSelectedSpot(null);
                  // Refresh hotspots
                  supabase.from('reports').select('*').then(({ data }) => {
                    if (data) {
                      const formattedData = data.map((r: any) => ({ ...r, pos: [r.lat, r.lng] }));
                      setHotspots(formattedData);
                    }
                  });
                }}
              />
            </motion.div>
          </Popup>
        )}

        {showUserPopup && userLoc && (
          <Popup
            longitude={userLoc.lng}
            latitude={userLoc.lat}
            anchor="bottom"
            onClose={() => setShowUserPopup(false)}
            closeOnClick={false}
            className="custom-maplibre-popup z-[1000]"
            maxWidth="200px"
            offset={[0, -48]}
          >
            <div className="bg-black/90 backdrop-blur-xl border border-[#adc34b]/30 p-3 rounded-2xl shadow-xl flex items-center space-x-3 relative pr-8">
              <button 
                onClick={(e) => { e.stopPropagation(); setShowUserPopup(false); }}
                className="absolute top-1.5 right-1.5 p-1 text-zinc-400 hover:text-white rounded-full bg-white/5 active:scale-95 transition-transform"
              >
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="w-8 h-8 rounded-full bg-[#adc34b]/20 flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-5 h-5 text-[#adc34b]">
                  <path fillRule="evenodd" clipRule="evenodd" d="M12 2c-4.42 0-8 3.58-8 8 0 5.25 8 13 8 13s8-7.75 8-13c0-4.42-3.58-8-8-8zm0 11.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z" fill="currentColor" />
                </svg>
              </div>
              <h3 className="text-[#adc34b] font-black text-xs tracking-wide uppercase leading-tight">You<br/>(Eco-Guardian)</h3>
            </div>
          </Popup>
        )}
      </Map>

      {/* Dynamic Island Component */}
      <DynamicIsland
        userLoc={userLoc || null}
        hotspots={hotspots}
        isLiveNavigation={isLiveNavigation}
        navDistance={navDistance}
        navInstruction={navInstruction}
        xpEvent={xpEvent || null}
      />

      {/* Overlays */}
      <AnimatePresence>
        {(guardian || selectedTerritory || hoveredTerritoryData) && !activeRoute && !selectedSpot && (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="absolute top-4 left-4 z-[999] pointer-events-none"
          >
            <div className="glass-panel p-3 rounded-2xl border border-white/10 shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex flex-col items-start bg-black/60 backdrop-blur-md pointer-events-auto min-w-[130px] max-w-[160px]">
              <span className="text-white font-black text-[13px] tracking-wide mb-2 leading-tight">
                {(selectedTerritory || hoveredTerritoryData)?.area ?? "South Bengaluru"}
              </span>
              <div className="flex flex-col space-y-1.5 w-full">
                <span className="text-[#ff4d6d] text-[10px] font-bold uppercase tracking-wider flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#ff4d6d] animate-pulse mr-1.5 shadow-[0_0_5px_#ff4d6d]"></span>
                  {(selectedTerritory || hoveredTerritoryData)?.reports ?? hotspots.length} Live Reports
                </span>
                <span className="text-[#d4af37] text-[10px] font-bold uppercase tracking-wider flex items-center">
                  <Shield className="w-3 h-3 mr-1.5 shrink-0" />
                  <span className="truncate">
                    {(() => {
                      const localGuardian = (selectedTerritory || hoveredTerritoryData)?.guardian;
                      const isHoveringTerritory = !!(selectedTerritory || hoveredTerritoryData);
                      
                      if (isHoveringTerritory && !localGuardian) {
                        return <span className="text-zinc-400">Unclaimed Area</span>;
                      }
                      
                      if (localGuardian) {
                        return `Guardian: @${localGuardian}`;
                      }
                      
                      return `Sector Guardian: @${guardian}`;
                    })()}
                  </span>
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Turn-by-Turn Instruction Overlay */}
      <AnimatePresence>
        {isLiveNavigation && routeSteps && currentStepIndex !== null && currentStepIndex < routeSteps.length && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[999] pointer-events-auto w-[90%] max-w-sm"
          >
            <div className="glass-panel p-4 rounded-3xl border border-[#10b981]/20 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex items-center space-x-4 bg-black/80 backdrop-blur-md">
              <div className="w-12 h-12 rounded-full bg-[#10b981]/20 flex items-center justify-center border border-[#10b981]/30 text-[#10b981]">
                <Navigation className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <p className="text-white font-black text-lg leading-tight drop-shadow-md">
                  {navInstruction?.split(' on ')[0] || "Proceed to route"}
                </p>
                <p className="text-[#10b981] font-bold text-sm">
                  {navInstruction?.includes(' on ') ? `${navInstruction.split(' on ')[1]} • ${navDistance}m` : `${navDistance}m`}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Rerouting Overlay */}
      <AnimatePresence>
        {activeRoute && !fullRoute && isRouting && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="absolute top-6 left-1/2 -translate-x-1/2 z-[999] pointer-events-auto"
          >
            <div className="glass-panel px-6 py-3 rounded-full border border-[#f14f4f]/30 shadow-[0_15px_40px_rgba(0,0,0,0.6)] flex items-center space-x-3 bg-black/90 backdrop-blur-xl">
              <Loader2 className="w-5 h-5 text-[#f14f4f] animate-spin" />
              <p className="text-white font-black text-sm tracking-widest uppercase">Rerouting...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Navigation Overlays */}
      {activeRoute && (
        <>
          <AnimatePresence>
            {!isLiveNavigation && (
              <motion.div
                key="routing-profile-selector"
                initial={{ opacity: 0, scale: 0.9, y: -20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: -20 }}
                className="absolute left-1/2 -translate-x-1/2 top-6 z-[999] pointer-events-auto transition-all duration-500"
              >
              <div className="glass-panel p-1.5 rounded-full border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center space-x-1 bg-black/70 backdrop-blur-xl">
                <button
                  onClick={() => {
                    if (routingProfile !== 'foot') {
                      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                      setRoutingProfile('foot');
                      setFullRoute(null);
                    }
                  }}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-xs font-black tracking-wide uppercase transition-all duration-300 flex items-center space-x-2",
                    routingProfile === 'foot' ? "bg-[#10b981] text-white shadow-[0_0_15px_rgba(16,185,129,0.5)]" : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Footprints className="w-4 h-4" />
                  <span>Walk</span>
                </button>
                <button
                  onClick={() => {
                    if (routingProfile !== 'driving') {
                      Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
                      setRoutingProfile('driving');
                      setFullRoute(null);
                    }
                  }}
                  className={cn(
                    "px-5 py-2.5 rounded-full text-xs font-black tracking-wide uppercase transition-all duration-300 flex items-center space-x-2",
                    routingProfile === 'driving' ? "bg-[#3b82f6] text-white shadow-[0_0_15px_rgba(59,130,246,0.5)]" : "text-zinc-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  <Car className="w-4 h-4" />
                  <span>Drive</span>
                </button>
              </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {(isLiveNavigation && !isCameraLocked) && (
              <motion.button
                key="recenter-button"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              onClick={() => {
                setIsCameraLocked(true);
                if (mapRef.current && userLoc) {
                  let currentBearing = mapRef.current.getBearing();
                  let targetBearing = userLoc.heading ?? currentBearing;
                  mapRef.current.easeTo({ center: [userLoc.lng, userLoc.lat], bearing: targetBearing, pitch: isLiveNavigation ? 60 : 0, zoom: 18, duration: 1000 });
                }
              }}
              className="absolute bottom-4 left-4 z-[999] pointer-events-auto bg-[#1a1a2e] text-white font-black w-12 h-12 p-0 rounded-full shadow-[0_0_20px_rgba(26,26,46,0.5)] active:scale-90 transition-colors flex items-center justify-center border border-white/20 shrink-0"
            >
              <svg className="w-8 h-8 text-white/50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 1v4 M9 3l3 2 3-2" />
                <path d="M12 23v-4 M9 21l3-2 3 2" />
                <path d="M1 12h4 M3 9l2 3-2 3" />
                <path d="M23 12h-4 M21 9l-2 3 2 3" />
                <path className="text-[#adc34b]" d="M12 16.5c-2-2.5-3-4-3-5.5a3 3 0 1 1 6 0c0 1.5-1 3-3 5.5z" fill="currentColor" stroke="none" />
                <circle className="text-[#1a1a2e]" cx="12" cy="11" r="1.5" fill="currentColor" stroke="none" />
              </svg>
            </motion.button>
            )}
          </AnimatePresence>

          <div className="absolute bottom-[calc(env(safe-area-inset-bottom)+1.5rem)] left-1/2 -translate-x-1/2 z-[999] pointer-events-auto flex items-center justify-center space-x-6 h-14">
            <AnimatePresence mode="popLayout">
              <motion.button
                key="exit-button"
                layout
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                onClick={() => {
                  setIsLiveNavigation(false);
                  setActiveRoute(null);
                  setFullRoute(null);
                  setCurrentDestination(null);
                  onNavInstructionChange?.(undefined);
                  onNavDistanceChange?.(undefined);
                  if (mapRef.current) {
                    if (selectedSpot) {
                      mapRef.current.flyTo({ center: [selectedSpot.pos[1], selectedSpot.pos[0]], zoom: 17, pitch: 0, bearing: 0, duration: 1500 });
                    } else {
                      mapRef.current.easeTo({ pitch: 0, bearing: 0, zoom: 13.5 });
                    }
                  }
                }}
                className="bg-[#ff4d6d] text-white font-black w-14 h-14 p-0 rounded-full shadow-[0_0_20px_rgba(255,77,109,0.5)] active:scale-90 transition-colors flex items-center justify-center border border-[#ff4d6d]/30 shrink-0"
              >
                <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3.5} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </motion.button>

              {!isLiveNavigation && (
                <motion.button
                  key="start-button"
                  layout
                  initial={{ scale: 0.5, opacity: 0, x: -30 }}
                  animate={{ scale: 1, opacity: 1, x: 0 }}
                  exit={{ scale: 0.5, opacity: 0, x: -30, rotate: -45 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                  onClick={() => { setIsLiveNavigation(true); setIsCameraLocked(true); }}
                  className="bg-[#10b981] text-white font-black w-14 h-14 p-0 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-90 transition-colors flex items-center justify-center border border-[#10b981]/30 shrink-0"
                >
                  <svg className="w-8 h-8 ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M7 5l13 7-13 7z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                  </svg>
                </motion.button>
              )}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Border Overlay perfectly overlaying the map */}
      <div className="absolute inset-0 z-[990] pointer-events-none rounded-2xl border border-white/20 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" />

      {/* Full Screen Post Modal */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {activePost && (
            <div className="fixed inset-0 z-[99999] flex flex-col items-center justify-start p-4 pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+7rem)] pointer-events-none">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm pointer-events-auto"
                onClick={() => {
                  setActivePost(null);
                  setSelectedSpot(null);
                }}
              />
              <div
                className="w-full sm:max-w-md max-h-full overflow-y-auto no-scrollbar relative pointer-events-auto flex flex-col z-10"
              >
                <div className="flex justify-end w-full mb-3">
                  <button 
                    onClick={() => {
                      setActivePost(null);
                      setSelectedSpot(null);
                    }}
                    className="w-10 h-10 bg-zinc-800 hover:bg-zinc-700 border border-white/10 rounded-full flex items-center justify-center text-white/80 hover:text-white transition-colors shadow-lg"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <GarbageCard
                   layoutId={`post-${activePost.id}`}
                   post={activePost as any}
                   variant="feed"
                   onNavigate={(lat, lng) => {
                     handleNavigate(lat, lng);
                     setActivePost(null);
                   }}
                   setErrorPopup={setErrorPopup}
                   onSupport={handleSupport}
                   onFlag={handleFlag}
                   onOrganise={handleOrganise}
                   onUserClick={(username) => {
                     setActivePost(null);
                     handleUserClick(username);
                   }}
                   supportedPosts={supportedPosts}
                   onCleanupSuccess={(id, severity, imageUrl) => {
                     setActivePost(null);
                     setSelectedSpot(null);
                     supabase.from('reports').select('*').then(({ data }) => {
                       if (data) {
                         const formattedData = data.map((r: any) => ({ ...r, pos: [r.lat, r.lng] }));
                         setHotspots(formattedData);
                       }
                     });
                   }}
                />
              </div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Error Popup Modal */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {errorPopup && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setErrorPopup(null)}
                className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                className="relative w-full max-w-sm glass-panel p-6 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center"
              >
                <div className="w-16 h-16 rounded-full bg-[#ff4d6d]/20 flex items-center justify-center mb-4 border border-[#ff4d6d]/30">
                  <AlertTriangle className="w-8 h-8 text-[#ff4d6d]" />
                </div>
                <h2 className="text-xl font-black text-white mb-2">{errorPopup.title}</h2>
                <p className="text-zinc-400 font-medium mb-6 text-sm">{errorPopup.message}</p>
                <button
                  onClick={() => setErrorPopup(null)}
                  className="w-full py-3.5 bg-white/10 hover:bg-white/15 text-white font-black rounded-xl transition-colors pointer-events-auto"
                >
                  Got it
                </button>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
      
      {PostActionModals}
    </div>
  );
}
