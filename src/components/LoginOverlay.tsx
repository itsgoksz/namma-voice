"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Leaf } from "lucide-react";
import { apiFetch } from "@/lib/api";

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
        await apiFetch('/login', {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: name.trim() })
        });
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
          className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center p-6"
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
            <div className="bg-[#ff4d6d]/10 p-5 rounded-full border border-[#ff4d6d]/20 mb-4 shadow-[0_0_30px_rgba(255,77,109,0.2)]">
              <Leaf className="w-12 h-12 text-[#ff4d6d]" />
            </div>
            
            <div className="space-y-2">
              <h1 className="text-4xl font-black text-white tracking-tight">Namma Voice</h1>
              <p className="text-text-secondary font-medium">Keep your streets clean. Earn XP.</p>
            </div>

            <form onSubmit={handleLogin} className="w-full space-y-4 mt-8">
              <div className="relative">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-6 py-4 text-white placeholder:text-white/30 focus:outline-none focus:border-[#ff4d6d] focus:bg-white/10 transition-all font-bold text-center text-lg"
                  required
                />
              </div>
              
              <motion.button
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#ff4d6d] text-white font-black py-4 rounded-2xl shadow-[0_0_20px_rgba(255,77,109,0.4)] flex items-center justify-center space-x-2 text-lg disabled:opacity-50"
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
