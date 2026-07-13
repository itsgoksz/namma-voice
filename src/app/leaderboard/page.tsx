"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus, MapPin, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/api";
import { supabase } from "@/lib/supabase";

interface User {
  id: number;
  name: string;
  xp: number;
  level: number;
  reports_count: number;
}

export default function LeaderboardPage() {
  const [leaders, setLeaders] = useState<User[]>([]);
  const [areaStats, setAreaStats] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<"users" | "areas">("users");
  const currentUser = getCurrentUser();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [{ data: leadersData }, { data: reportsData }] = await Promise.all([
          supabase.from('users').select('*').order('xp', { ascending: false }).limit(50),
          supabase.from('reports').select('lat, lng, status')
        ]);
        
        if (leadersData) setLeaders(leadersData);
        if (reportsData) {
          const stats: Record<string, any> = {
            "Jayanagar": { area: "Jayanagar", reports: 0, cleanups: 0 },
            "JP Nagar": { area: "JP Nagar", reports: 0, cleanups: 0 },
            "BTM Layout": { area: "BTM Layout", reports: 0, cleanups: 0 },
            "Unknown": { area: "Unknown", reports: 0, cleanups: 0 }
          };
          reportsData.forEach(r => {
            let area = "Unknown";
            if (r.lat >= 12.92 && r.lat <= 12.94 && r.lng >= 77.57 && r.lng <= 77.60) area = "Jayanagar";
            else if (r.lat >= 12.90 && r.lat <= 12.92 && r.lng >= 77.57 && r.lng <= 77.60) area = "JP Nagar";
            else if (r.lat >= 12.90 && r.lat <= 12.92 && r.lng >= 77.60 && r.lng <= 77.62) area = "BTM Layout";
            
            stats[area].reports += 1;
            if (r.status === "CLEANED") stats[area].cleanups += 1;
          });
          setAreaStats(Object.values(stats));
        }
      } catch (e) {
        console.error("Failed to fetch leaderboard data", e);
      }
    };
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, []);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  return (
    <div className="p-4 space-y-6 h-full overflow-hidden flex flex-col pt-8 pb-32 max-w-md mx-auto relative z-10">
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1"
      >
        <h1 className="text-4xl font-bold text-white tracking-tight">Leaderboard</h1>
      </motion.div>

      <div className="flex space-x-2 w-full mt-2">
        <button 
          onClick={() => setActiveTab('users')} 
          className={cn("flex-1 py-2.5 rounded-2xl font-bold text-sm transition-all", activeTab === 'users' ? 'bg-[#10b981] text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-zinc-400')}
        >
          Top Users
        </button>
        <button 
          onClick={() => setActiveTab('areas')} 
          className={cn("flex-1 py-2.5 rounded-2xl font-bold text-sm transition-all", activeTab === 'areas' ? 'bg-[#10b981] text-black shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'bg-white/5 text-zinc-400')}
        >
          Area Standings
        </button>
      </div>

      {activeTab === 'users' ? (
        <>
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
              <div className="w-12 h-12 bg-[#10b981]/5 rounded-full flex items-center justify-center text-2xl border border-[#10b981]/20">🥈</div>
            </div>
            <p className="text-sm font-bold text-white truncate max-w-[80px]">{top3[1]?.name}</p>
            <p className="text-[#d4af37] text-xs font-black">{top3[1]?.xp} Eco XP</p>
            <div className="w-full bg-[rgba(30,30,30,0.8)] h-16 rounded-t-2xl mt-2 border-t border-[#10b981]/20 flex items-center justify-center">
              <span className="text-white/40 font-black text-2xl">2</span>
            </div>
          </div>

          {/* 1st Place */}
          <div className="flex flex-col items-center flex-1 relative z-10">
            <div className="relative mb-2">
              <div className="absolute -top-4 -right-2 transform rotate-12">
                <Trophy className="w-6 h-6 text-yellow-400 fill-current drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
              </div>
              <div className="w-16 h-16 bg-[#10b981]/5 rounded-full flex items-center justify-center text-3xl border-2 border-[#10b981]/20 shadow-none">🥇</div>
            </div>
            <p className="text-base font-bold text-white truncate max-w-[90px]">{top3[0]?.name}</p>
            <p className="text-[#d4af37] text-sm font-black">{top3[0]?.xp} Eco XP</p>
            <div className="w-full bg-[rgba(21,57,57,0.9)] h-24 rounded-t-2xl mt-2 border-t border-[#10b981]/20 flex items-center justify-center shadow-[0_-10px_20px_rgba(0,0,0,0.5)]">
              <span className="text-zinc-400 font-black text-4xl">1</span>
            </div>
          </div>

          {/* 3rd Place */}
          <div className="flex flex-col items-center flex-1">
            <div className="relative mb-2">
              <div className="w-12 h-12 bg-[#10b981]/5 rounded-full flex items-center justify-center text-2xl border border-[#10b981]/20">🥉</div>
            </div>
            <p className="text-sm font-bold text-white truncate max-w-[80px]">{top3[2]?.name}</p>
            <p className="text-[#d4af37] text-xs font-black">{top3[2]?.xp} Eco XP</p>
            <div className="w-full bg-[rgba(20,20,20,0.8)] h-12 rounded-t-2xl mt-2 border-t border-[#10b981]/20 flex items-center justify-center">
              <span className="text-zinc-400 font-black text-xl">3</span>
            </div>
          </div>
        </motion.div>
      )}

      {/* List for the rest or if less than 3 */}
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="glass-panel rounded-3xl overflow-y-auto flex-1 border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] pb-4"
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
                "flex items-center justify-between p-4 border-b border-[#10b981]/20 last:border-0",
                isCurrentUser && "bg-[#10b981]/5"
              )}
            >
              <div className="flex items-center space-x-4">
                <span className="text-zinc-400 font-black w-4 text-center">{rank}</span>
                <div className="w-10 h-10 bg-[#10b981]/5 rounded-full flex items-center justify-center text-xl">👤</div>
                <span className={cn("font-bold", isCurrentUser ? "text-zinc-400" : "text-white")}>
                  {user.name} {isCurrentUser && "(You)"}
                </span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-1.5 bg-[#10b981]/5 px-3 py-1 rounded-full border border-[#10b981]/20">
                  <span className="font-black text-white text-sm">{user.xp}</span>
                  <span className="text-[10px] font-bold text-[#d4af37] uppercase tracking-wider">Eco XP</span>
                </div>
                {rank < 4 ? <TrendingUp className="text-zinc-400 w-4 h-4" /> : rank > 7 ? <TrendingDown className="text-zinc-400 w-4 h-4" /> : <Minus className="text-zinc-400 w-4 h-4" />}
              </div>
            </div>
          );
        })}
        {leaders.length === 0 && (
          <div className="p-8 text-center text-zinc-400">
            No reports yet. Be the first to earn Eco XP!
          </div>
        )}
      </motion.div>
      </>) : (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-panel rounded-3xl overflow-y-auto flex-1 border border-[#10b981]/20 bg-[#10b981]/10 backdrop-blur-2xl shadow-[0_8px_32px_rgba(0,0,0,0.4)] p-4 space-y-4"
        >
          {areaStats.sort((a,b) => b.reports + b.cleanups - (a.reports + a.cleanups)).map((area, index) => (
            <div key={area.area} className="bg-black/40 rounded-2xl p-4 border border-white/5 flex flex-col space-y-3 relative overflow-hidden">
              <div className="flex justify-between items-center z-10">
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{index === 0 ? '👑' : '📍'}</span>
                  <h3 className="text-lg font-bold text-white">{area.area}</h3>
                </div>
                <div className="bg-[#10b981]/20 px-3 py-1 rounded-full border border-[#10b981]/30 text-xs font-bold text-[#10b981]">
                  Rank #{index + 1}
                </div>
              </div>
              <div className="flex space-x-4 z-10">
                <div className="flex flex-col">
                  <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold">Reports</span>
                  <span className="text-xl font-black text-white">{area.reports}</span>
                </div>
                <div className="w-px bg-white/10"></div>
                <div className="flex flex-col">
                  <span className="text-xs text-[#d4af37] uppercase tracking-wider font-bold">Cleanups</span>
                  <span className="text-xl font-black text-[#d4af37]">{area.cleanups}</span>
                </div>
              </div>
              {/* Progress bar background indicator */}
              <div 
                className="absolute left-0 bottom-0 top-0 bg-[#10b981]/5 z-0" 
                style={{ width: `${Math.min(100, (area.reports + area.cleanups) * 5)}%` }} 
              />
            </div>
          ))}
          {areaStats.length === 0 && (
            <div className="text-center text-zinc-500 py-10 text-sm">No areas found. Make a report!</div>
          )}
        </motion.div>
      )}
    </div>
  );
}
