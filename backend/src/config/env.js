const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const requiredVars = [
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  'PORT'
];

const optionalVars = [
  'SUPABASE_PUBLISHABLE_KEY',
  'GEMINI_API_KEY',
  'LLM_PROVIDER',
  'AI_SERVICE_URL',
  'RAZORPAY_KEY_ID',
  'RAZORPAY_KEY_SECRET'
];

function validateEnv() {
  const missing = requiredVars.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:');
    missing.forEach((v) => console.error(`   - ${v}`));
    console.error('\nPlease check your .env file in the project root.');
    process.exit(1);
  }

  const presentOptional = optionalVars.filter((v) => process.env[v]);
  const missingOptional = optionalVars.filter((v) => !process.env[v]);

  console.log('✅ Required environment variables loaded');
  if (missingOptional.length > 0) {
    console.log(`⚠️  Optional vars not set: ${missingOptional.join(', ')}`);
  }
}

module.exports = {
  validateEnv,
  config: {
    port: parseInt(process.env.PORT, 10) || 5000,
    nodeEnv: (process.env.NODE_ENV || 'development').trim(),
    supabaseUrl: process.env.SUPABASE_URL?.trim(),
    supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY?.trim(),
    supabaseSecretKey: process.env.SUPABASE_SECRET_KEY?.trim(),
    aiServiceUrl: (process.env.AI_SERVICE_URL || 'http://localhost:8000').trim(),
    llmProvider: (process.env.LLM_PROVIDER || 'gemini').trim(),
  }
};
