const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://duukqwjykkqlpuetvoyu.supabase.co', 'sb_publishable_UUr95rmlx6M4UJmPXiNAZA_YYQ6GMcs');

async function fixXP() {
  const { data: reports } = await supabase.from('reports').select('username, status');
  const userXP = {};
  
  for (const r of reports) {
    if (!userXP[r.username]) userXP[r.username] = 0;
    userXP[r.username] += 10;
  }
  
  for (const [username, xp] of Object.entries(userXP)) {
    const { data: user } = await supabase.from('users').select('xp, name').eq('name', username).single();
    if (user) {
       if (user.xp < xp) {
         await supabase.from('users').update({ xp: xp }).eq('name', username);
         console.log(`Updated ${username} to ${xp} XP`);
       }
    }
  }
}
fixXP();
