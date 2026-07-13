"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Leaf } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getFastLocation } from "@/lib/location";

export default function LoginOverlay() {
  const [isOpen, setIsOpen] = useState(true);
  const [name, setName] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const user = localStorage.getItem("namma_user");
    if (user) {
      setIsOpen(false);
    }
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      setIsLoading(true);
      try {
        let loc = { lat: 0, lng: 0 };
        try {
          loc = await getFastLocation();
        } catch (e) {
          console.log("Could not get location for login");
        }
        
        const { data } = await supabase.from('users').select('*').eq('name', name.trim()).single();
        if (!data) {
          // Simple area estimation
          let area = "Unknown";
          if (loc.lat >= 12.92 && loc.lat <= 12.94 && loc.lng >= 77.57 && loc.lng <= 77.60) area = "Jayanagar";
          else if (loc.lat >= 12.90 && loc.lat <= 12.92 && loc.lng >= 77.57 && loc.lng <= 77.60) area = "JP Nagar";
          else if (loc.lat >= 12.90 && loc.lat <= 12.92 && loc.lng >= 77.60 && loc.lng <= 77.62) area = "BTM Layout";

          await supabase.from('users').insert([{ name: name.trim(), area }]);
        }
        
        localStorage.setItem("namma_user", name.trim());
        setIsOpen(false);
      } catch (e) {
        console.error("Login failed", e);
      } finally {
        setIsLoading(false);
      }
    }
  };

  if (!isMounted) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
          className="fixed inset-0 z-[10000] bg-[#000000] flex flex-col items-center justify-center p-6"
        >
          {/* Background Stars (simple CSS) */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
            {[...Array(50)].map((_, i) => (
              <div
                key={i}
                className="absolute bg-white rounded-full opacity-20"
                style={{
                  width: Math.random() * 3 + 'px',
                  height: Math.random() * 3 + 'px',
                  top: Math.random() * 100 + '%',
                  left: Math.random() * 100 + '%',
                  animation: `twinkle ${Math.random() * 5 + 3}s infinite alternate`
                }}
              />
            ))}
          </div>

          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="z-10 w-full max-w-sm flex flex-col items-center text-center space-y-8"
          >
            <div className="bg-[#10b981]/5 p-5 rounded-full border border-[#10b981]/20 mb-4 shadow-none">
              <Leaf className="w-12 h-12 text-zinc-400" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-white tracking-tight">Namma Hood</h1>
              <p className="text-[#10b981] font-bold tracking-widest text-sm uppercase mt-1">Beta Access</p>
            </div>

            <form onSubmit={handleLogin} className="w-full space-y-4 mt-8">
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-[#10b981]/5 border border-[#10b981]/20 rounded-2xl px-6 py-4 text-white placeholder:text-zinc-400 focus:outline-none focus:border-[#10b981]/20 focus:bg-[#10b981]/5 transition-all font-bold text-center text-lg"
                  required
                />
              </div>
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isLoading}
                className="w-full bg-white text-[#10b981] font-black py-4 rounded-2xl shadow-none flex items-center justify-center space-x-2 text-lg disabled:opacity-50"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>Start Exploring</span>
                    <ArrowRight className="w-5 h-5" strokeWidth={3} />
                  </>
                )}
              </motion.button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
