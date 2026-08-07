"use client";

import { useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Navigation, Target, Leaf, ShieldAlert } from "lucide-react";

interface Hotspot {
  pos: [number, number];
  [key: string]: any;
}

interface DynamicIslandProps {
  userLoc: { lat: number; lng: number; heading?: number | null } | null;
  hotspots: Hotspot[];
  isLiveNavigation: boolean;
  navDistance?: number;
  navInstruction?: string;
  xpEvent?: { amount: number; id: string } | null;
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const p1 = (lat1 * Math.PI) / 180;
  const p2 = (lat2 * Math.PI) / 180;
  const dp = ((lat2 - lat1) * Math.PI) / 180;
  const dl = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dp / 2) * Math.sin(dp / 2) +
    Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) * Math.sin(dl / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export default function DynamicIsland({
  userLoc,
  hotspots,
  isLiveNavigation,
  navDistance,
  navInstruction,
  xpEvent,
}: DynamicIslandProps) {
  const [islandState, setIslandState] = useState<
    "hidden" | "idle" | "radar-far" | "radar-near" | "radar-here" | "navigation" | "xp-drop"
  >("hidden");
  const [radarDist, setRadarDist] = useState<number | null>(null);

  const [isWalking, setIsWalking] = useState(false);
  const lastLocRef = useRef<{lat: number, lng: number} | null>(null);
  const walkTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Walking Detection Logic
  useEffect(() => {
    if (!userLoc) return;

    if (!lastLocRef.current) {
      lastLocRef.current = { lat: userLoc.lat, lng: userLoc.lng };
      return;
    }

    const distMoved = getDistance(lastLocRef.current.lat, lastLocRef.current.lng, userLoc.lat, userLoc.lng);
    
    if (distMoved >= 10) {
      // User has moved at least 10m from last anchor
      setIsWalking(true);
      lastLocRef.current = { lat: userLoc.lat, lng: userLoc.lng };
      
      if (walkTimeoutRef.current) clearTimeout(walkTimeoutRef.current);
      
      // Stop walking after 5 seconds of no significant movement
      walkTimeoutRef.current = setTimeout(() => {
        setIsWalking(false);
      }, 5000);
    }
  }, [userLoc]);

  // Handle XP Drops
  useEffect(() => {
    if (xpEvent) {
      setIslandState("xp-drop");
      const t = setTimeout(() => setIslandState("idle"), 3000);
      return () => clearTimeout(t);
    }
  }, [xpEvent]);

  // Radar Game Logic
  useEffect(() => {
    if (islandState === "xp-drop" || isLiveNavigation) return;

    if (!userLoc || !hotspots || hotspots.length === 0 || !isWalking) {
      setIslandState("hidden");
      return;
    }

    let minDistance = Infinity;
    hotspots.forEach((spot) => {
      const dist = getDistance(userLoc.lat, userLoc.lng, spot.pos[0], spot.pos[1]);
      if (dist < minDistance) minDistance = dist;
    });

    setRadarDist(Math.round(minDistance));

    if (minDistance <= 15) {
      setIslandState("radar-here");
    } else if (minDistance <= 40) {
      setIslandState("radar-near");
    } else if (minDistance <= 150) {
      setIslandState("radar-far");
    } else {
      setIslandState("idle");
    }
  }, [userLoc, hotspots, isLiveNavigation, islandState, isWalking]);

  // Navigation Logic
  useEffect(() => {
    if (isLiveNavigation && islandState !== "xp-drop") {
      setIslandState("navigation");
    } else if (!isLiveNavigation && islandState === "navigation") {
      setIslandState(isWalking ? "idle" : "hidden");
    }
  }, [isLiveNavigation, islandState]);

  // Dimensions for Framer Motion based on state
  const getIslandStyles = () => {
    switch (islandState) {
      case "hidden":
        return { width: 120, height: 35, borderRadius: 24, opacity: 0 };
      case "idle":
        return { width: 120, height: 35, borderRadius: 24, opacity: 1 };
      case "radar-far":
        return { width: 220, height: 40, borderRadius: 24, opacity: 1 };
      case "radar-near":
        return { width: 280, height: 44, borderRadius: 24, opacity: 1 };
      case "radar-here":
        return { width: 200, height: 50, borderRadius: 24, opacity: 1 };
      case "navigation":
        return { width: 340, height: 65, borderRadius: 32, opacity: 1 };
      case "xp-drop":
        return { width: 160, height: 60, borderRadius: 30, opacity: 1 };
      default:
        return { width: 120, height: 35, borderRadius: 24, opacity: 1 };
    }
  };

  return (
    <div className="fixed top-2 left-1/2 -translate-x-1/2 z-[9999] pointer-events-none flex justify-center">
      <motion.div
        layout
        initial={false}
        animate={getIslandStyles()}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
        className="bg-black text-white overflow-hidden shadow-[0_10px_40px_rgba(0,0,0,0.8)] relative flex items-center justify-center pointer-events-auto"
      >
        <AnimatePresence mode="wait">
          {/* IDLE */}
          {islandState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center space-x-2 text-[#10b981]"
            >
              <div className="w-2 h-2 rounded-full bg-[#10b981] animate-pulse" />
              <span className="text-[10px] font-bold tracking-widest uppercase">Scanning</span>
            </motion.div>
          )}

          {/* RADAR FAR */}
          {islandState === "radar-far" && (
            <motion.div
              key="radar-far"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-between w-full px-4"
            >
              <div className="flex items-center text-[#ffcc00]">
                <ShieldAlert className="w-4 h-4 mr-2" />
                <span className="text-[11px] font-black tracking-widest">HOTSPOT</span>
              </div>
              <span className="text-[#ffcc00]/80 text-[11px] font-bold">{radarDist}m away</span>
            </motion.div>
          )}

          {/* RADAR NEAR */}
          {islandState === "radar-near" && (
            <motion.div
              key="radar-near"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-between w-full px-5"
            >
              <div className="flex items-center text-[#ff4d6d]">
                <Target className="w-5 h-5 mr-2 animate-pulse" />
                <span className="text-[12px] font-black tracking-widest uppercase">Opportunity</span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[#ff4d6d] text-[12px] font-bold">{radarDist}m</span>
                <span className="text-[#10b981] text-[9px] font-black">+30 XP</span>
              </div>
            </motion.div>
          )}

          {/* RADAR HERE */}
          {islandState === "radar-here" && (
            <motion.div
              key="radar-here"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center justify-center w-full space-x-3 text-[#10b981]"
            >
              <Leaf className="w-6 h-6 animate-bounce" />
              <div className="flex flex-col">
                <span className="text-[13px] font-black tracking-wider uppercase">Mission Found</span>
                <span className="text-[10px] text-[#10b981]/80 font-bold">Clean this spot</span>
              </div>
            </motion.div>
          )}

          {/* NAVIGATION */}
          {islandState === "navigation" && (
            <motion.div
              key="navigation"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="flex items-center justify-between w-full px-6 h-full"
            >
              <div className="flex items-center h-full">
                <div className="bg-zinc-800/80 p-2 rounded-full mr-3">
                  <Navigation className="w-6 h-6 text-white" />
                </div>
                <div className="flex flex-col justify-center">
                  <span className="text-white text-[13px] font-bold truncate max-w-[150px]">
                    {navInstruction || "Proceed to route"}
                  </span>
                </div>
              </div>
              <span className="text-[#10b981] text-lg font-black">{navDistance ? `${navDistance}m` : ''}</span>
            </motion.div>
          )}

          {/* XP DROP */}
          {islandState === "xp-drop" && (
            <motion.div
              key="xp-drop"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0 }}
              className="flex flex-col items-center justify-center w-full h-full text-[#10b981]"
            >
              <span className="text-lg font-black">+{xpEvent?.amount} XP</span>
              <span className="text-[10px] font-bold tracking-widest text-[#10b981]/70">REWARD CLAIMED</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* XP Drop Particle Effect */}
        <AnimatePresence>
          {islandState === "xp-drop" && (
            <motion.div
              initial={{ opacity: 1, y: 0, scale: 1 }}
              animate={{ opacity: 0, y: 300, scale: 1.5, rotate: 180 }}
              transition={{ duration: 1.5, ease: "easeIn" }}
              className="absolute -bottom-4 text-[#d4af37]"
            >
              <Leaf className="w-8 h-8 drop-shadow-[0_0_15px_#10b981]" fill="currentColor" />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
