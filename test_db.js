import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
async function run() {
  const { data: u } = await supabase.from('users').select('*').limit(1);
  console.log('User:', u);
  const { data: r } = await supabase.from('reports').select('*').limit(1);
  console.log('Report:', r);
}
run();
