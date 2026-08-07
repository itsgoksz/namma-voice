"use client";

import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { seedPaths } from './GoldenSeed';

const random = (seed: number) => {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
};

export const ProgressionTree = ({ level, xp, nextLevelXp }: { level: number, xp: number, nextLevelXp: number }) => {
  const isMaxLevel = level >= 100;
  
  // LOGARITHMIC PACING: The hook!
  // Instead of linear growth, we use Math.pow to make the early levels progress visually MUCH faster.
  const linearT = Math.max(0, Math.min(level - 1, 99)) / 99; // 0.0 to 1.0
  const t = Math.pow(linearT, 0.6); // Fast early, slow late.

  // Stage Names & Colors
  let stageName = "";
  let textColor = "";
  let glowColor = "";

  if (level <= 5) {
    stageName = "The Golden Seed";
    textColor = "text-[#d4af37]";
    glowColor = "rgba(212,175,55,0.3)";
  } else if (level <= 15) {
    stageName = "Germination";
    textColor = "text-[#84cc16]";
    glowColor = "rgba(163,230,53,0.3)";
  } else if (level <= 30) {
    stageName = "The Seedling";
    textColor = "text-[#22c55e]";
    glowColor = "rgba(34,197,94,0.4)";
  } else if (level <= 60) {
    stageName = "Young Tree";
    textColor = "text-[#eab308]"; 
    glowColor = "rgba(234,179,8,0.4)";
  } else {
    stageName = "Mature Giant";
    textColor = "text-[#16a34a]";
    glowColor = "rgba(21,128,61,0.5)";
  }

  // --- DYNAMIC CAMERA ---
  // Zoomed in massively for Level 1, smoothly zooming out to full 400x480 for Level 100
  const camT = Math.pow(linearT, 0.4); // Camera zooms out even faster to keep the rapid early growth in frame
  const startW = 100;
  const startH = 100;
  const startX = 200 - startW / 2;
  const startY = 335 - startH / 2 + 10;
  
  const endW = 400;
  const endH = 480;
  const endX = 0;
  const endY = 0;

  const vX = startX + (endX - startX) * camT;
  const vY = startY + (endY - startY) * camT;
  const vW = startW + (endW - startW) * camT;
  const vH = startH + (endH - startH) * camT;

  // --- HANDCRAFTED PHASES (Levels 1-30) ---
  const seedScale = level <= 5 ? 0.08 + (level/5)*0.03 : 0.11; // Grows slightly as it charges
  const seedOpacity = level <= 20 ? 1 : Math.max(0, 1 - (level - 20) / 10); // Fades out by lvl 30

  const sproutGrowth = Math.min(1, Math.max(0, (level - 5) / 10)); // 0 to 1 between lvl 5-15
  const seedlingGrowth = Math.min(1, Math.max(0, (level - 15) / 15)); // 0 to 1 between lvl 15-30

  // --- PROCEDURAL GEOMETRY (Levels 31-100) ---
  const soilWidth = 100 + t * 150;
  const soilHeight = 20 + t * 20;

  const roots = useMemo(() => {
    const items: any[] = [];
    if (level < 10) return items; // Roots begin slightly at seedling
    
    const rootT = Math.max(0, (level - 10) / 90);
    const taprootDepth = Math.min(180, rootT * 200);
    const taprootWidth = 2 + rootT * 15;
    
    items.push({ id: 'tap', path: `M 200 335 Q 195 ${335 + taprootDepth/2} 200 ${335 + taprootDepth}`, width: taprootWidth, isTap: true });

    const numLaterals = Math.floor(rootT * 30);
    for (let i = 0; i < numLaterals; i++) {
      const depthOffset = random(i * 100) * taprootDepth;
      const startY = 335 + depthOffset;
      const length = 10 + random(i * 101) * (150 * rootT);
      const angle = (Math.PI / 2) + (random(i * 102) > 0.5 ? 1 : -1) * (0.3 + random(i * 103));
      const endX = 200 + Math.cos(angle) * length;
      const endY = startY + Math.sin(angle) * length;
      items.push({ id: `lat-${i}`, path: `M 200 ${startY} Q ${200 + (endX-200)/2} ${startY+10} ${endX} ${endY}`, width: Math.max(0.5, taprootWidth * 0.3 * (1 - depthOffset/taprootDepth)), isTap: false });
    }
    return items;
  }, [level]);

  // Main Trunk
  const treeHeight = level < 15 ? 0 : 20 + Math.pow(Math.max(0, (level-15)/85), 0.7) * 260;
  const trunkBaseWidth = 2 + t * 45;
  const trunkTopWidth = 1 + t * 20;
  
  let trunkPath = "";
  if (level >= 15 && level < 30) {
    // Arching early sapling
    const archOffset = 15 - seedlingGrowth * 15; 
    trunkPath = `M 200 335 Q ${200 + archOffset} ${335 - treeHeight/2} 200 ${335 - treeHeight}`;
  } else if (level >= 30) {
    // Thick woody trunk
    trunkPath = `M ${200 - trunkBaseWidth/2} 335 
                 Q 195 ${335 - treeHeight/2} ${200 - trunkTopWidth/2} ${335 - treeHeight} 
                 L ${200 + trunkTopWidth/2} ${335 - treeHeight} 
                 Q 205 ${335 - treeHeight/2} ${200 + trunkBaseWidth/2} 335 Z`;
  }

  // Branches
  const branches = useMemo(() => {
    const items: any[] = [];
    if (level < 30) return items;
    
    const branchT = Math.max(0, (level - 30) / 70);
    const numBranches = Math.floor(branchT * 25);
    for (let i = 0; i < numBranches; i++) {
      const r1 = random(i * 200);
      const r2 = random(i * 201);
      
      const startY = 335 - (treeHeight * (0.3 + r1 * 0.6));
      const length = 30 + (r2 * treeHeight * 0.6);
      const angle = (r1 > 0.5 ? 1 : -1) * (0.3 + r2 * 0.8);
      
      const endX = 200 + Math.sin(angle) * length;
      const endY = startY - Math.cos(angle) * length;
      const branchWidth = Math.max(1, trunkTopWidth * 0.7 * (1 - r1*0.4));
      
      items.push({ id: i, startY, endX, endY, branchWidth, angle });
    }
    return items;
  }, [level, treeHeight, trunkTopWidth]);

  // Leaves
  const leaves = useMemo(() => {
    const items: any[] = [];
    if (level < 20) return items; 
    
    const leafT = Math.max(0, (level - 20) / 80);
    let leafPalettes = ['#15803d', '#166534', '#14532d']; 
    if (level <= 30) leafPalettes = ['#84cc16', '#65a30d', '#a3e635']; 
    else if (level <= 50) leafPalettes = ['#b45309', '#d97706', '#92400e']; 

    const numLeaves = Math.floor(10 + leafT * 300);
    
    for (let i = 0; i < numLeaves; i++) {
      let cx, cy, angle;
      if (level < 35) {
        cy = 335 - treeHeight * (0.5 + random(i*300)*0.5);
        cx = 200 + (random(i*301) > 0.5 ? 5 : -5);
        angle = random(i*301) > 0.5 ? 30 + random(i*302)*30 : 150 - random(i*302)*30;
      } else {
        const branch = branches[Math.floor(random(i*303) * branches.length)];
        if (branch) {
          const along = random(i*304);
          cx = 200 + (branch.endX - 200) * along + (random(i*305)-0.5)*20;
          cy = branch.startY + (branch.endY - branch.startY) * along + (random(i*306)-0.5)*20;
          angle = (branch.angle * 180 / Math.PI) + (random(i*307)-0.5)*60 + (branch.angle > 0 ? 90 : -90);
        } else {
           cx = 200; cy = 335 - treeHeight; angle = 0;
        }
      }

      const size = 0.5 + leafT * 0.8 + random(i*308)*0.5;
      const color = leafPalettes[Math.floor(random(i*309) * leafPalettes.length)];
      
      items.push({ id: i, cx, cy, angle, size, color });
    }
    return items;
  }, [level, treeHeight, branches]);

  // Flowers & Fruits (Level 61+)
  const flowers = useMemo(() => {
    const items: any[] = [];
    if (level >= 61 && level <= 80) {
      const numFlowers = level <= 70 ? (level - 60) * 15 : (80 - level) * 15;
      for (let i = 0; i < numFlowers; i++) {
        if (branches.length === 0) continue;
        const branch = branches[Math.floor(random(i*400) * branches.length)];
        const along = 0.7 + random(i*401)*0.3;
        items.push({ 
          id: i, 
          cx: 200 + (branch.endX - 200) * along + (random(i*402)-0.5)*30, 
          cy: branch.startY + (branch.endY - branch.startY) * along + (random(i*403)-0.5)*30, 
          size: 1.5 + random(i*405),
          color: random(i*404) > 0.5 ? '#fde047' : '#fbcfe8'
        });
      }
    }
    return items;
  }, [level, branches]);

  const mangoes = useMemo(() => {
    const items: any[] = [];
    if (level >= 71) {
      const numMangoes = Math.floor((level - 70) * 0.8); 
      for (let i = 0; i < numMangoes; i++) {
        if (branches.length === 0) continue;
        const branch = branches[Math.floor(random(i*500) * branches.length)];
        const along = 0.5 + random(i*501)*0.4;
        const maturity = Math.min(1, (level - 70) / 20 + random(i*502)*0.2); 
        items.push({ 
          id: i, 
          cx: 200 + (branch.endX - 200) * along, 
          cy: branch.startY + (branch.endY - branch.startY) * along + 10, 
          size: 2 + maturity * 3, 
          color: `rgb(${Math.floor(34 + maturity * 211)},${Math.floor(197 - maturity * 39)},${Math.floor(94 - maturity * 83)})` 
        });
      }
    }
    return items;
  }, [level, branches]);

  // UI Progress
  const prevLevelXp = (level - 1) * 50;
  const currentLevelProgress = xp - prevLevelXp;
  const xpNeededForLevel = 50;
  const progressPercent = Math.min(100, Math.max(0, (currentLevelProgress / xpNeededForLevel) * 100));

  // Particles
  const particles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      x: random(i * 10) * 100,
      y: random(i * 11) * 100,
      duration: 3 + random(i * 12) * 4,
      delay: random(i * 13) * 5,
    }));
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-2 w-full h-full relative overflow-hidden">
      {/* Dynamic Background Glow */}
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[80px] pointer-events-none transition-colors duration-1000 z-0"
        style={{ backgroundColor: glowColor }}
      />
      
      {/* Floating Spore Particles */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className="absolute w-1 h-1 rounded-full bg-white/40 blur-[1px]"
            initial={{ top: `${p.y}%`, left: `${p.x}%`, opacity: 0, scale: 0 }}
            animate={{ 
              top: [`${p.y}%`, `${p.y - 10}%`, `${p.y}%`], 
              left: [`${p.x}%`, `${p.x + 5}%`, `${p.x}%`],
              opacity: [0, 0.8, 0],
              scale: [0, 1.5, 0]
            }}
            transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      <div className="relative w-full aspect-square max-w-[360px] mx-auto z-10 flex items-end justify-center mb-6">
        <svg viewBox={`${vX} ${vY} ${vW} ${vH}`} className="w-full h-full overflow-visible transition-all duration-[2000ms] ease-out">
          <defs>
            <linearGradient id="trunkGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#4a3018" />
              <stop offset="50%" stopColor="#6b4626" />
              <stop offset="100%" stopColor="#3d2612" />
            </linearGradient>
            
            <linearGradient id="soilGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f2e24" />
              <stop offset="100%" stopColor="#1c140f" />
            </linearGradient>
            
            <g id="mangoLeaf">
              <path d="M 0 0 C 8 -10 20 -4 25 0 C 20 4 8 10 0 0 Z" />
            </g>

            {/* Handcrafted Cotyledon Leaf */}
            <g id="sproutLeaf">
              <path d="M 0 0 C 5 -15 15 -15 20 -5 C 10 0 5 5 0 0 Z" fill="#84cc16" />
            </g>
          </defs>

          <g transform="translate(0, 80)">
            
            {/* Roots */}
            {roots.map(root => (
              <path 
                key={root.id}
                d={root.path}
                fill="none"
                stroke={root.isTap ? "#eab308" : "#ca8a04"}
                strokeWidth={root.width}
                strokeLinecap="round"
                opacity={root.isTap ? 0.8 : 0.6}
                className="transition-all duration-1000 ease-in-out"
              />
            ))}

            {/* Soil Mound */}
            <ellipse 
              cx="200" 
              cy="335" 
              rx={soilWidth / 2} 
              ry={soilHeight} 
              fill="url(#soilGrad)" 
              className="transition-all duration-1000 ease-in-out"
            />
            
            {/* Handcrafted Golden Seed (Level 1-15 fade out) */}
            {seedOpacity > 0 && (
              <g 
                transform={`translate(200, 335) scale(${seedScale}) translate(-495.5, -814.4)`} 
                opacity={seedOpacity} 
                className="transition-all duration-1000 ease-in-out"
              >
                {seedPaths.map((d, i) => (
                  <path key={`seed-${i}`} fill="#d4af37" d={d} />
                ))}
                {/* Seed Glow */}
                <circle cx="495.5" cy="814.4" r="100" fill="#d4af37" opacity={0.3} className="animate-pulse" />
              </g>
            )}

            {/* Handcrafted Sprout (Level 5-15) */}
            {sproutGrowth > 0 && level < 25 && (
              <g className="transition-all duration-1000">
                {/* Stem */}
                <path 
                  d={`M 200 335 Q 215 ${335 - 25 * sproutGrowth} 200 ${335 - 50 * sproutGrowth}`}
                  fill="none"
                  stroke="#84cc16"
                  strokeWidth={3 + 2 * sproutGrowth}
                  strokeLinecap="round"
                />
                {/* Left Cotyledon */}
                <g transform={`translate(200, ${335 - 50 * sproutGrowth}) rotate(${-130 + 40 * sproutGrowth}) scale(${0.5 + 1.5 * sproutGrowth})`}>
                  <use href="#sproutLeaf" />
                </g>
                {/* Right Cotyledon */}
                <g transform={`translate(200, ${335 - 50 * sproutGrowth}) rotate(${-50 - 40 * sproutGrowth}) scale(${0.5 + 1.5 * sproutGrowth})`}>
                  <use href="#sproutLeaf" />
                </g>
              </g>
            )}

            {/* Procedural Trunk / Stem (Level 15+) */}
            {level >= 15 && level < 30 ? (
              <path 
                d={trunkPath}
                fill="none"
                stroke="#65a30d"
                strokeWidth={3 + seedlingGrowth * 3}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-in-out"
              />
            ) : level >= 30 && (
              <path 
                d={trunkPath}
                fill="url(#trunkGrad)"
                className="transition-all duration-1000 ease-in-out"
              />
            )}

            {/* Procedural Branches */}
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

            {/* Procedural Leaves */}
            {leaves.map(leaf => (
              <use 
                key={`leaf-${leaf.id}`}
                href="#mangoLeaf"
                x={0} y={0}
                fill={leaf.color}
                transform={`translate(${leaf.cx}, ${leaf.cy}) rotate(${leaf.angle}) scale(${leaf.size})`}
                opacity={0.9}
                className="transition-all duration-1000 ease-in-out"
              />
            ))}

            {/* Flowers */}
            {flowers.map(flower => (
              <circle 
                key={`fl-${flower.id}`}
                cx={flower.cx}
                cy={flower.cy}
                r={flower.size}
                fill={flower.color}
                opacity={0.8}
              />
            ))}

            {/* Mangoes */}
            {mangoes.map(mango => (
              <g key={`mg-${mango.id}`} transform={`translate(${mango.cx}, ${mango.cy})`} className="transition-all duration-1000">
                <line x1={0} y1={0} x2={0} y2={-mango.size*1.5} stroke="#15803d" strokeWidth={mango.size*0.2} />
                <ellipse cx={0} cy={0} rx={mango.size*0.7} ry={mango.size} fill={mango.color} />
              </g>
            ))}
          </g>
        </svg>

      </div>

      {/* Modern Circular Progress Ring */}
      {!isMaxLevel && (
        <div className="relative w-20 h-20 bg-[#000000]/60 rounded-full backdrop-blur-xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] z-20 mb-3 mt-4 border border-white/5 flex items-center justify-center">
          <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full absolute inset-0">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="8" />
            <motion.circle 
              cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="8" 
              strokeDasharray="283"
              strokeDashoffset={283 - (283 * progressPercent) / 100}
              className={textColor}
              strokeLinecap="round"
              initial={{ strokeDashoffset: 283 }}
              animate={{ strokeDashoffset: 283 - (283 * progressPercent) / 100 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <span className="text-white font-black text-2xl z-10">{level}</span>
        </div>
      )}

      <div className="text-center relative z-20 mt-2 bg-gradient-to-t from-black/80 to-transparent w-full pt-8 -mb-4 pb-4">
        <h3 className={`text-4xl font-black ${textColor} uppercase tracking-widest drop-shadow-[0_2px_10px_rgba(0,0,0,0.8)]`}>{stageName}</h3>
        {isMaxLevel ? (
          <p className="text-sm text-white font-bold mt-3 bg-[#16a34a]/20 border border-[#16a34a]/50 px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(22,163,74,0.3)] inline-block">
            🌸 A real mango tree has been planted in your name!
          </p>
        ) : (
          <div className="mt-3 inline-flex items-center space-x-2 bg-white/5 border border-white/10 px-4 py-2 rounded-full backdrop-blur-md">
            <div className={`w-2 h-2 rounded-full ${textColor.replace('text-', 'bg-')} animate-pulse`} />
            <p className="text-xs text-zinc-300 font-bold uppercase tracking-wider">
              <span className="text-white">{50 - currentLevelProgress} XP</span> to Level {level + 1}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

