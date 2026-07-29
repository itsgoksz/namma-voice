"use client";

import { motion } from "framer-motion";

export default function Starfield() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10 bg-[#080808]">
      {/* Top Left Emerald Orb */}
      <motion.div
        animate={{
          x: [0, 50, -20, 0],
          y: [0, 30, -50, 0],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute -top-[20%] -left-[20%] w-[500px] h-[500px] md:w-[800px] md:h-[800px] rounded-full"
        style={{ 
          background: 'radial-gradient(circle, rgba(16, 185, 129, 0.15) 0%, rgba(16, 185, 129, 0) 70%)'
        }}
      />
      
      {/* Bottom Right Gold Orb */}
      <motion.div
        animate={{
          x: [0, -60, 30, 0],
          y: [0, -40, 20, 0],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute -bottom-[20%] -right-[20%] w-[600px] h-[600px] md:w-[900px] md:h-[900px] rounded-full"
        style={{ 
          background: 'radial-gradient(circle, rgba(212, 175, 55, 0.12) 0%, rgba(212, 175, 55, 0) 70%)'
        }}
      />

      {/* Center Crimson Orb */}
      <motion.div
        animate={{
          x: [0, 40, -40, 0],
          y: [0, -50, 40, 0],
        }}
        transition={{
          duration: 30,
          repeat: Infinity,
          ease: "linear"
        }}
        className="absolute top-[30%] left-[10%] md:left-[30%] w-[400px] h-[400px] md:w-[700px] md:h-[700px] rounded-full"
        style={{ 
          background: 'radial-gradient(circle, rgba(255, 77, 109, 0.1) 0%, rgba(255, 77, 109, 0) 70%)'
        }}
      />
    </div>
  );
}
