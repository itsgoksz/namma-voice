import * as turf from '@turf/helpers';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';

export interface AreaStats {
  area: string;
  reports: number;
  cleanups: number;
  guardian: string | null;
  leaderboard: { username: string; xp: number }[];
}

const getSeverityBaseXP = (severity: string) => {
  const s = severity?.toLowerCase() || 'low';
  if (s === 'critical' || s === 'high') return 50;
  if (s === 'severe') return 40;
  if (s === 'moderate' || s === 'medium') return 30;
  return 20;
};

/**
 * Calculates Area XP based on reports that fall within a specific territory polygon.
 * Mimics exactly how Eco XP is calculated globally (via admin verification).
 */
export function calculateTerritoryLeaderboard(territoryPolygon: any, reports: any[], reportSupports: any[] = []): AreaStats {
  let reportCount = 0;
  let cleanupCount = 0;
  const userXp: Record<string, number> = {};
  
  const poly = territoryPolygon;

  reports.forEach(report => {
    // Check if report is inside territory
    const pt = turf.point([report.lng, report.lat]);
    if (!booleanPointInPolygon(pt, poly as any)) {
      return; // Skip if outside
    }

    reportCount++;
    
    // For now we only grant XP if the report is CLEANED, 
    // exactly matching the admin verification logic.
    if (report.status === 'CLEANED' && report.cleanup_timestamp) {
      cleanupCount++;
      
      let baseXP = getSeverityBaseXP(report.severity);
      let multiplier = 1;

      if (report.severity === 'critical' || report.severity === 'high') {
        const reportedAt = new Date(report.timestamp).getTime();
        const cleanedAt = new Date(report.cleanup_timestamp).getTime();
        const diffHours = (cleanedAt - reportedAt) / (1000 * 60 * 60);
        if (diffHours <= 24) multiplier = 2;
      }

      const totalXP = baseXP * multiplier;
      const squad = Array.isArray(report.cleanup_squad) ? report.cleanup_squad : [report.username];
      const perPerson = Math.floor(totalXP / squad.length);

      // Cleaners get BaseXP * Multiplier / SquadSize
      squad.forEach((member: string) => {
        if (member) userXp[member] = (userXp[member] || 0) + perPerson;
      });

      // Reporter gets 10 Assist XP if not in squad
      if (report.username && !squad.map((s: string) => s.toLowerCase()).includes(report.username.toLowerCase())) {
        userXp[report.username] = (userXp[report.username] || 0) + 10;
      }

      // Supporters get 5 XP
      const supporters = reportSupports
        .filter(s => s.report_id === report.id)
        .map(s => s.username);
        
      if (supporters.length > 0) {
        const eligibleSupporters = supporters.filter(
          (u: string) => u.toLowerCase() !== (report.username || '').toLowerCase() && !squad.map((sq: string) => sq.toLowerCase()).includes(u.toLowerCase())
        );
        eligibleSupporters.forEach((u: string) => {
          if (u) userXp[u] = (userXp[u] || 0) + 5;
        });
      }
    } else {
      // If NOT cleaned, do they get XP just for reporting?
      // Based on the user's comment, "if a person reports... and earn a lot of eco xp... their 'area xp' is just their eco xp".
      // We'll give 10 XP for an active report as a placeholder for "reporting eco xp". 
      if (report.username) {
        userXp[report.username] = (userXp[report.username] || 0) + 10;
      }
    }
  });

  // Convert to sorted leaderboard array
  const leaderboard = Object.entries(userXp)
    .map(([username, xp]) => ({ username, xp }))
    .sort((a, b) => b.xp - a.xp);

  return {
    area: territoryPolygon.properties?.name || 'Unknown',
    reports: reportCount,
    cleanups: cleanupCount,
    guardian: leaderboard.length > 0 ? leaderboard[0].username : null,
    leaderboard
  };
}
