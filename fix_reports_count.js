const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://duukqwjykkqlpuetvoyu.supabase.co', 'sb_publishable_UUr95rmlx6M4UJmPXiNAZA_YYQ6GMcs');

async function fixCount() {
  const { data: reports } = await supabase.from('reports').select('username');
  const userCounts = {};
  
  for (const r of reports) {
    if (!userCounts[r.username]) userCounts[r.username] = 0;
    userCounts[r.username] += 1;
  }
  
  for (const [username, count] of Object.entries(userCounts)) {
    const { data: user } = await supabase.from('users').select('reports_count, name').eq('name', username).single();
    if (user) {
       if (user.reports_count < count) {
         await supabase.from('users').update({ reports_count: count }).eq('name', username);
         console.log(`Updated ${username} to ${count} reports_count`);
       }
    }
  }
}
fixCount();
