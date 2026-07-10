"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Flame, MapPin, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getCurrentUser } from "@/lib/api";
import { getLocalStreak } from "@/lib/streak";

export default function ProfilePage() {
  const [user, setUser] = useState({ name: getCurrentUser(), level: 1, xp: 0, reports_count: 0 });
  const [loading, setLoading] = useState(true);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    setStreak(getLocalStreak());
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
    { name: "Explorer", icon: "🗺️", unlocked: user.reports_count >= 1 },
    { name: "Reporter", icon: "📸", unlocked: user.reports_count >= 5 },
    { name: "Neighbour Hero", icon: "🦸", unlocked: user.reports_count >= 10 },
    { name: "Guardian", icon: "🛡️", unlocked: user.level >= 3 },
    { name: "Community Champion", icon: "🏆", unlocked: user.level >= 5 },
    { name: "City Ranger", icon: "🤠", unlocked: user.level >= 10 },
    { name: "Earth Keeper", icon: "🌍", unlocked: user.level >= 15 },
    { name: "Legend", icon: "👑", unlocked: user.level >= 20 },
  ];

  if (loading) return null;

  return (
    <div className="p-4 space-y-6 pt-8 pb-32 max-w-md mx-auto relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1"
      >
        <h1 className="text-4xl font-bold text-foreground tracking-tight">
          Good Evening, {user.name}.
        </h1>
        <div className="flex items-center space-x-1 mt-1 opacity-80">
          <MapPin className="text-[#ff4d6d] w-4 h-4" />
          <p className="text-[#ff4d6d] text-sm font-semibold">JP Nagar 3rd Phase</p>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-5 rounded-3xl mt-6 border border-white/5 bg-[rgba(20,20,20,0.85)]"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-foreground">Level {user.level}</h2>
          <div className="flex items-center space-x-1">
            <Zap className="w-5 h-5 text-[#ff4d6d] fill-current" />
            <span className="text-xl font-black text-white">{user.xp} 🌏 Points</span>
          </div>
        </div>
        <div className="w-full bg-white/5 rounded-full h-3 mb-2 relative overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, delay: 0.3 }}
            className="bg-[#ff4d6d] h-3 rounded-full absolute left-0 top-0 shadow-[0_0_10px_rgba(255,77,109,0.5)]"
          ></motion.div>
        </div>
        <p className="text-right text-xs text-text-secondary font-bold uppercase tracking-wider">
          {nextLevelXp - user.xp} 🌏 POINTS TO LEVEL {user.level + 1}
        </p>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <h3 className="text-xl font-bold text-foreground mb-4">Your Stats</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-[rgba(20,20,20,0.85)]">
            <Flame className="w-6 h-6 text-[#ff9f1c] mb-3" />
            <p className="text-3xl font-black text-white">{streak}</p>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mt-1">Day Streak</p>
          </div>
          <div className="glass-panel p-5 rounded-3xl border border-white/5 bg-[rgba(20,20,20,0.85)]">
            <Award className="w-6 h-6 text-[#3a86ff] mb-3" />
            <p className="text-3xl font-black text-white">{user.reports_count}</p>
            <p className="text-[10px] text-text-secondary font-bold uppercase tracking-widest mt-1">Total Reports</p>
          </div>
        </div>
      </motion.div>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <h3 className="text-xl font-bold text-foreground mb-4">Badges</h3>
        <div className="grid grid-cols-3 gap-3">
          {badges.map((badge, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.05 }}
              className={cn(
                "flex flex-col items-center justify-center p-3 rounded-2xl transition-all border",
                badge.unlocked 
                  ? "bg-[rgba(20,20,20,0.85)] border-white/10 opacity-100" 
                  : "bg-white/5 border-transparent opacity-40 grayscale"
              )}
            >
              <span className="text-3xl mb-2 filter drop-shadow-md">{badge.icon}</span>
              <p className="text-[10px] font-bold text-center text-text-secondary">{badge.name}</p>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
