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
  const t = Math.max(0, Math.min(level - 1, 99)) / 99; // 0.0 to 1.0

  // Stage Names & Colors
  let stageName = "";
  let textColor = "";
  let glowColor = "";

  if (level <= 20) {
    stageName = "Germination";
    textColor = "text-[#d4af37]";
    glowColor = "rgba(163,230,53,0.1)";
  } else if (level <= 40) {
    stageName = "The Seedling";
    textColor = "text-[#84cc16]";
    glowColor = "rgba(163,230,53,0.2)";
  } else if (level <= 60) {
    stageName = "The Sapling";
    textColor = "text-[#22c55e]";
    glowColor = "rgba(34,197,94,0.3)";
  } else if (level <= 80) {
    stageName = "Young Tree";
    textColor = "text-[#eab308]"; // yellow/orange for flowering/fruiting
    glowColor = "rgba(234,179,8,0.3)";
  } else {
    stageName = "Mature Giant";
    textColor = "text-[#16a34a]";
    glowColor = "rgba(21,128,61,0.4)";
  }

  // --- PROCEDURAL GEOMETRY ---
  const soilWidth = 100 + t * 150;
  const soilHeight = 20 + t * 20;

  // 1. Root System
  const roots = useMemo(() => {
    const items: any[] = [];
    if (level < 4) return items;
    
    // Taproot
    const taprootDepth = Math.min(180, (level - 3) * 15);
    const taprootWidth = 2 + t * 15;
    items.push({ id: 'tap', path: `M 200 335 Q 195 ${335 + taprootDepth/2} 200 ${335 + taprootDepth}`, width: taprootWidth, isTap: true });

    // Lateral Roots
    const numLaterals = Math.floor(t * 30);
    for (let i = 0; i < numLaterals; i++) {
      const depthOffset = random(i * 100) * taprootDepth;
      const startY = 335 + depthOffset;
      const length = 10 + random(i * 101) * (150 * t);
      const angle = (Math.PI / 2) + (random(i * 102) > 0.5 ? 1 : -1) * (0.3 + random(i * 103));
      const endX = 200 + Math.cos(angle) * length;
      const endY = startY + Math.sin(angle) * length;
      items.push({ id: `lat-${i}`, path: `M 200 ${startY} Q ${200 + (endX-200)/2} ${startY+10} ${endX} ${endY}`, width: Math.max(0.5, taprootWidth * 0.3 * (1 - depthOffset/taprootDepth)), isTap: false });
    }
    return items;
  }, [level, t]);

  // 2. Trunk & Stem
  const treeHeight = level < 4 ? 0 : 20 + t * 260;
  const trunkBaseWidth = level < 15 ? (level > 4 ? 2 : 0) : 4 + t * 45;
  const trunkTopWidth = level < 15 ? (level > 4 ? 1 : 0) : 2 + t * 20;
  
  let trunkPath = "";
  if (level >= 4 && level < 15) {
    // Arching / straight early stem
    const archOffset = level < 10 ? 20 - (level-4)*3 : 0; 
    trunkPath = `M 200 335 Q ${200 + archOffset} ${335 - treeHeight/2} 200 ${335 - treeHeight}`;
  } else if (level >= 15) {
    // Thick woody trunk
    trunkPath = `M ${200 - trunkBaseWidth/2} 335 
                 Q 195 ${335 - treeHeight/2} ${200 - trunkTopWidth/2} ${335 - treeHeight} 
                 L ${200 + trunkTopWidth/2} ${335 - treeHeight} 
                 Q 205 ${335 - treeHeight/2} ${200 + trunkBaseWidth/2} 335 Z`;
  }

  // 3. Branches
  const branches = useMemo(() => {
    const items: any[] = [];
    if (level < 25) return items;
    
    const numBranches = Math.floor(t * 25);
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
  }, [level, t, treeHeight, trunkTopWidth]);

  // 4. Leaves
  const leaves = useMemo(() => {
    const items: any[] = [];
    if (level < 11) return items; // No leaves until level 11
    
    // Leaf colors based on phase
    let leafPalettes = ['#15803d', '#166534', '#14532d']; // Default dark green
    if (level <= 20) leafPalettes = ['#9f1239', '#be123c', '#e11d48']; // Reddish purple
    else if (level <= 30) leafPalettes = ['#84cc16', '#65a30d', '#a3e635']; // Pale green
    else if (level <= 40) leafPalettes = ['#b45309', '#d97706', '#92400e']; // Copper flush

    const numLeaves = level < 20 ? (level - 10) * 2 : Math.floor(20 + t * 300);
    
    for (let i = 0; i < numLeaves; i++) {
      let cx, cy, angle;
      if (level < 25) {
        // Attach directly to early stem
        cy = 335 - treeHeight * (0.5 + random(i*300)*0.5);
        cx = 200 + (random(i*301) > 0.5 ? 5 : -5);
        angle = random(i*301) > 0.5 ? 30 + random(i*302)*30 : 150 - random(i*302)*30;
      } else {
        // Attach to branches or canopy area
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

      const size = 0.5 + t * 0.8 + random(i*308)*0.5;
      const color = leafPalettes[Math.floor(random(i*309) * leafPalettes.length)];
      
      items.push({ id: i, cx, cy, angle, size, color });
    }
    return items;
  }, [level, t, treeHeight, branches]);

  // 5. Flowers (Level 61-80)
  const flowers = useMemo(() => {
    const items: any[] = [];
    if (level >= 61 && level <= 80) {
      const numFlowers = level <= 70 ? (level - 60) * 15 : (80 - level) * 15; // fade out
      for (let i = 0; i < numFlowers; i++) {
        if (branches.length === 0) continue;
        const branch = branches[Math.floor(random(i*400) * branches.length)];
        // Cluster near ends of branches
        const along = 0.7 + random(i*401)*0.3;
        const cx = 200 + (branch.endX - 200) * along + (random(i*402)-0.5)*30;
        const cy = branch.startY + (branch.endY - branch.startY) * along + (random(i*403)-0.5)*30;
        const color = random(i*404) > 0.5 ? '#fde047' : '#fbcfe8'; // yellowish-pink
        items.push({ id: i, cx, cy, size: 1.5 + random(i*405) });
      }
    }
    return items;
  }, [level, branches]);

  // 6. Mangoes (Level 71-100)
  const mangoes = useMemo(() => {
    const items: any[] = [];
    if (level >= 71) {
      const numMangoes = Math.floor((level - 70) * 0.8); 
      for (let i = 0; i < numMangoes; i++) {
        if (branches.length === 0) continue;
        const branch = branches[Math.floor(random(i*500) * branches.length)];
        const along = 0.5 + random(i*501)*0.4;
        const cx = 200 + (branch.endX - 200) * along;
        const cy = branch.startY + (branch.endY - branch.startY) * along + 10; // hang down
        
        // Colors: green (early) to yellow/orange (ripe)
        const maturity = Math.min(1, (level - 70) / 20 + random(i*502)*0.2); 
        const r = Math.floor(34 + maturity * (245 - 34));
        const g = Math.floor(197 + maturity * (158 - 197));
        const b = Math.floor(94 + maturity * (11 - 94));
        const color = `rgb(${r},${g},${b})`;
        
        items.push({ id: i, cx, cy, size: 2 + maturity * 3, color });
      }
    }
    return items;
  }, [level, branches]);

  const prevLevelXp = (level - 1) * 50;
  const currentLevelProgress = xp - prevLevelXp;
  const xpNeededForLevel = 50;
  const progressPercent = Math.min(100, Math.max(0, (currentLevelProgress / xpNeededForLevel) * 100));

  return (
    <div className="flex flex-col items-center justify-center p-2 w-full h-full relative overflow-hidden">
      <div 
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-72 h-72 rounded-full blur-[80px] pointer-events-none transition-colors duration-1000 z-0"
        style={{ backgroundColor: glowColor }}
      />
      
      <div className="relative w-full aspect-square max-w-[360px] mx-auto z-10 flex items-end justify-center mb-6">
        <svg viewBox="0 0 400 480" className="w-full h-full overflow-visible">
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
            
            {/* Lanceolate Leaf Definition */}
            <g id="mangoLeaf">
              <path d="M 0 0 C 8 -10 20 -4 25 0 C 20 4 8 10 0 0 Z" />
            </g>
          </defs>

          <g transform="translate(0, 80)"> {/* Shift everything down slightly to fit tall tree */}
            
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
            
            {/* Golden Seed (Fades out by level 20) */}
            {level < 20 && (
              <g 
                transform={`translate(200, 335) scale(${0.08 * (1 - (level-1)/19)}) translate(-495.5, -814.4)`} 
                opacity={1 - (level-1)/19} 
                className="transition-all duration-1000 ease-in-out"
              >
                {seedPaths.map((d, i) => (
                  <path key={`seed-${i}`} fill="#d4af37" d={d} />
                ))}
              </g>
            )}

            {/* Trunk / Stem */}
            {level >= 4 && level < 15 ? (
              <path 
                d={trunkPath}
                fill="none"
                stroke={level < 10 ? "#a3e635" : "#65a30d"}
                strokeWidth={2 + (level-4)*0.5}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-in-out"
              />
            ) : level >= 15 && (
              <path 
                d={trunkPath}
                fill="url(#trunkGrad)"
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

            {/* Leaves */}
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
                {/* Stem */}
                <line x1={0} y1={0} x2={0} y2={-mango.size*1.5} stroke="#15803d" strokeWidth={mango.size*0.2} />
                {/* Fruit */}
                <ellipse cx={0} cy={0} rx={mango.size*0.7} ry={mango.size} fill={mango.color} />
              </g>
            ))}
          </g>
        </svg>

      </div>

      {/* Level Circular Progress */}
      {!isMaxLevel && (
        <div className="w-16 h-16 bg-black/40 rounded-full backdrop-blur-sm shadow-xl z-20 mb-2 mt-2">
          <svg viewBox="0 0 100 100" className="-rotate-90 w-full h-full">
            <circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="6" />
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
            <text x="50" y="50" transform="rotate(90 50 50)" textAnchor="middle" dominantBaseline="middle" fill="white" fontSize="26" fontWeight="bold">
              {level}
            </text>
          </svg>
        </div>
      )}

      <div className="text-center relative z-20 mt-2">
        <h3 className={`text-3xl font-black ${textColor} uppercase tracking-widest drop-shadow-md`}>{stageName}</h3>
        {isMaxLevel ? (
          <p className="text-sm text-white font-bold mt-2 bg-[#16a34a]/20 border border-[#16a34a]/50 px-4 py-2 rounded-full shadow-[0_0_20px_rgba(22,163,74,0.3)]">
            🌸 A real mango tree has been planted in your name!
          </p>
        ) : (
          <p className="text-xs text-white/70 font-semibold mt-1 uppercase tracking-wider">
            {50 - currentLevelProgress} XP to Level {level + 1}
          </p>
        )}
      </div>
    </div>
  );
};
