export interface Mission {
  id: string;
  title: string;
  xp: number;
  type: 'scout' | 'advocate' | 'cleaner' | 'social';
  evaluate: (myReports: any[], supportedCount: number, myCleanups: any[], shareCount: number) => boolean;
}

export const MISSION_POOL: Mission[] = [
  {
    id: 'scout_1',
    title: 'Report 1 litter spot',
    xp: 20,
    type: 'scout',
    evaluate: (myReports) => myReports.length >= 1,
  },
  {
    id: 'scout_2',
    title: 'Report 2 litter spots',
    xp: 40,
    type: 'scout',
    evaluate: (myReports) => myReports.length >= 2,
  },
  {
    id: 'scout_night',
    title: 'Report a spot after 6 PM',
    xp: 30,
    type: 'scout',
    evaluate: (myReports) => myReports.some(r => {
      const d = new Date(r.timestamp.endsWith('Z') ? r.timestamp : r.timestamp + 'Z');
      return d.getHours() >= 18 || d.getHours() < 6;
    }),
  },
  {
    id: 'advocate_1',
    title: 'Support 1 community report',
    xp: 30,
    type: 'advocate',
    evaluate: (_, supportedCount) => supportedCount >= 1,
  },
  {
    id: 'advocate_3',
    title: 'Support 3 community reports',
    xp: 50,
    type: 'advocate',
    evaluate: (_, supportedCount) => supportedCount >= 3,
  },
  {
    id: 'cleaner_1',
    title: 'Participate in 1 cleanup',
    xp: 50,
    type: 'cleaner',
    evaluate: (_, __, myCleanups) => myCleanups.length >= 1,
  },
  {
    id: 'cleaner_severe',
    title: 'Clean a Severe or Critical hazard',
    xp: 80,
    type: 'cleaner',
    evaluate: (_, __, myCleanups) => myCleanups.some(c => c.severity === 'severe' || c.severity === 'critical' || c.severity === 3 || c.severity === 4),
  },
  {
    id: 'social_organise',
    title: 'Use the Cleanup Poster tool',
    xp: 40,
    type: 'social',
    evaluate: (_, __, ___, shareCount) => shareCount >= 1,
  }
];

// Simple seeded random number generator
function xfc32(a: number, b: number, c: number, d: number) {
  return function() {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0; 
    let t = (a + b) | 0;
    a = b ^ b >>> 9;
    b = c + (c << 3) | 0;
    c = (c << 21 | c >>> 11);
    d = d + 1 | 0;
    t = t + d | 0;
    c = c + t | 0;
    return (t >>> 0) / 4294967296;
  }
}

export function getDailyMissions(dateStr: string): Mission[] {
  // Hash the date string to create a seed
  let seed = 0;
  for (let i = 0; i < dateStr.length; i++) {
    seed = Math.imul(31, seed) + dateStr.charCodeAt(i) | 0;
  }
  
  const rand = xfc32(seed, seed * 2, seed * 3, seed * 4);
  
  // Clone pool to select randomly without replacement
  const pool = [...MISSION_POOL];
  const selected: Mission[] = [];
  
  // Try to pick one of each type if possible to ensure variety, otherwise random
  const desiredTypes = ['scout', 'advocate', 'cleaner'];
  
  // 1. Pick a scout
  let scoutIdx = pool.findIndex(m => m.type === 'scout');
  if (scoutIdx >= 0) {
    const scouts = pool.filter(m => m.type === 'scout');
    const pick = scouts[Math.floor(rand() * scouts.length)];
    selected.push(pick);
    pool.splice(pool.findIndex(m => m.id === pick.id), 1);
  }
  
  // 2. Pick an advocate
  let advIdx = pool.findIndex(m => m.type === 'advocate');
  if (advIdx >= 0) {
    const advocates = pool.filter(m => m.type === 'advocate');
    const pick = advocates[Math.floor(rand() * advocates.length)];
    selected.push(pick);
    pool.splice(pool.findIndex(m => m.id === pick.id), 1);
  }
  
  // 3. Pick a cleaner or social
  let remIdx = pool.findIndex(m => m.type === 'cleaner' || m.type === 'social');
  if (remIdx >= 0) {
    const rem = pool.filter(m => m.type === 'cleaner' || m.type === 'social');
    const pick = rem[Math.floor(rand() * rem.length)];
    selected.push(pick);
    pool.splice(pool.findIndex(m => m.id === pick.id), 1);
  }
  
  // Fill to 3 if not enough
  while (selected.length < 3 && pool.length > 0) {
    const idx = Math.floor(rand() * pool.length);
    selected.push(pool[idx]);
    pool.splice(idx, 1);
  }
  
  return selected.slice(0, 3);
}
