/**
 * FIX #32: startup environment variable validation
 * Call validateEnv() once before app starts.
 */
const REQUIRED_ENV = ['JWT_SECRET', 'MONGO_URI'];
const RECOMMENDED_ENV = ['CLIENT_URL', 'NODE_ENV'];

function validateEnv() {
  const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
  }

  // FIX #2: validate JWT_SECRET strength
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.error('❌ JWT_SECRET must be at least 32 characters long');
    process.exit(1);
  }

  const missing_rec = RECOMMENDED_ENV.filter((key) => !process.env[key]);
  if (missing_rec.length) {
    console.warn(`⚠️  Missing recommended env vars: ${missing_rec.join(', ')}`);
  }

  console.log('✅ Environment validated');
}

module.exports = { validateEnv };
