import { motion } from "framer-motion";
import { X, Trophy, MapPin } from "lucide-react";
import { AreaStats } from "@/lib/territories";

interface AreaLeaderboardModalProps {
  area: AreaStats;
  onClose: () => void;
  onUserClick?: (username: string) => void;
  currentUser?: string | null;
}

export default function AreaLeaderboardModal({ area, onClose, onUserClick, currentUser }: AreaLeaderboardModalProps) {
  // Top 10 users for this area
  const top10 = area.leaderboard.slice(0, 10);

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
      />
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 20 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-md bg-zinc-900 border border-[#10b981]/30 shadow-[0_0_50px_rgba(16,185,129,0.15)] rounded-3xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-5 border-b border-white/5 relative bg-[#10b981]/5 shrink-0">
          <button 
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-black/40 hover:bg-black/60 text-white rounded-full transition-colors z-10"
          >
            <X className="w-4 h-4" />
          </button>
          
          <div className="flex items-center space-x-3 mb-2">
            <MapPin className="w-5 h-5 text-[#10b981]" />
            <h2 className="text-xl font-black text-white">{area.area}</h2>
          </div>
          <p className="text-sm font-bold text-zinc-400">Sector Leaderboard (Top 10)</p>
          
          <div className="flex space-x-4 mt-4 overflow-x-auto pb-2 scrollbar-hide">
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-zinc-400 uppercase tracking-wider font-bold whitespace-nowrap">Reports</span>
              <span className="text-lg font-black text-white">{area.reports}</span>
            </div>
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-[#d4af37] uppercase tracking-wider font-bold whitespace-nowrap">Cleanups</span>
              <span className="text-lg font-black text-[#d4af37]">{area.cleanups}</span>
            </div>
            <div className="flex flex-col shrink-0">
              <span className="text-xs text-[#10b981] uppercase tracking-wider font-bold whitespace-nowrap">Area XP</span>
              <span className="text-lg font-black text-[#10b981]">{area.leaderboard?.reduce((acc, curr) => acc + curr.xp, 0) || 0}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {top10.length === 0 ? (
            <div className="py-10 text-center text-zinc-500 font-bold">
              No activity in this area yet.<br/>Be the first to claim it!
            </div>
          ) : (
            top10.map((user, index) => {
              const isCurrentUser = user.username === currentUser;
              const isGuardian = index === 0;
              return (
                <div 
                  key={user.username}
                  onClick={() => onUserClick && onUserClick(user.username)}
                  className={`flex items-center justify-between p-3 rounded-2xl border ${isCurrentUser ? 'bg-[#10b981]/10 border-[#10b981]/30' : 'bg-black/40 border-white/5'} hover:bg-white/5 transition-colors cursor-pointer`}
                >
                  <div className="flex items-center space-x-3">
                    <span className={`font-black w-6 text-center ${isGuardian ? 'text-yellow-400 text-lg' : 'text-zinc-500'}`}>
                      {isGuardian ? '👑' : index + 1}
                    </span>
                    <div className="flex flex-col">
                      <span className={`font-bold ${isCurrentUser ? 'text-white' : 'text-zinc-300'}`}>
                        {user.username} {isCurrentUser && "(You)"}
                      </span>
                      {isGuardian && (
                        <span className="text-[10px] font-black text-[#10b981] uppercase tracking-widest">Sector Guardian</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-1.5 bg-[#10b981]/10 px-2.5 py-1 rounded-full border border-[#10b981]/20">
                    <span className="font-black text-white">{user.xp}</span>
                    <span className="text-[10px] font-bold text-white/70 uppercase tracking-wider">Area XP</span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
}
