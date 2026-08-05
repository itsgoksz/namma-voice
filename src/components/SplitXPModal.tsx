import { motion, AnimatePresence } from "framer-motion";
import { Target, Users } from "lucide-react";
import { cn } from "@/lib/utils";

interface SplitXPModalProps {
  isOpen: boolean;
  onClose: () => void;
  splitModalData: { id: number; severity: string; imageUrl?: string | null } | null;
  splitStep: number;
  setSplitStep: (step: 1 | 2 | number) => void;
  isSplitting: boolean;
  splitCount: number;
  setSplitCount: (count: number) => void;
  splitUsernames: string[];
  setSplitUsernames: (usernames: string[]) => void;
  splitError: string;
  setSplitError: (err: string) => void;
  handleSplitSubmit: (isSolo: boolean) => void;
  getSeverityXP: (severity: string) => number;
}

export default function SplitXPModal({
  isOpen,
  onClose,
  splitModalData,
  splitStep,
  setSplitStep,
  isSplitting,
  splitCount,
  setSplitCount,
  splitUsernames,
  setSplitUsernames,
  splitError,
  setSplitError,
  handleSplitSubmit,
  getSeverityXP
}: SplitXPModalProps) {
  return (
    <AnimatePresence>
      {isOpen && splitModalData && (
        <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/90 backdrop-blur-sm"
            onClick={() => {}} // Block outside click
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-sm glass-panel rounded-3xl p-6 flex flex-col items-center z-10 border border-[#d4af37]/40 bg-[#111] shadow-[0_0_60px_rgba(212,175,55,0.2)]"
          >
            <div className="w-16 h-16 bg-[#d4af37]/10 rounded-full flex items-center justify-center border-2 border-[#d4af37] mb-4 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
              <Target className="w-8 h-8 text-[#d4af37]" />
            </div>
            <h2 className="text-2xl font-black text-white text-center mb-2">Threat Neutralised!</h2>
            <p className="text-zinc-400 text-center text-sm mb-6 font-semibold">
              You eliminated a <span className={splitModalData.severity.includes('critical') ? "text-[#ff4d6d]" : "text-[#ff7f50]"}>{splitModalData.severity.toUpperCase()}</span> hazard. 
              <br/><span className="text-[#d4af37] text-lg font-black mt-2 inline-block">Up to {getSeverityXP(splitModalData.severity) * (splitModalData.severity.includes('critical') ? 2 : 1)} XP</span> Available upon verification!
            </p>

            {splitStep === 1 ? (
              <div className="w-full flex flex-col space-y-3">
                <button 
                  onClick={() => handleSplitSubmit(true)}
                  disabled={isSplitting}
                  className="w-full py-4 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold transition-all shadow-md"
                >
                  Submit Solo Claim
                </button>
                <button 
                  onClick={() => setSplitStep(2)}
                  disabled={isSplitting}
                  className="w-full py-4 rounded-xl bg-[#d4af37] hover:bg-[#d4af37]/90 text-black font-black transition-all shadow-[0_0_20px_rgba(212,175,55,0.4)] flex items-center justify-center space-x-2"
                >
                  <Users className="w-5 h-5" />
                  <span>Split with Squad</span>
                </button>
              </div>
            ) : (
              <div className="w-full flex flex-col space-y-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs text-zinc-400 font-bold uppercase tracking-wider">How many others?</label>
                  <div className="flex bg-white/10 rounded-lg p-1">
                    {[1, 2, 3, 4].map(num => (
                      <button
                        key={num}
                        onClick={() => {
                          setSplitCount(num);
                          setSplitUsernames(Array(num).fill(''));
                          setSplitError("");
                        }}
                        className={cn("w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold transition-colors", splitCount === num ? "bg-[#d4af37] text-black" : "text-zinc-400 hover:text-white")}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {Array.from({ length: splitCount }).map((_, i) => (
                    <input 
                      key={i}
                      type="text" 
                      placeholder={`Squad member ${i + 1} username`}
                      value={splitUsernames[i] || ""}
                      onChange={(e) => {
                        const newNames = [...splitUsernames];
                        newNames[i] = e.target.value.toLowerCase();
                        setSplitUsernames(newNames);
                        setSplitError("");
                      }}
                      className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white focus:outline-none focus:border-[#d4af37]"
                    />
                  ))}
                </div>

                {splitError && (
                  <div className="bg-[#ff4d6d]/10 border border-[#ff4d6d]/30 text-[#ff4d6d] p-3 rounded-lg text-xs font-semibold text-center">
                    {splitError}
                  </div>
                )}
                
                <div className="flex justify-between items-center bg-[#d4af37]/10 p-3 rounded-xl border border-[#d4af37]/20">
                  <span className="text-zinc-400 text-xs font-bold">XP Per Person:</span>
                  <span className="text-[#d4af37] font-black">{Math.floor(getSeverityXP(splitModalData.severity) / (splitCount + 1))} XP</span>
                </div>

                <div className="flex space-x-3 mt-2">
                  <button 
                    onClick={() => { setSplitStep(1); setSplitError(""); }}
                    disabled={isSplitting}
                    className="flex-1 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white font-bold transition-colors"
                  >
                    Back
                  </button>
                  <button 
                    onClick={() => handleSplitSubmit(false)}
                    disabled={isSplitting || splitUsernames.some(u => !u.trim())}
                    className="flex-[2] py-3 rounded-xl bg-[#d4af37] hover:bg-[#d4af37]/90 text-black font-black transition-colors disabled:opacity-50"
                  >
                    {isSplitting ? 'Verifying...' : 'Distribute XP'}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
