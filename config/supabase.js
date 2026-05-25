const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE; // service_role key has admin access bypasses RLS

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Supabase environment variables are missing in backend!');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

module.exports = supabase;
