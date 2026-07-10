export const getLocalStreak = () => {
  if (typeof window === 'undefined') return 0;
  
  const today = new Date().toDateString();
  const lastVisit = localStorage.getItem('namma_last_visit');
  let streak = parseInt(localStorage.getItem('namma_streak') || '0', 10);
  
  if (lastVisit === today) {
    // Already visited today, streak remains the same
    return streak;
  }
  
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  
  if (lastVisit === yesterday.toDateString()) {
    // Visited yesterday, streak continues!
    streak += 1;
  } else {
    // Broken streak, reset to 1 (since they visited today)
    streak = 1;
  }
  
  localStorage.setItem('namma_last_visit', today);
  localStorage.setItem('namma_streak', streak.toString());
  
  return streak;
};
