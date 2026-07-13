import { supabase } from "./supabase";

export const getUserStreak = async (username: string) => {
  if (!username || username === 'Anonymous') return 0;

  try {
    const { data, error } = await supabase
      .from('reports')
      .select('timestamp')
      .eq('username', username)
      .order('timestamp', { ascending: false });
      
    if (error || !data || data.length === 0) return 0;
    
    const uniqueDates = Array.from(new Set(data.map(r => new Date(r.timestamp).toDateString())));
    
    let streak = 0;
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    
    const todayStr = today.toDateString();
    const yesterdayStr = yesterday.toDateString();
    
    if (uniqueDates[0] !== todayStr && uniqueDates[0] !== yesterdayStr) {
      return 0; // Streak broken
    }
    
    let checkDate = uniqueDates[0] === todayStr ? today : yesterday;
    
    for (let i = 0; i < uniqueDates.length; i++) {
      if (uniqueDates[i] === checkDate.toDateString()) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        break;
      }
    }
    
    return streak;
  } catch (e) {
    console.error("Failed to fetch streak", e);
    return 0;
  }
};
