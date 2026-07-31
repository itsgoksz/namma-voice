import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Award, Flame, Leaf, MapPin, Trophy } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface PublicProfileModalProps {
  username: string;
  onClose: () => void;
}

export default function PublicProfileModal({ username, onClose }: PublicProfileModalProps) {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [reportsCount, setReportsCount] = useState(0);
  const [cleanupsCount, setCleanupsCount] = useState(0);
  const [streak, setStreak] = useState(0);
  useEffect(() => {
    // Lock body scroll
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase.from('users').select('name, xp, level').eq('name', username).single();
        if (!error && data) {
          setUser(data);
          
          // Dynamically calculate stats
          const { data: allReports } = await supabase.from('reports').select('id, username, cleanup_squad');
          if (allReports) {
             const myReports = allReports.filter((r: any) => r.username && typeof r.username === 'string' && r.username.toLowerCase() === username.toLowerCase());
             const myCleanups = allReports.filter((r: any) => r.cleanup_squad && Array.isArray(r.cleanup_squad) && r.cleanup_squad.some((s: string) => s && typeof s === 'string' && s.toLowerCase() === username.toLowerCase()));
             setReportsCount(myReports.length);
             setCleanupsCount(myCleanups.length);
          }
          
          // No streaks table yet, default to 0
          setStreak(0);
        }
      } catch (e) {
        console.error("Failed to fetch public user", e);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, [username]);

  if (!username) return null;

  const nextLevelXp = user ? user.level * 50 : 50;
  const progress = user ? (user.xp / nextLevelXp) * 100 : 0;

  const badges = [
    { name: "Explorer", icon: "🗺️", unlocked: reportsCount >= 1, req: "Make your first report." },
    { name: "Reporter", icon: "📸", unlocked: reportsCount >= 5, req: "Submit 5 total reports." },
    { name: "Neighbour Hero", icon: "🦸", unlocked: reportsCount >= 10, req: "Submit 10 total reports." },
    { name: "Guardian", icon: "🛡️", unlocked: user?.level >= 3, req: "Reach Level 3." },
    { name: "Community Champion", icon: "🏆", unlocked: user?.level >= 5, req: "Reach Level 5." },
    { name: "City Ranger", icon: "🤠", unlocked: user?.level >= 10, req: "Reach Level 10." },
    { name: "Earth Keeper", icon: "🌍", unlocked: user?.level >= 15, req: "Reach Level 15." },
    { name: "Legend", icon: "👑", unlocked: user?.level >= 20, req: "Reach Level 20." },
  ];

  return (
    <>
      <div 
        className="fixed inset-0 z-[99999] flex items-center justify-center p-4 overscroll-none touch-none"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
        />
        <motion.div
          layout
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          transition={{ layout: { duration: 0.3, type: "spring", bounce: 0.2 } }}
          className="relative w-[92vw] max-w-[350px] max-h-[90vh] h-fit overflow-y-auto glass-panel rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center bg-[#050505] hide-scrollbar overscroll-contain"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {/* Close button */}
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 bg-white/10 hover:bg-white/20 rounded-full p-2 text-white/80 transition-colors z-10"
          >
            <X className="w-5 h-5" />
          </button>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#10b981] mb-4"></div>
              <p className="text-zinc-400 font-bold">Loading Profile...</p>
            </div>
          ) : !user ? (
            <div className="p-12 text-center text-zinc-400 font-bold">
              User not found.
            </div>
          ) : (
            <div className="w-full flex flex-col p-6 space-y-6 mt-4">
              
              {/* Header */}
              <div className="flex flex-col items-center text-center w-full mt-2">
                <div className="w-20 h-20 rounded-full bg-[#10b981]/10 border-2 border-[#10b981]/30 flex items-center justify-center text-4xl mb-3 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                  👤
                </div>
                <h2 className="text-xl font-black text-white w-full truncate px-4">{user.name}</h2>
              </div>

              {/* Level & XP */}
              <div className="w-full bg-[#10b981]/10 border border-[#10b981]/20 rounded-2xl p-4 shadow-inner relative overflow-hidden">
                <div className="flex justify-between items-center mb-2 z-10 relative">
                  <div>
                    <span className="text-xs font-bold text-[#10b981] uppercase tracking-wider">Level {user.level}</span>
                    <h4 className="text-lg font-black text-white">{user.xp} <span className="text-xs text-zinc-400">/ {nextLevelXp} XP</span></h4>
                  </div>
                  {user.level >= 5 && <Trophy className="w-6 h-6 text-yellow-400" />}
                </div>
                <div className="w-full bg-[#050505] rounded-full h-3 mb-1 overflow-hidden border border-[#10b981]/30 z-10 relative">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: "easeOut" }}
                    className="bg-gradient-to-r from-[#10b981] to-[#34d399] h-3 rounded-full shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                  />
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3 w-full">
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <Flame className="w-6 h-6 text-[#ff9f1c] mb-2" />
                  <span className="text-2xl font-black text-white">{streak}</span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 text-center">Day Streak</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center">
                  <Award className="w-6 h-6 text-[#3a86ff] mb-2" />
                  <span className="text-2xl font-black text-white">{reportsCount}</span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 text-center">Total Reports</span>
                </div>
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col items-center justify-center col-span-2">
                  <Leaf className="w-6 h-6 text-[#10b981] mb-2" />
                  <span className="text-2xl font-black text-white">{cleanupsCount}</span>
                  <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1 text-center">Total Cleanups</span>
                </div>
              </div>

              {/* Badges Grid */}
              <div className="w-full">
                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider mb-3">Earned Badges</h3>
                <div className="grid grid-cols-4 gap-2">
                  {badges.filter(b => b.unlocked).map((badge, idx) => (
                    <div 
                      key={idx}
                      className="flex flex-col items-center justify-center p-2 rounded-xl transition-all aspect-square bg-[#10b981]/10 border border-[#10b981]/30 opacity-100"
                    >
                      <span className="text-2xl filter drop-shadow-md">{badge.icon}</span>
                    </div>
                  ))}
                  {badges.filter(b => b.unlocked).length === 0 && (
                    <div className="col-span-4 text-center text-xs text-zinc-500 italic py-4">
                      No badges earned yet.
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </motion.div>
      </div>
      <style dangerouslySetInnerHTML={{ __html: `
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
      ` }} />
    </>
  );
}
