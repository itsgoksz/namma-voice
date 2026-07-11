"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Navigation, Flame, Target, CheckCircle2, X, Info } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { getLocalStreak } from "@/lib/streak";
import { getFastLocation } from "@/lib/location";
import { Geolocation } from "@capacitor/geolocation";

const GarbageMap = dynamic(() => import("@/components/GarbageMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a] rounded-2xl border border-[#455d49]">
      <div className="flex flex-col items-center">
        <MapPin className="text-[#455d49] w-8 h-8 animate-bounce mb-4" />
        <p className="text-[#455d49] font-bold uppercase tracking-widest text-xs">Loading Map Data...</p>
      </div>
    </div>
  ),
});

// Haversine formula to calculate distance between two coordinates in meters
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; 
  const p1 = lat1 * Math.PI/180;
  const p2 = lat2 * Math.PI/180;
  const dp = (lat2-lat1) * Math.PI/180;
  const dl = (lon2-lon1) * Math.PI/180;
  const a = Math.sin(dp/2) * Math.sin(dp/2) + Math.cos(p1) * Math.cos(p2) * Math.sin(dl/2) * Math.sin(dl/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return Math.round(R * c);
}

export default function Home() {
  const [closestMission, setClosestMission] = useState<{ id: number, lat: number, lng: number, distance: number, severity?: any } | null>(null);
  const [userLoc, setUserLoc] = useState<{lat: number, lng: number} | null>(null);
  const [streak, setStreak] = useState(0);
  const [isMissionDismissed, setIsMissionDismissed] = useState(false);

  useEffect(() => {
    // Proactively request native permissions (iOS/Android will show prompt, web ignores or handles gracefully)
    const requestNativePermissions = async () => {
      try {
        await Geolocation.requestPermissions();
      } catch (e) {
        // Safe to ignore on Web
      }
    };
    requestNativePermissions();

    setStreak(getLocalStreak());
    const fetchMissions = async () => {
      try {
        const res = await apiFetch('/reports');
        if (!res.ok) return;
        const data = await res.json();
        
        // Guarantee location within 1.5s max (cache -> GPS -> JP Nagar fallback)
        const loc = await getFastLocation();
        setUserLoc(loc);
        
        let closest: any = null;
        let minDistance = Infinity;
        data.forEach((report: any) => {
          const dist = getDistance(loc.lat, loc.lng, report.pos[0], report.pos[1]);
          if (dist < minDistance) {
            minDistance = dist;
            closest = { id: report.id, lat: report.pos[0], lng: report.pos[1], distance: dist, severity: report.severity || 1 };
          }
        });
        if (closest && minDistance < 10000) setClosestMission(closest);
      } catch (e) {
        console.error("Failed to load missions", e);
      }
    };
    fetchMissions();
  }, []);

  const openNavigation = () => {
    if (closestMission) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${closestMission.lat},${closestMission.lng}`, '_blank');
    }
  };

  return (
    <div className="relative h-full overflow-hidden w-full flex flex-col px-4 pt-6 pb-32 space-y-4">
      {/* Header & Streak Overlay */}
      <div className="flex justify-between items-start z-10">
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}>
          <h1 className="text-3xl font-bold text-white tracking-tight">Discover</h1>
          <p className="text-[#455d49] text-sm font-semibold mt-1">Today's Missions</p>
        </motion.div>
        <motion.div 
          initial={{ opacity: 0, scale: 0.8 }} 
          animate={{ opacity: 1, scale: 1 }}
          className="bg-[rgba(21,57,57,0.85)] border border-[#455d49] px-3 py-1.5 rounded-full flex items-center shadow-lg backdrop-blur-sm"
        >
          <Flame className="w-4 h-4 text-[#ff9f1c] mr-1.5 fill-current" />
          <span className="text-white font-bold text-sm">{streak} Day Streak</span>
        </motion.div>
      </div>

      {/* Daily Checklist */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass-panel p-4 rounded-2xl border border-[#455d49] bg-black z-10 w-full shrink-0"
      >
        <div className="flex justify-between items-center mb-3">
          <h3 className="text-[#d4af37] font-bold text-sm uppercase tracking-widest flex items-center">
            <Target className="w-4 h-4 mr-2 text-[#455d49]" /> Daily Objectives
          </h3>
          <span className="text-[#455d49] font-black text-xs">+50 🌏 Points</span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center space-x-3 opacity-100">
            <CheckCircle2 className="w-5 h-5 text-[#455d49]" />
            <span className="text-sm font-semibold text-[#ff4d6d] line-through decoration-[#ff4d6d]/50">Report 1 hotspot</span>
          </div>
          <div className="flex items-center space-x-3 opacity-50">
            <div className="w-5 h-5 rounded-full border-2 border-[#455d49]" />
            <span className="text-sm font-medium text-[#ff4d6d]">Report after sunset</span>
          </div>
          <div className="flex items-center space-x-3 opacity-50">
            <div className="w-5 h-5 rounded-full border-2 border-[#455d49]" />
            <span className="text-sm font-medium text-[#ff4d6d]">Visit a new area</span>
          </div>
        </div>
      </motion.div>
      
      {/* Map Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.2 }}
        className="w-full flex-1 relative z-0 rounded-2xl overflow-hidden shadow-2xl"
      >
        <GarbageMap />

        {/* Nearby Mission Overlay */}
        <AnimatePresence>
          {closestMission && !isMissionDismissed && (
            <motion.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              className="absolute bottom-4 left-4 right-4 z-[9999] glass-panel border border-[#455d49]/50 bg-[#0d1b0a]/90 backdrop-blur-xl rounded-3xl p-4 shadow-[0_0_30px_rgba(69,93,73,0.3)]"
            >
              <button 
                onClick={() => setIsMissionDismissed(true)}
                className="absolute top-4 right-4 text-[#455d49] hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <div className="flex items-center space-x-2 mb-2 pr-6">
                <div className="w-2 h-2 bg-[#ff4d6d] rounded-full animate-ping" />
                <p className="text-[#ff4d6d] font-black text-[10px] uppercase tracking-widest">Mission Available</p>
              </div>
              <div className="flex justify-between items-end mb-3">
                <div>
                  <h3 className="text-[#d4af37] font-bold text-xl leading-tight mb-0.5">
                    {closestMission.severity === 4 || closestMission.severity === 'high' ? 'Critical Biohazard' : 
                     closestMission.severity === 3 || closestMission.severity === 'medium' ? 'Severe Garbage Dump' : 
                     closestMission.severity === 2 ? 'Moderate Trash Pile' : 'Overflowing Garbage'}
                  </h3>
                  <p className="text-[#455d49] text-sm font-semibold">{closestMission.distance}m away</p>
                </div>
                <button 
                  onClick={openNavigation}
                  className="bg-[#10b981] text-white font-bold py-3 px-6 rounded-xl flex items-center space-x-2 active:scale-95 transition-transform shadow-[0_0_20px_rgba(16,185,129,0.3)]"
                >
                  <Navigation className="w-5 h-5" />
                  <span>Navigate</span>
                </button>
              </div>
              <div className="bg-[#455d49]/30 p-2.5 rounded-xl flex items-center justify-between border border-[#455d49]">
                 <span className="text-white/60 text-xs font-bold uppercase tracking-wider">Completion Reward</span>
                 <span className="text-[#455d49] text-sm font-black">+20 🌏 Points</span>
              </div>
            </motion.div>
          )}
          {closestMission && isMissionDismissed && (
            <motion.div 
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              className="absolute bottom-4 right-4 z-[9999]"
            >
              <button 
                onClick={() => setIsMissionDismissed(false)}
                className="w-12 h-12 bg-[#ff4d6d] rounded-full flex items-center justify-center shadow-[0_0_20px_rgba(255,77,109,0.5)] border border-[#455d49] active:scale-95 transition-transform"
              >
                <Info className="w-6 h-6 text-white" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
