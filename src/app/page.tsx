"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Flame, Target, CheckCircle2, X, Info, ChevronDown } from "lucide-react";
import { getCurrentUser } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getUserStreak } from "@/lib/streak";
import { getFastLocation } from "@/lib/location";
import { Geolocation } from "@capacitor/geolocation";
import { getDailyMissions, Mission } from "@/lib/missions";
import dynamic from "next/dynamic";

const GarbageMap = dynamic(() => import("@/components/GarbageMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#000000]">
      <div className="flex flex-col items-center">
        <MapPin className="text-zinc-400 w-8 h-8 animate-bounce mb-4" />
        <p className="text-zinc-400 font-bold uppercase tracking-widest text-xs">Loading Map Data...</p>
      </div>
    </div>
  ),
});

// Haversine formula to calculate distance between two coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = lat1 * Math.PI / 180;
  const p2 = lat2 * Math.PI / 180;
  const dp = (lat2 - lat1) * Math.PI / 180;
  const dl = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dp / 2) * Math.sin(dp / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

let cachedClosestMission: any = null;
let cachedObjectives: any = { hotspot: false, sunset: false, newArea: false };

export default function Home() {
  const [closestMission, setClosestMission] = useState<{ id: number, lat: number, lng: number, distance: number, severity?: any } | null>(cachedClosestMission);

  useEffect(() => {
    // Eagerly fetch hotspots the millisecond the app launches so they are ready for the map
    if (typeof window !== 'undefined' && !(window as any).__nammaHotspotsPromise) {
      (window as any).__nammaHotspotsPromise = supabase.from('reports').select('*');
    }
  }, []);

  // Try to instantly grab location from cache on mount
  const [userLoc, setUserLoc] = useState<{ lat: number, lng: number, heading?: number | null } | null>(() => {
    if (typeof window !== 'undefined') {
      const lat = localStorage.getItem('namma_lat');
      const lng = localStorage.getItem('namma_lng');
      if (lat && lng) return { lat: parseFloat(lat), lng: parseFloat(lng) };
    }
    return null;
  });

  const [isOutOfBounds, setIsOutOfBounds] = useState(false);
  const [streak, setStreak] = useState(0);
  const [isMissionDismissed, setIsMissionDismissed] = useState(false);
  const [dailyMissions, setDailyMissions] = useState<Mission[]>([]);
  const [claims, setClaims] = useState<Record<string, boolean>>({});
  const [completions, setCompletions] = useState<Record<string, boolean>>({});
  const [missionRouteDest, setMissionRouteDest] = useState<{ lat: number, lng: number } | null>(null);
  const [navInstruction, setNavInstruction] = useState<string | undefined>(undefined);
  const [navDistance, setNavDistance] = useState<number | undefined>(undefined);
  const [isMapRouting, setIsMapRouting] = useState(false);
  const [isMissionsCollapsed, setIsMissionsCollapsed] = useState(true);
  const [hasOpenedMissions, setHasOpenedMissions] = useState(false);

  const checkBounds = (lat: number, lng: number) => {
    // strict allowedBounds: [12.865, 77.550] to [12.945, 77.625]
    if (lat < 12.865 || lat > 12.945 || lng < 77.550 || lng > 77.625) {
      setIsOutOfBounds(true);
    } else {
      setIsOutOfBounds(false);
    }
  };

  useEffect(() => {
    if (sessionStorage.getItem('namma_mission_dismissed') === 'true') {
      setIsMissionDismissed(true);
    }
    if (sessionStorage.getItem('namma_missions_opened') === 'true') {
      setHasOpenedMissions(true);
    }
    const today = new Date().toISOString().split('T')[0];
    const missions = getDailyMissions(today);
    setDailyMissions(missions);

    const initialClaims: Record<string, boolean> = {};
    missions.forEach(m => {
      initialClaims[m.id] = localStorage.getItem(`namma_mission_${today}_${m.id}_claimed`) === 'true';
    });
    setClaims(initialClaims);
  }, []);

  const [xpEvent, setXpEvent] = useState<{amount: number, id: string} | null>(null);

  const claimMission = async (mission: any) => {
    if (claims[mission.id]) return;
    const today = new Date().toISOString().split('T')[0];
    setClaims(prev => ({ ...prev, [mission.id]: true }));
    localStorage.setItem(`namma_mission_${today}_${mission.id}_claimed`, 'true');
    setXpEvent({ amount: mission.xp, id: Date.now().toString() });
    try {
      // Use secure Server RPC instead of raw client update
      await supabase.rpc('add_mission_xp', {
        user_name: getCurrentUser(),
        amount: mission.xp
      });
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    let watchId: string;
    // Proactively request native permissions (iOS/Android will show prompt, web ignores or handles gracefully)
    const requestNativePermissions = async () => {
      try {
        await Geolocation.requestPermissions();
        watchId = await Geolocation.watchPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }, (pos, err) => {
          if (pos) {
            setUserLoc({
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              heading: pos.coords.heading
            });
            checkBounds(pos.coords.latitude, pos.coords.longitude);
          }
        });
      } catch (e) {
        // Safe to ignore on Web
      }
    };
    requestNativePermissions();

    getUserStreak(getCurrentUser()).then(setStreak);
    const fetchMissions = async () => {
      try {
        const feedNavigate = localStorage.getItem('namma_feed_navigate');
        if (feedNavigate) {
          try {
            const dest = JSON.parse(feedNavigate);
            setMissionRouteDest(dest);
            localStorage.removeItem('namma_feed_navigate');
            setIsMissionDismissed(true);
            sessionStorage.setItem('namma_mission_dismissed', 'true');
          } catch (e) { }
        }

        const { data: reportsData, error: reportsError } = await supabase.from('reports').select('*');
        if (reportsError || !reportsData) return;
        const data = reportsData.map(r => ({ ...r, pos: [r.lat, r.lng] }));

        // Guarantee location within 1.5s max (cache -> GPS -> JP Nagar fallback)
        const loc = await getFastLocation();
        setUserLoc(loc);
        checkBounds(loc.lat, loc.lng);

        let closest: any = null;
        let minDistance = Infinity;
        data.forEach((report: any) => {
          const dist = getDistance(loc.lat, loc.lng, report.pos[0], report.pos[1]);
          if (dist < minDistance) {
            minDistance = dist;
            closest = { id: report.id, lat: report.pos[0], lng: report.pos[1], distance: dist, severity: report.severity || 1 };
          }
        });
        if (closest && minDistance < 10000) {
          cachedClosestMission = closest;
          setClosestMission(closest);
        }

        const { data: feedData, error: feedError } = await supabase.from('reports').select('*').order('timestamp', { ascending: false });
        if (!feedError && feedData) {
          const feed = feedData;
          const today = new Date().toISOString().split('T')[0];

          const myReports = feed.filter((r: any) => r.username === getCurrentUser() && r.timestamp?.startsWith(today));
          const supportedCount = parseInt(localStorage.getItem(`namma_supported_count_${today}`) || '0');

          const myCleanups = feed.filter((r: any) => r.cleanup_squad?.includes(getCurrentUser()) && (r.cleanup_timestamp?.startsWith(today) || r.timestamp?.startsWith(today)));

          let shareCount = parseInt(localStorage.getItem(`namma_share_count_${today}`) || '0');

          setDailyMissions(prevMissions => {
            const newCompletions: Record<string, boolean> = {};
            prevMissions.forEach(m => {
              newCompletions[m.id] = m.evaluate(myReports, supportedCount, myCleanups, shareCount);
            });
            setCompletions(newCompletions);
            return prevMissions;
          });
        }
      } catch (e) {
        console.error("Failed to load missions", e);
      }
    };
    fetchMissions();

    return () => {
      if (watchId) {
        Geolocation.clearWatch({ id: watchId });
      }
    };
  }, []);

  const openNavigation = () => {
    if (closestMission) {
      setMissionRouteDest({ lat: closestMission.lat, lng: closestMission.lng });
      setIsMissionDismissed(true);
      setIsMissionsCollapsed(true);
      sessionStorage.setItem('namma_mission_dismissed', 'true');
    }
  };

  if (isOutOfBounds) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 text-center bg-black/95 relative z-50 pt-safe-header pb-[calc(env(safe-area-inset-bottom)+8rem)]">
        <div className="w-24 h-24 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/30">
          <MapPin className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-3xl font-black text-white mb-3">Outside Service Area</h1>
        <p className="text-zinc-400 font-medium mb-8 max-w-xs">
          Namma Voice is currently only active in South Bengaluru (Jayanagar, JP Nagar, BTM Layout).
          You must be physically located in these areas to access the map and reports.
        </p>
        <div className="w-full h-px bg-white/10 my-4" />
        <p className="text-[#10b981] font-bold text-sm">We are expanding soon!</p>
      </div>
    );
  }

  return (
    <>
      <div className="fixed inset-0 overflow-hidden w-full flex flex-col px-4 pt-safe-header pb-[calc(env(safe-area-inset-bottom)+6rem)] space-y-3">
        <div className="flex justify-between items-start z-10 shrink-0">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="max-w-[calc(100%-150px)]">
            <div className="mb-1">
              <h1 className="text-3xl font-bold text-white tracking-tight leading-tight">Namma<br />Hood</h1>
            </div>
            <p className="text-zinc-400 text-xs font-semibold mt-1">Together, we’re making Bangalore the garden city again.</p>
          </motion.div>
        </div>

        {/* Main Content Area - Fixed Bounds */}
        <div className="w-full flex-1 relative mt-2">

          {/* Map Wrapper (Fixed Size) */}
          <div className="w-full h-full absolute inset-0 overflow-hidden rounded-2xl bg-black">
            {/* Map Container */}
            <motion.div
              layout
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="w-full absolute top-0 left-0 right-0 z-0 h-full"
            >
              <GarbageMap 
                userLoc={userLoc} 
                externalRouteDest={missionRouteDest} 
                onActiveRouteChange={setIsMapRouting} 
                xpEvent={xpEvent}
                onNavInstructionChange={setNavInstruction}
                onNavDistanceChange={setNavDistance}
              />

              {/* Combined Missions & Nearest Cleanup Overlay */}
              <AnimatePresence>
                {!isMissionsCollapsed && (
                  <motion.div
                    key="combined-missions"
                    initial={{ opacity: 0, y: 50, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 50, scale: 0.95 }}
                    transition={{ type: "spring", stiffness: 350, damping: 25 }}
                    className="absolute bottom-4 left-4 right-4 z-[9999] glass-panel border border-[#10b981]/20 bg-[#000000]/95 backdrop-blur-2xl rounded-3xl p-5 shadow-[0_20px_50px_-12px_rgba(0,0,0,1)] flex flex-col space-y-4"
                  >
                    <button
                      onClick={() => setIsMissionsCollapsed(true)}
                      className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors bg-white/5 p-1 rounded-full"
                    >
                      <X className="w-5 h-5" />
                    </button>

                    {/* Today's Missions Section */}
                    <div className="pt-1">
                      <h3 className={`${Object.values(claims).filter(Boolean).length === dailyMissions.length && dailyMissions.length > 0 ? 'text-[#10b981]/80' : 'text-[#ff4d6d]/80'} font-black text-[11px] uppercase tracking-widest flex items-center mb-3`}>
                        <div className="relative flex items-center justify-center mr-2 w-2 h-2">
                          <div className={`w-2 h-2 rounded-full ${Object.values(claims).filter(Boolean).length === dailyMissions.length && dailyMissions.length > 0 ? 'bg-[#10b981]' : 'bg-[#ff4d6d]'}`} />
                          {!(Object.values(claims).filter(Boolean).length === dailyMissions.length && dailyMissions.length > 0) && (
                            <div className="absolute inset-0 rounded-full border border-[#ff4d6d] animate-ping opacity-75 scale-150" />
                          )}
                        </div>
                        Today's Missions
                      </h3>

                      <div className="space-y-2.5">
                        {dailyMissions.map((mission, index) => {
                          const isCompleted = completions[mission.id];
                          const isClaimed = claims[mission.id];

                          return (
                            <div key={mission.id} className={`flex items-center justify-between ${isCompleted ? 'opacity-100' : 'opacity-70'}`}>
                              <div className="flex items-center space-x-3">
                                {isClaimed ? (
                                  <CheckCircle2 className="w-5 h-5 text-[#10b981]" />
                                ) : (
                                  <div className={`w-5 h-5 rounded-full border-2 ${isCompleted ? 'border-[#10b981] bg-[#10b981]/20' : 'border-zinc-500 bg-white/5'}`} />
                                )}
                                <span className={`font-bold text-[13px] ${isCompleted ? 'text-white' : 'text-zinc-300'}`}>{mission.title}</span>
                              </div>
                              {isClaimed ? (
                                <span className="text-[#10b981] font-black text-[10px] uppercase tracking-wider bg-[#10b981]/10 px-2 py-1 rounded">Claimed</span>
                              ) : isCompleted ? (
                                <button
                                  onClick={() => claimMission(mission)}
                                  className={`text-black font-black text-xs ${index === 2 ? 'bg-[#d4af37] hover:bg-[#d4af37]/80 shadow-[0_0_10px_rgba(212,175,55,0.4)]' : 'bg-[#10b981] hover:bg-[#10b981]/80 shadow-[0_0_10px_rgba(16,185,129,0.4)]'} px-3 py-1 rounded transition-all active:scale-95`}
                                >
                                  Claim +{mission.xp} XP
                                </button>
                              ) : (
                                <span className="text-zinc-400 font-black text-[10px] bg-white/5 px-2 py-1 rounded">+{mission.xp} XP</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Nearest Cleanup Section */}
                    {closestMission && (
                      <div className="pt-4 border-t border-white/10 mt-1">
                        <div className="flex items-center space-x-2 mb-2">
                          <div className="relative flex items-center justify-center w-2 h-2">
                            <div className="w-2 h-2 bg-[#ff4d6d] rounded-full" />
                            {!isMissionDismissed && (
                              <div className="absolute inset-0 rounded-full border border-[#ff4d6d] animate-ping opacity-75 scale-150" />
                            )}
                          </div>
                          <p className="text-[#ff4d6d]/80 font-black text-[11px] uppercase tracking-widest">Nearest Mission Available</p>
                        </div>
                        <div className="flex justify-between items-end mb-3">
                          <div>
                            <h3 className="text-[#d4af37] font-bold text-lg leading-tight mb-0.5">
                              {closestMission.severity === 4 || closestMission.severity === 'high' ? 'Critical Biohazard' :
                                closestMission.severity === 3 || closestMission.severity === 'medium' ? 'Severe Garbage Dump' :
                                  closestMission.severity === 2 ? 'Moderate Trash Pile' : 'Overflowing Garbage'}
                            </h3>
                            <p className="text-zinc-400 text-xs font-semibold">{closestMission.distance}m away</p>
                          </div>
                          <button
                            onClick={openNavigation}
                            className="bg-[#f14f4f] text-white font-black py-2.5 px-5 rounded-xl flex items-center space-x-2 active:scale-95 transition-transform shadow-[0_0_15px_rgba(241,79,79,0.4)]"
                          >
                            <Navigation className="w-4 h-4" />
                            <span>Navigate</span>
                          </button>
                        </div>
                        <div className="bg-white/5 p-2 rounded-xl flex items-center justify-between border border-white/5">
                          <span className="text-zinc-400 text-[10px] font-bold uppercase tracking-wider">Completion Reward</span>
                          <span className="text-[#d4af37] text-xs font-black">+20 Eco XP</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {/* Glowing FAB Info Button */}
                {isMissionsCollapsed && !isMapRouting && (
                  <motion.div
                    key="mission-fab"
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0 }}
                    transition={{ type: "spring", stiffness: 400, damping: 20 }}
                    className="absolute bottom-5 right-5 z-[9999]"
                  >
                    <button
                      onClick={() => {
                        setIsMissionsCollapsed(false);
                        setHasOpenedMissions(true);
                        sessionStorage.setItem('namma_missions_opened', 'true');
                      }}
                      className="w-12 h-12 bg-[#ff4d6d] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,77,109,0.5)] border border-[#10b981]/20 active:scale-95 transition-transform relative"
                    >
                      {/* Glowing ring animation */}
                      {!(Object.values(claims).filter(Boolean).length === dailyMissions.length && dailyMissions.length > 0) && !hasOpenedMissions && (
                        <div className="absolute inset-0 rounded-full border-2 border-[#ff4d6d] animate-ping opacity-60" />
                      )}
                      <Info className="w-6 h-6 text-white relative z-10" />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>
        </div>
      </div>
    </>
  );
}
