const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://duukqwjykkqlpuetvoyu.supabase.co', 'sb_publishable_UUr95rmlx6M4UJmPXiNAZA_YYQ6GMcs');
async function run() {
  const { data, error } = await supabase.from('users').select('*').eq('name', 'gokul').single();
  console.log("Select user:", data, error);
  const { data: upd, error: updErr } = await supabase.from('users').update({ xp: (data?.xp || 0) + 10 }).eq('name', 'gokul').select();
  console.log("Update user:", upd, updErr);
}
run();
