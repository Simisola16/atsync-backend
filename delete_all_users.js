require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE
);

async function deleteAllUsers() {
  console.log('Fetching all users...');

  const { data, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });

  if (error) {
    console.error('Failed to list users:', error.message);
    process.exit(1);
  }

  
  const users = data.users;
  console.log(`Found ${users.length} user(s). Deleting...`);

  for (const user of users) {
    const { error: delError } = await supabase.auth.admin.deleteUser(user.id);
    if (delError) {
      console.error(`  ✗ Failed to delete ${user.email}: ${delError.message}`);
    } else {
      console.log(`  ✓ Deleted ${user.email}`);
    }
  }

  console.log('\nDone. All users deleted.');
}

deleteAllUsers();

