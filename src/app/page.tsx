"use client";

import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { MapPin } from "lucide-react";

// Dynamically import the map to avoid SSR issues with Leaflet
const GarbageMap = dynamic(() => import("@/components/GarbageMap"), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full flex items-center justify-center bg-[#0a0a0a] rounded-2xl border border-white/5">
      <div className="flex flex-col items-center">
        <MapPin className="text-[#ff4d6d] w-8 h-8 animate-bounce mb-4" />
        <p className="text-text-secondary font-bold uppercase tracking-widest text-xs">Loading Map Data...</p>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <div className="relative h-[calc(100vh-140px)] w-full flex flex-col px-4 pt-6 pb-2">
      {/* Header Overlay */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-4 z-10"
      >
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Discover
        </h1>
        <p className="text-text-secondary text-sm font-semibold mt-1">
          Garbage hotspots in J.P. Nagar.
        </p>
      </motion.div>
      
      {/* Map Container */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full flex-1 relative z-0 rounded-2xl overflow-hidden"
      >
        <GarbageMap />
      </motion.div>
    </div>
  );
}
