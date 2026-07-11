"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Flame, MapPin, Zap, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { getLocalStreak } from "@/lib/streak";
import { getFastLocation } from "@/lib/location";

export default function ProfilePage() {
  const [user, setUser] = useState({ name: getCurrentUser(), level: 1, xp: 0, reports_count: 0 });
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [locationName, setLocationName] = useState("Locating...");
  const [badgeMessage, setBadgeMessage] = useState<{ title: string, text: string } | null>(null);

  useEffect(() => {
    setStreak(getLocalStreak());
    
    // Check cache first for instant load
    const cachedLocName = localStorage.getItem('namma_loc_name');
    if (cachedLocName) setLocationName(cachedLocName);

    // Fetch user location for dynamic header
    const updateLocation = async () => {
      const loc = await getFastLocation();
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${loc.lat}&lon=${loc.lng}&zoom=16`);
        const data = await res.json();
        const locName = data.address?.neighbourhood || data.address?.suburb || data.address?.road || "Unknown Area";
        setLocationName(locName);
        localStorage.setItem('namma_loc_name', locName);
      } catch (e) {
        if (!cachedLocName) setLocationName("Unknown Area");
      }
    };
    updateLocation();

    const fetchUser = async () => {
      try {
        const username = getCurrentUser();
        const res = await apiFetch(`/user/${username}`);
        if (res.ok) {
          const data = await res.json();
          setUser(data);
        }
      } catch (e) {
        console.error("Failed to fetch user", e);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
    const interval = setInterval(fetchUser, 5000);
    return () => clearInterval(interval);
  }, []);

  const nextLevelXp = user.level * 50;
  const progress = Math.min(100, Math.max(0, (user.xp / nextLevelXp) * 100));

  const badges = [
    { name: "Explorer", icon: "🗺️", unlocked: user.reports_count >= 1, req: "Make your first report." },
    { name: "Reporter", icon: "📸", unlocked: user.reports_count >= 5, req: "Submit 5 total reports." },
    { name: "Neighbour Hero", icon: "🦸", unlocked: user.reports_count >= 10, req: "Submit 10 total reports." },
    { name: "Guardian", icon: "🛡️", unlocked: user.level >= 3, req: "Reach Level 3." },
    { name: "Community Champion", icon: "🏆", unlocked: user.level >= 5, req: "Reach Level 5." },
    { name: "City Ranger", icon: "🤠", unlocked: user.level >= 10, req: "Reach Level 10." },
    { name: "Earth Keeper", icon: "🌍", unlocked: user.level >= 15, req: "Reach Level 15." },
    { name: "Legend", icon: "👑", unlocked: user.level >= 20, req: "Reach Level 20." },
  ];

  if (loading) return null;

  return (
    <div className="p-4 space-y-6 h-full overflow-y-auto pt-8 pb-32 max-w-md mx-auto relative z-10">
      <AnimatePresence>
        {badgeMessage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBadgeMessage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#0d1b0a]/80 px-6 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[rgba(20,20,20,0.95)] border border-[#455d49] p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center"
            >
              <Info className="w-10 h-10 text-[#455d49] mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{badgeMessage.title}</h3>
              <p className="text-[#455d49] font-medium">{badgeMessage.text}</p>
              <button 
                onClick={() => setBadgeMessage(null)}
                className="mt-6 bg-[#455d49]/30 hover:bg-[#455d49]/60 text-white px-6 py-2 rounded-full font-semibold transition-colors"
              >
                Got it
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1"
      >
        <h1 className="text-4xl font-bold text-white tracking-tight">
          Good Evening, {user.name}.
        </h1>
        <div className="flex items-center space-x-1 mt-1 opacity-80">
          <MapPin className="text-[#455d49] w-4 h-4" />
          <p className="text-[#455d49] text-sm font-semibold">{locationName}</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-5 rounded-3xl mt-6 border border-[#455d49] bg-[rgba(21,57,57,0.85)]"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Level {user.level}</h2>
          <div className="flex items-center space-x-1">
            <Zap className="w-5 h-5 text-[#455d49] fill-current" />
            <span className="text-xl font-black text-white">{user.xp} 🌏 Points</span>
          </div>
        </div>
        <div className="w-full bg-[#455d49]/30 rounded-full h-3 mb-2 relative overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, delay: 0.3 }}
            className="bg-[#455d49] h-3 rounded-full absolute left-0 top-0 shadow-[0_0_10px_rgba(69,93,73,0.5)]"
          ></motion.div>
        </div>
        <p className="text-right text-xs text-[#455d49] font-bold uppercase tracking-wider">
          {nextLevelXp - user.xp} 🌏 POINTS TO LEVEL {user.level + 1}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-xl font-bold text-white mb-4">Your Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-5 rounded-3xl border border-[#455d49] bg-[rgba(21,57,57,0.85)]">
            <Flame className="w-6 h-6 text-[#ff9f1c] mb-3" />
            <p className="text-3xl font-black text-white">{streak}</p>
            <p className="text-[10px] text-[#455d49] font-bold uppercase tracking-widest mt-1">Day Streak</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border border-[#455d49] bg-[rgba(21,57,57,0.85)]">
            <Award className="w-6 h-6 text-[#3a86ff] mb-3" />
            <p className="text-3xl font-black text-white">{user.reports_count}</p>
            <p className="text-[10px] text-[#455d49] font-bold uppercase tracking-widest mt-1">Total Reports</p>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-xl font-bold text-white mb-4">Badges</h3>
        <div className="grid grid-cols-3 gap-3">
          {badges.map((badge, i) => (
            <motion.div 
              key={i}
              onClick={() => {
                if (!badge.unlocked) {
                  setBadgeMessage({ title: `Locked: ${badge.name}`, text: badge.req });
                }
              }}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-2xl transition-all border",
                badge.unlocked 
                  ? "bg-[rgba(21,57,57,0.85)] border-[#455d49] opacity-100" 
                  : "bg-[#455d49]/30 border-transparent opacity-40 grayscale cursor-pointer hover:opacity-60"
              )}
            >
              <span className="text-3xl mb-2 filter drop-shadow-md">{badge.icon}</span>
              <p className="text-[10px] font-bold text-center text-[#455d49]">{badge.name}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
