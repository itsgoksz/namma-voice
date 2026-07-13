"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Leaf, Lock, User, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { getFastLocation } from "@/lib/location";
import { hasProfanity, validatePassword } from "@/lib/utils";

export default function LoginOverlay() {
  const [isOpen, setIsOpen] = useState(true);
  const [isLoginMode, setIsLoginMode] = useState(false); // Default to signup
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [isMounted, setIsMounted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    setIsMounted(true);
    // Check if user is already logged in (Supabase session exists)
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsOpen(false);
        // Sync local storage just in case
        if (session.user.email) {
            localStorage.setItem("namma_user", session.user.email.split('@')[0]);
        }
      }
    };
    checkSession();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    const trimmedName = name.trim();
    
    if (trimmedName.length <= 2) {
      setErrorMsg("Username must be at least 3 characters long.");
      return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(trimmedName)) {
      setErrorMsg("Username can only contain letters, numbers, and underscores.");
      return;
    }
    
    if (hasProfanity(trimmedName)) {
      setErrorMsg("Please choose an appropriate username.");
      return;
    }

    const dummyEmail = `${trimmedName.toLowerCase()}@example.com`;

    setIsLoading(true);

    try {
      if (isLoginMode) {
        // Handle Login
        const { error } = await supabase.auth.signInWithPassword({
          email: dummyEmail,
          password: password
        });
        
        if (error) {
          setErrorMsg("Invalid username or password.");
          setIsLoading(false);
          return;
        }
        
        // Ensure legacy localStorage is synced
        localStorage.setItem("namma_user", trimmedName);
        setIsOpen(false);
        
      } else {
        // Handle Sign Up
        const passValidation = validatePassword(password);
        if (!passValidation.valid) {
          setErrorMsg(passValidation.message);
          setIsLoading(false);
          return;
        }

        // Check if username is already taken in the public users table
        const { data: existingUser } = await supabase.from('users').select('name').ilike('name', trimmedName).maybeSingle();
        if (existingUser) {
          setErrorMsg("This username is already taken.");
          setIsLoading(false);
          return;
        }

        // Attempt signup
        const { error: signUpError } = await supabase.auth.signUp({
          email: dummyEmail,
          password: password
        });

        if (signUpError) {
          const sanitizedMsg = signUpError.message.includes('Email') 
            ? "Could not create account with this username. Please try another."
            : signUpError.message;
          setErrorMsg(sanitizedMsg);
          setIsLoading(false);
          return;
        }

        // Create initial profile
        let loc = { lat: 0, lng: 0 };
        try {
          loc = await getFastLocation();
        } catch (e) {
          console.log("Could not get location for login");
        }

        let area = "Unknown";
        if (loc.lat >= 12.92 && loc.lat <= 12.94 && loc.lng >= 77.57 && loc.lng <= 77.60) area = "Jayanagar";
        else if (loc.lat >= 12.90 && loc.lat <= 12.92 && loc.lng >= 77.57 && loc.lng <= 77.60) area = "JP Nagar";
        else if (loc.lat >= 12.90 && loc.lat <= 12.92 && loc.lng >= 77.60 && loc.lng <= 77.62) area = "BTM Layout";

        await supabase.from('users').insert([{ name: trimmedName, area }]);

        localStorage.setItem("namma_user", trimmedName);
        setIsOpen(false);
      }
    } catch (e) {
      console.error("Auth failed", e);
      setErrorMsg("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
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
          className="fixed inset-0 z-[10000] bg-[#000000] flex flex-col items-center justify-center p-6 overflow-y-auto"
        >
          {/* Background Stars */}
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
            className="z-10 w-full max-w-sm flex flex-col items-center text-center space-y-6 bg-black/60 backdrop-blur-md p-8 rounded-3xl border border-[#10b981]/20 my-auto"
          >
            <div className="bg-[#10b981]/5 p-4 rounded-full border border-[#10b981]/20 shadow-none">
              <Leaf className="w-10 h-10 text-[#10b981]" />
            </div>
            
            <div className="space-y-1">
              <h1 className="text-3xl font-black text-white tracking-tight">{isLoginMode ? "Welcome Back" : "Join Namma Hood"}</h1>
              <p className="text-[#10b981] font-bold tracking-widest text-xs uppercase mt-1">
                {isLoginMode ? "Log in to continue" : "Create your account"}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="w-full space-y-4 mt-4">
              <div className="space-y-3">
                <div className="relative flex items-center">
                  <User className="absolute left-4 w-5 h-5 text-zinc-400" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Username"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#10b981]/40 focus:bg-white/10 transition-all font-bold text-lg"
                    required
                  />
                </div>
                
                <div className="relative flex items-center">
                  <Lock className="absolute left-4 w-5 h-5 text-zinc-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder:text-zinc-500 focus:outline-none focus:border-[#10b981]/40 focus:bg-white/10 transition-all font-bold text-lg"
                    required
                  />
                </div>
              </div>

              <AnimatePresence>
                {errorMsg && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-semibold p-3 rounded-xl flex items-start space-x-2 text-left"
                  >
                    <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
                    <span>{errorMsg}</span>
                  </motion.div>
                )}
              </AnimatePresence>
              
              {!isLoginMode && (
                <p className="text-zinc-400 text-xs font-semibold px-2 text-left">
                  Note: This username will be used publicly on your profile and leaderboards.
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.95 }}
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#10b981] hover:bg-[#10b981]/80 text-black font-black py-4 rounded-2xl flex items-center justify-center space-x-2 text-lg disabled:opacity-50 transition-colors duration-300 shadow-[0_0_20px_rgba(16,185,129,0.3)] mt-2"
              >
                {isLoading ? (
                  <div className="w-6 h-6 border-4 border-black/20 border-t-black rounded-full animate-spin" />
                ) : (
                  <>
                    <span>{isLoginMode ? "Log In" : "Sign Up"}</span>
                    <ArrowRight className="w-5 h-5" strokeWidth={3} />
                  </>
                )}
              </motion.button>
            </form>

            <div className="pt-2 w-full border-t border-white/10">
              <button 
                type="button"
                onClick={() => {
                  setIsLoginMode(!isLoginMode);
                  setErrorMsg("");
                }}
                className="text-sm text-zinc-400 hover:text-white transition-colors font-bold"
              >
                {isLoginMode ? "Don't have an account? Sign up" : "Already have an account? Log in"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
