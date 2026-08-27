const { execSync } = require('child_process');
const path = require('path');

try {
  console.log('🔄 Delegating to python migration runner...');
  const pythonPath = path.resolve(__dirname, '../../ai-service/.venv/Scripts/python.exe');
  const scriptPath = path.resolve(__dirname, '../../ai-service/run_migrations.py');
  execSync(`"${pythonPath}" "${scriptPath}"`, { stdio: 'inherit' });
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exit(1);
}
