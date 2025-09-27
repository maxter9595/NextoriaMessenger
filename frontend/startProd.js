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

console.log('🔧 [PROD] Environment variables loaded from project root:');
console.log(`   FRONTEND_URL: ${frontendUrl}`);
console.log(`   PORT: ${port}`);
console.log(`   BACKEND_URL: ${backendUrl}`);
console.log(`🚀 [PROD] Starting Next.js production server on port ${port}...\n`);

console.log('📦 Building production version...');
const buildProcess = spawn('next', ['build'], {
  stdio: 'inherit',
  shell: true
});

buildProcess.on('close', (code) => {
  if (code === 0) {
    console.log('✅ Build successful, starting server...');
    const nextProcess = spawn('next', ['start', '-p', port], {
      stdio: 'inherit',
      shell: true
    });

    nextProcess.on('error', (error) => {
      console.error('❌ [PROD] Error:', error);
    });

    process.on('SIGINT', () => {
      console.log('\n🛑 [PROD] Shutting down...');
      nextProcess.kill('SIGINT');
    });
  } else {
    console.error('❌ Build failed');
  }
});