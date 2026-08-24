const { createClient } = require('@supabase/supabase-js');
const { config } = require('./env');

if (!config.supabaseUrl || !config.supabaseSecretKey) {
  console.error('❌ Supabase URL or Secret Key not configured');
  process.exit(1);
}

const supabase = createClient(config.supabaseUrl, config.supabaseSecretKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

/**
 * Test the Supabase connection by running a simple query.
 * Returns { connected: true } on success or { connected: false, error } on failure.
 */
async function testConnection() {
  try {
    // Use a lightweight RPC or raw query to test connectivity
    const { data, error } = await supabase.from('payments').select('id').limit(1);
    
    // If the table doesn't exist yet, that's okay — we're just testing connectivity
    if (error && 
        !error.message.includes('does not exist') && 
        !error.message.includes('relation') && 
        !error.message.includes('schema cache')) {
      return { connected: false, error: error.message };
    }
    return { connected: true };
  } catch (err) {
    return { connected: false, error: err.message };
  }
}

module.exports = { supabase, testConnection };
