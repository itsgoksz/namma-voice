"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';

// Deterministic pseudo-random number generator
const random = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const ProgressionTree = ({ level, xp, nextLevelXp }: { level: number, xp: number, nextLevelXp: number }) => {
  const isMaxLevel = level >= 100;
  
  // Growth factors (0.0 to 1.0)
  const growth = Math.min(level, 100) / 100;
  
  // Procedural Dimensions
  // Soil
  const soilWidth = 80 + (growth * 120);
  const soilHeight = 20 + (growth * 20);
  
  // Trunk
  const treeHeight = 20 + (growth * 220); 
  const trunkBaseWidth = 4 + (growth * 36);
  const trunkTopWidth = 2 + (growth * 16);
  
  // Canopy (Leaves)
  const canopyRadiusX = 20 + (growth * 120);
  const canopyRadiusY = 15 + (growth * 90);
  const canopyCenterY = 340 - treeHeight;

  // Determine stage names and colors
  let stageName = "";
  let glowColor = "";
  let leafColors = ['#22c55e', '#16a34a', '#15803d', '#4ade80'];
  let textColor = "text-[#4ade80]";

  if (level < 10) {
    stageName = "The Seed";
    glowColor = "rgba(163,230,53,0.2)";
    leafColors = ['#84cc16', '#a3e635'];
    textColor = "text-[#a3e635]";
  } else if (level < 30) {
    stageName = "The Sprout";
    glowColor = "rgba(74,222,128,0.3)";
    textColor = "text-[#4ade80]";
  } else if (level < 60) {
    stageName = "The Sapling";
    glowColor = "rgba(34,197,94,0.4)";
    textColor = "text-[#22c55e]";
  } else if (level < 90) {
    stageName = "Young Tree";
    glowColor = "rgba(21,128,61,0.5)";
    textColor = "text-[#16a34a]";
  } else if (level < 100) {
    stageName = "Mature Tree";
    glowColor = "rgba(21,128,61,0.6)";
    textColor = "text-[#15803d]";
  } else {
    stageName = "Blooming Tree";
    glowColor = "rgba(236,72,153,0.6)";
    leafColors = ['#f472b6', '#ec4899', '#db2777', '#fbcfe8', '#f9a8d4']; // Pink blossoms
    textColor = "text-[#ec4899]";
  }

  // Generate deterministic leaves
  const leaves = useMemo(() => {
    const items = [];
    // Increase number of leaf clusters significantly as it grows
    const numLeaves = Math.floor(10 + (growth * 150)); 
    
    for (let i = 0; i < numLeaves; i++) {
      const r1 = random(level * 100 + i);
      const r2 = random(level * 200 + i);
      const r3 = random(level * 300 + i);
      
      const angle = r1 * Math.PI * 2;
      // Bias towards the center of the canopy for density
      const radiusDist = Math.sqrt(r2); 
      
      let cx = 200 + Math.cos(angle) * (canopyRadiusX * radiusDist);
      let cy = canopyCenterY + Math.sin(angle) * (canopyRadiusY * radiusDist);
      
      const size = (5 + (r3 * 18 * (0.5 + growth / 2))) * (1.2 - radiusDist * 0.4);
      const color = leafColors[Math.floor(random(level * 400 + i) * leafColors.length)];
      
      // If max level, make some petals fall
      const isFalling = isMaxLevel && r1 > 0.85;
      if (isFalling) {
        cy += r2 * 250; // fall down to the ground
      }
      
      items.push({ id: i, cx, cy, size: isFalling ? size * 0.6 : size, color, isFalling });
    }
    return items;
  }, [level, growth, canopyRadiusX, canopyRadiusY, canopyCenterY, leafColors, isMaxLevel]);

  // Generate branches
  const branches = useMemo(() => {
    const items = [];
    if (level > 15) {
      const numBranches = Math.floor(growth * 12);
      for (let i = 0; i < numBranches; i++) {
        const r1 = random(level * 500 + i);
        const r2 = random(level * 600 + i);
        
        const startY = 340 - (treeHeight * (0.3 + r1 * 0.5));
        const length = 20 + (r2 * treeHeight * 0.5);
        const angle = (r1 > 0.5 ? 1 : -1) * (0.5 + r2 * 0.5); // Radians branching outwards
        
        const endX = 200 + Math.sin(angle) * length;
        const endY = startY - Math.cos(angle) * length;
        const branchWidth = Math.max(1, trunkTopWidth * 0.6 * (1 - r1*0.3));
        
        items.push({ id: i, startY, endX, endY, branchWidth });
      }
    }
    return items;
  }, [level, growth, treeHeight, trunkTopWidth]);

  // Root generation
  const roots = useMemo(() => {
    const items = [];
    if (level > 5) {
      const numRoots = Math.floor(3 + growth * 8);
      for (let i = 0; i < numRoots; i++) {
        const r1 = random(level * 700 + i);
        const r2 = random(level * 800 + i);
        
        const length = 10 + (r2 * soilWidth * 0.4);
        const angle = (Math.PI / 2) + (r1 > 0.5 ? 1 : -1) * (0.2 + r2 * 1.2); // pointing down and out
        
        const endX = 200 + Math.cos(angle) * length;
        const endY = 335 + Math.sin(angle) * length * 0.5;
        const rootWidth = Math.max(1, trunkBaseWidth * 0.3 * (1 - r2));
        
        items.push({ id: i, endX, endY, rootWidth });
      }
    }
    return items;
  }, [level, growth, soilWidth, trunkBaseWidth]);


  const prevLevelXp = (level - 1) * 50;
  const currentLevelProgress = xp - prevLevelXp;
  const xpNeededForLevel = 50;
  const progressPercent = Math.min(100, Math.max(0, (currentLevelProgress / xpNeededForLevel) * 100));

  return (
    <div className="flex flex-col items-center justify-center p-2 w-full h-full relative overflow-hidden">
      
      {/* Background Ambient Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full blur-[80px] pointer-events-none transition-colors duration-1000 z-0"
        style={{ backgroundColor: glowColor }}
      />
      
      {/* Container for Tree SVG */}
      <div className="relative w-full aspect-square max-w-[320px] mx-auto z-10 flex items-end justify-center mb-6">
        
        <svg viewBox="0 0 400 400" className="w-full h-full overflow-visible">
          <defs>
            <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#5a3825" />
              <stop offset="50%" stopColor="#784f33" />
              <stop offset="100%" stopColor="#4a2e1d" />
            </linearGradient>
            
            <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f2e24" />
              <stop offset="100%" stopColor="#291e17" />
            </linearGradient>
          </defs>

          <g>
            {/* Roots */}
            {roots.map(root => (
              <path 
                key={`root-${root.id}`}
                d={`M 200 335 Q ${200 + (root.endX - 200)*0.5} 335 ${root.endX} ${root.endY}`}
                fill="none"
                stroke="url(#trunkGrad)"
                strokeWidth={root.rootWidth}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-in-out"
              />
            ))}

            {/* Soil Mound */}
            <ellipse 
              cx="200" 
              cy="340" 
              rx={soilWidth / 2} 
              ry={soilHeight} 
              fill="url(#soilGrad)" 
              className="transition-all duration-1000 ease-in-out"
            />
            
            {/* Trunk */}
            {level >= 3 && (
              <path 
                d={`M ${200 - trunkBaseWidth/2} 340 
                   Q 195 ${340 - treeHeight/2} ${200 - trunkTopWidth/2} ${340 - treeHeight} 
                   L ${200 + trunkTopWidth/2} ${340 - treeHeight} 
                   Q 205 ${340 - treeHeight/2} ${200 + trunkBaseWidth/2} 340 Z`}
                fill="url(#trunkGrad)"
                className="transition-all duration-1000 ease-in-out"
              />
            )}
            
            {/* Seed stage tiny trunk */}
            {level < 3 && (
               <path 
                d={`M 198 340 L 200 ${340 - treeHeight} L 202 340 Z`}
                fill="#84cc16"
                className="transition-all duration-1000 ease-in-out"
               />
            )}

            {/* Branches */}
            {branches.map(branch => (
               <path 
                key={`branch-${branch.id}`}
                d={`M 200 ${branch.startY} Q ${200 + (branch.endX - 200)*0.5} ${branch.startY} ${branch.endX} ${branch.endY}`}
                fill="none"
                stroke="url(#trunkGrad)"
                strokeWidth={branch.branchWidth}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-in-out"
               />
            ))}

            {/* Leaves / Canopy */}
            {leaves.map(leaf => (
              <motion.circle 
                key={`leaf-${leaf.id}`}
                initial={leaf.isFalling ? { y: -20, opacity: 0 } : { scale: 0 }}
                animate={leaf.isFalling ? { 
                  y: [0, Math.random() * 20 + 20], 
                  opacity: [0, 1, 0],
                  x: [0, (Math.random() - 0.5) * 30] 
                } : { scale: 1 }}
                transition={leaf.isFalling ? {
                  duration: 2 + Math.random() * 2,
                  repeat: Infinity,
                  delay: Math.random() * 5
                } : {
                  type: "spring",
                  stiffness: 100,
                  damping: 10,
                  delay: (leaf.id % 20) * 0.05 // stagger effect
                }}
                cx={leaf.cx}
                cy={leaf.cy}
                r={leaf.size}
                fill={leaf.color}
                opacity={0.9}
                className="transition-all duration-1000 ease-in-out"
              />
            ))}
          </g>
        </svg>

        {/* Circular Progress (Hidden if max level) Overlaying the Tree slightly */}
        {!isMaxLevel && (
          <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-16 h-16">
            <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full drop-shadow-xl">
              <circle cx="50" cy="50" r="45" fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
              <motion.circle 
                cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="6" 
                strokeDasharray="283"
                strokeDashoffset={283 - (283 * progressPercent) / 100}
                className={textColor}
                strokeLinecap="round"
                initial={{ strokeDashoffset: 283 }}
                animate={{ strokeDashoffset: 283 - (283 * progressPercent) / 100 }}
                transition={{ duration: 1.5, ease: "easeOut" }}
              />
              <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="24" fontWeight="bold">
                {level}
              </text>
            </svg>
          </div>
        )}
      </div>

      <div className="text-center relative z-20">
        <h3 className={`text-2xl font-black ${textColor} uppercase tracking-widest drop-shadow-md`}>{stageName}</h3>
        {isMaxLevel ? (
          <p className="text-sm text-white font-bold mt-2 bg-[#ec4899]/20 border border-[#ec4899]/50 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(236,72,153,0.3)]">
            🌸 A real tree has been planted in your name!
          </p>
        ) : (
          <p className="text-xs text-white/70 font-semibold mt-1 uppercase tracking-wider">
            {50 - currentLevelProgress} XP to Level {level + 1}
          </p>
        )}
      </div>
    </div>
  );
}
