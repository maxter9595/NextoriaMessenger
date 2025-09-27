require('dotenv').config({ path: '../.env' });
const { spawn } = require('child_process');

function getPortFromUrl(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.port || (urlObj.protocol === 'https:' ? '443' : '80');
  } catch {
    return '21000';
  }
}

const frontendUrl = process.env.FRONTEND_URL;
const backendUrl = process.env.BACKEND_URL;
const port = getPortFromUrl(frontendUrl);

console.log('🔧 [DEV] Environment variables loaded from project root:');
console.log(`   FRONTEND_URL: ${frontendUrl}`);
console.log(`   PORT: ${port}`);
console.log(`   BACKEND_URL: ${backendUrl}`);
console.log(`🚀 [DEV] Starting Next.js development server on port ${port}...\n`);

const nextProcess = spawn('next', ['dev', '-p', port], {
  stdio: 'inherit',
  shell: true
});

nextProcess.on('error', (error) => {
  console.error('❌ [DEV] Error:', error);
});

process.on('SIGINT', () => {
  console.log('\n🛑 [DEV] Shutting down...');
  nextProcess.kill('SIGINT');
});
