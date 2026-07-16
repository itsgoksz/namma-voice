"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Award, Flame, MapPin, Zap, Info } from "lucide-react";
import { ProgressionTree } from "@/components/ProgressionTree";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getUserStreak } from "@/lib/streak";
import { getFastLocation } from "@/lib/location";

export default function ProfilePage() {
  const [user, setUser] = useState({ name: getCurrentUser(), level: 1, xp: 0, reports_count: 0 });
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);
  const [locationName, setLocationName] = useState("Locating...");
  const [badgeMessage, setBadgeMessage] = useState<{ title: string, text: string } | null>(null);

  useEffect(() => {
    getUserStreak(getCurrentUser()).then(setStreak);

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
        const { data, error } = await supabase.from('users').select('*').eq('name', username).single();
        if (!error && data) {
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
  const progress = user ? (user.xp / nextLevelXp) * 100 : 0;

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

  const currentBadgeIndex = badges.map(b => b.unlocked).lastIndexOf(true);

  if (loading) return null;

  return (
    <div className="p-4 space-y-6 h-full overflow-y-auto pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+8rem)] max-w-md mx-auto relative z-10">
      <AnimatePresence>
        {badgeMessage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setBadgeMessage(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-[#000000]/80 px-6 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="bg-[rgba(20,20,20,0.95)] border border-[#10b981]/20 p-6 rounded-3xl w-full max-w-sm shadow-2xl text-center"
            >
              <Info className="w-10 h-10 text-zinc-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold text-white mb-2">{badgeMessage.title}</h3>
              <p className="text-zinc-400 font-medium">{badgeMessage.text}</p>
              <button
                onClick={() => setBadgeMessage(null)}
                className="mt-6 bg-[#10b981]/5 hover:bg-[#10b981]/60 text-white px-6 py-2 rounded-full font-semibold transition-colors active:scale-95"
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
          <MapPin className="text-zinc-400 w-4 h-4" />
          <p className="text-zinc-400 text-sm font-semibold">{locationName}</p>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-5 rounded-3xl mt-6 border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-xl flex justify-center overflow-hidden"
      >
        <ProgressionTree level={user.level} xp={user.xp} nextLevelXp={nextLevelXp} />
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-xl font-bold text-white mb-4">Your Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-5 rounded-3xl border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-xl">
            <Flame className="w-6 h-6 text-[#ff9f1c] mb-3" />
            <p className="text-3xl font-black text-white">{streak}</p>
            <p className="text-xs text-white/70 font-bold uppercase tracking-widest mt-1">Day Streak</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-xl">
            <Award className="w-6 h-6 text-[#3a86ff] mb-3" />
            <p className="text-3xl font-black text-white">{user.reports_count}</p>
            <p className="text-xs text-white/70 font-bold uppercase tracking-widest mt-1">Total Reports</p>
          </div>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-xl font-bold text-[#d4af37] mb-4">Badge Timeline</h3>

        <div className="relative flex items-center justify-center py-4 overflow-hidden w-full max-w-sm mx-auto">
          <div className="flex items-center space-x-2 z-10 w-full px-4 relative">

            {/* Previous Badge */}
            <div className="flex-1 flex justify-center">
              {currentBadgeIndex > 0 ? (
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl bg-[#10b981]/5 border border-[#10b981]/10 opacity-60 scale-90 w-full max-w-[80px]">
                  <span className="text-2xl mb-1 filter drop-shadow-md">{badges[currentBadgeIndex - 1].icon}</span>
                  <p className="text-[10px] font-bold text-center text-white/70 truncate w-full">{badges[currentBadgeIndex - 1].name}</p>
                </div>
              ) : (
                <div className="w-full max-w-[80px]" /> /* Empty placeholder to keep center aligned */
              )}
            </div>

            {/* Current Badge */}
            <div className="flex-1 flex justify-center relative">
              {currentBadgeIndex >= 0 ? (
                <div className="flex flex-col items-center justify-center p-4 rounded-3xl bg-[#10b981]/20 border border-[#10b981]/40 shadow-[0_0_30px_rgba(16,185,129,0.3)] scale-110 z-20 w-full max-w-[100px]">
                  <div className="absolute inset-0 bg-[#10b981] opacity-20 blur-xl rounded-full" />
                  <span className="text-4xl mb-2 filter drop-shadow-lg relative z-10">{badges[currentBadgeIndex].icon}</span>
                  <p className="text-xs font-black text-center text-white relative z-10 truncate w-full">{badges[currentBadgeIndex].name}</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-4 rounded-3xl bg-white/5 border border-white/10 opacity-50 z-20 w-full max-w-[100px]">
                  <span className="text-2xl mb-2 text-zinc-500">?</span>
                  <p className="text-[10px] font-bold text-center text-zinc-500">No Badges</p>
                </div>
              )}
            </div>

            {/* Next Badge */}
            <div className="flex-1 flex justify-center flex-col items-center">
              {currentBadgeIndex < badges.length - 1 ? (
                <div
                  onClick={() => setBadgeMessage({ title: `Locked: ${badges[currentBadgeIndex + 1].name}`, text: badges[currentBadgeIndex + 1].req })}
                  className="flex flex-col items-center justify-center p-3 rounded-2xl bg-white/5 border border-transparent opacity-40 grayscale scale-90 cursor-pointer w-full max-w-[80px] hover:opacity-60 transition-opacity"
                >
                  <span className="text-2xl mb-1 filter drop-shadow-md">{badges[currentBadgeIndex + 1].icon}</span>
                  <p className="text-[10px] font-bold text-center text-white/70 truncate w-full">Locked</p>
                </div>
              ) : (
                <div className="w-full max-w-[80px]" />
              )}
            </div>

            {/* Indicator for more badges */}
            {currentBadgeIndex < badges.length - 2 && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 font-bold tracking-widest text-lg">
                •••
              </div>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
