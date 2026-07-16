"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShoppingBag, Star, Zap, Info, MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { getCurrentUser } from "@/lib/api";
import { supabase } from "@/lib/supabase";
import { getEcoCredits, SHOP_ITEMS, purchaseItem, getInventory } from "@/lib/economy";

export default function ShopPage() {
  const [level, setLevel] = useState<number>(1);
  const [balance, setBalance] = useState<number>(0);
  const [inventory, setInventory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [purchaseMsg, setPurchaseMsg] = useState<{text: string, isError: boolean} | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const user = getCurrentUser();
      if (!user) return;
      try {
        const { data } = await supabase.from('users').select('level').eq('name', user).single();
        if (data) {
          setLevel(data.level);
          const credits = getEcoCredits(data.level);
          setBalance(credits.balance);
          setInventory(getInventory());
        }
      } catch (e) {
        console.error("Failed to fetch user level for shop", e);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handlePurchase = (item: any) => {
    if (inventory.includes(item.id)) {
      setPurchaseMsg({ text: "You already own this item!", isError: true });
      setTimeout(() => setPurchaseMsg(null), 3000);
      return;
    }
    
    if (balance < item.price) {
      setPurchaseMsg({ text: "Not enough Eco Credits!", isError: true });
      setTimeout(() => setPurchaseMsg(null), 3000);
      return;
    }

    const success = purchaseItem(level, item);
    if (success) {
      const credits = getEcoCredits(level);
      setBalance(credits.balance);
      setInventory(getInventory());
      setPurchaseMsg({ text: `Successfully purchased ${item.name}!`, isError: false });
      setTimeout(() => setPurchaseMsg(null), 3000);
    }
  };

  return (
    <div className="p-4 space-y-6 h-full overflow-y-auto flex flex-col pt-[calc(env(safe-area-inset-top)+2rem)] pb-[calc(env(safe-area-inset-bottom)+8rem)] max-w-md mx-auto relative z-10">
      
      <AnimatePresence>
        {purchaseMsg && (
          <motion.div 
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-12 left-4 right-4 z-50 flex justify-center"
          >
            <div className={cn(
              "px-6 py-3 rounded-full shadow-2xl backdrop-blur-xl border flex items-center space-x-2",
              purchaseMsg.isError ? "bg-[#ff4d6d]/20 border-[#ff4d6d]/50 text-[#ff4d6d]" : "bg-[#10b981]/20 border-[#10b981]/50 text-[#10b981]"
            )}>
              <span className="font-bold">{purchaseMsg.text}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-start justify-center mt-2 space-y-1"
      >
        <h1 className="text-4xl font-bold text-white tracking-tight">Eco Shop</h1>
        <p className="text-zinc-400 text-sm font-medium">Redeem your hard-earned credits.</p>
      </motion.div>

      {/* Balance Card */}
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.1 }}
        className="glass-panel p-6 rounded-3xl mt-4 border border-[#d4af37]/30 bg-[#d4af37]/10 backdrop-blur-2xl shadow-xl flex justify-between items-center"
      >
        <div>
          <p className="text-xs text-[#d4af37] font-bold uppercase tracking-widest mb-1">Available Balance</p>
          <div className="flex items-center space-x-2">
            <span className="text-4xl font-black text-white">{loading ? '...' : balance}</span>
            <span className="text-xl font-bold text-[#d4af37]">Credits</span>
          </div>
        </div>
        <div className="w-16 h-16 rounded-full bg-[#d4af37]/20 flex items-center justify-center border-2 border-[#d4af37]/50 shadow-[0_0_20px_rgba(212,175,55,0.4)]">
          <ShoppingBag className="w-8 h-8 text-[#d4af37]" />
        </div>
      </motion.div>

      {/* Info Notice */}
      <div className="bg-[#10b981]/5 border border-[#10b981]/20 rounded-2xl p-4 flex items-start space-x-3">
        <Info className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
        <p className="text-xs text-white/70 leading-relaxed font-semibold">
          You earn <span className="text-[#10b981] font-bold">10 Eco Credits</span> every time you Level Up! Keep cleaning to unlock exclusive cosmetics and utility boosters.
        </p>
      </div>

      {/* Shop Items */}
      <div className="space-y-4 pt-4">
        <h2 className="text-xl font-black text-white mb-2">Featured Items</h2>
        {SHOP_ITEMS.map((item, i) => {
          const isOwned = inventory.includes(item.id);
          const canAfford = balance >= item.price;
          
          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + (i * 0.1) }}
              className="glass-panel rounded-3xl overflow-hidden border border-white/10 bg-white/5 backdrop-blur-2xl flex flex-col relative"
            >
              <div className="p-4 flex items-center space-x-4">
                <div className="w-16 h-16 rounded-2xl bg-black/40 flex items-center justify-center text-3xl border border-white/5 shrink-0">
                  {item.icon}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between items-start mb-1">
                    <h3 className="text-white font-bold text-lg leading-tight">{item.name}</h3>
                  </div>
                  <p className="text-xs text-zinc-400 font-medium leading-snug">{item.description}</p>
                </div>
              </div>
              
              <div className="px-4 pb-4 mt-2">
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={isOwned || loading}
                  className={cn(
                    "w-full py-3 rounded-xl font-black flex items-center justify-center space-x-2 transition-all active:scale-95",
                    isOwned 
                      ? "bg-white/5 text-white/40 border border-white/5 cursor-not-allowed"
                      : canAfford
                        ? "bg-[#10b981] text-black shadow-[0_0_15px_rgba(16,185,129,0.3)] hover:bg-[#10b981]/90"
                        : "bg-white/5 text-zinc-500 border border-white/10"
                  )}
                >
                  {isOwned ? (
                    <span>Owned</span>
                  ) : (
                    <>
                      <span>{canAfford ? 'Purchase for' : 'Need'} {item.price} Credits</span>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          );
        })}
      </div>

    </div>
  );
}
