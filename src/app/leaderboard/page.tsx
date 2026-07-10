"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch, getCurrentUser } from "@/lib/api";

interface User {
  id: number;
  name: string;
  xp: number;
  level: number;
  reports_count: number;
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<User[]>([]);
  const currentUser = getCurrentUser();

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const res = await apiFetch('/leaderboard');
        if (res.ok) {
          const data = await res.json();
          setLeaders(data);
        }
      } catch (e) {
        console.error("Failed to fetch leaderboard", e);
      }
    };
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="p-4 space-y-6 h-full flex flex-col pt-8 pb-32 max-w-md mx-auto relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1"
      >
        <h1 className="text-4xl font-bold text-foreground tracking-tight">Leaderboard</h1>
        <div className="flex items-center space-x-1 mt-1 opacity-80">
          <MapPin className="text-[#ff4d6d] w-4 h-4" />
          <p className="text-[#ff4d6d] text-sm font-semibold">JP Nagar 3rd Phase</p>
        </div>
      </motion.div>

      {/* Top 3 Podium */}
      {leaders.length >= 3 && (
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex justify-center items-end h-48 space-x-2 mt-8 mb-4 px-2"
        >
          {/* 2nd Place */}
          <div className="flex flex-col items-center flex-1">
            <div className="relative mb-2">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl border border-white/20">🥈</div>
            </div>
            <p className="text-sm font-bold text-white truncate max-w-[80px]">{top3[1]?.name}</p>
            <p className="text-[#ff4d6d] text-xs font-black">{top3[1]?.xp} 🌏 Points</p>
            <div className="w-full bg-[rgba(30,30,30,0.8)] h-16 rounded-t-2xl mt-2 border-t border-white/10 flex items-center justify-center">
              <span className="text-white/40 font-black text-2xl">2</span>
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center flex-1 relative z-10">
            <div className="relative mb-2">
              <div className="absolute -top-4 -right-2 transform rotate-12">
                <Trophy className="w-6 h-6 text-yellow-400 fill-current drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
              </div>
              <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center text-3xl border-2 border-[#ff4d6d] shadow-[0_0_20px_rgba(255,77,109,0.3)]">🥇</div>
            </div>
            <p className="text-base font-bold text-white truncate max-w-[90px]">{top3[0]?.name}</p>
            <p className="text-[#ff4d6d] text-sm font-black">{top3[0]?.xp} 🌏 Points</p>
            <div className="w-full bg-[rgba(40,40,40,0.9)] h-24 rounded-t-2xl mt-2 border-t border-[#ff4d6d]/30 flex items-center justify-center shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
              <span className="text-[#ff4d6d] font-black text-4xl">1</span>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center flex-1">
            <div className="relative mb-2">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-2xl border border-white/20">🥉</div>
            </div>
            <p className="text-sm font-bold text-white truncate max-w-[80px]">{top3[2]?.name}</p>
            <p className="text-[#ff4d6d] text-xs font-black">{top3[2]?.xp} 🌏 Points</p>
            <div className="w-full bg-[rgba(20,20,20,0.8)] h-12 rounded-t-2xl mt-2 border-t border-white/5 flex items-center justify-center">
              <span className="text-white/30 font-black text-xl">3</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* List for the rest or if less than 3 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-panel rounded-3xl overflow-hidden border border-white/5 bg-[rgba(20,20,20,0.85)]"
      >
        {leaders.map((user, index) => {
          // If we have >= 3 users, skip the first 3 for the list, unless it's just 1 or 2 users total
          if (leaders.length >= 3 && index < 3) return null;
          
          const rank = index + 1;
          const isCurrentUser = user.name === currentUser;
          
          return (
            <div 
              key={user.id}
              className={cn(
                "flex items-center justify-between p-4 border-b border-white/5 last:border-0",
                isCurrentUser && "bg-white/5"
              )}
            >
              <div className="flex items-center space-x-4">
                <span className="text-text-secondary font-black w-4 text-center">{rank}</span>
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-xl">👤</div>
                <span className={cn("font-bold", isCurrentUser ? "text-[#ff4d6d]" : "text-white")}>
                  {user.name} {isCurrentUser && "(You)"}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="font-black text-white">{user.xp} <span className="text-[10px] text-text-secondary uppercase">🌏 Points</span></span>
                {rank < 4 ? <TrendingUp className="text-[#ff4d6d] w-4 h-4" /> : rank > 7 ? <TrendingDown className="text-text-secondary w-4 h-4" /> : <Minus className="text-white/30 w-4 h-4" />}
              </div>
            </div>
          );
        })}
        {leaders.length === 0 && (
          <div className="p-8 text-center text-text-secondary">
            No reports yet. Be the first to earn 🌏 Points!
          </div>
        )}
      </motion.div>
    </div>
  );
}
