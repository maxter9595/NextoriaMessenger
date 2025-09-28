import { createCanvas } from 'canvas';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createDefaultAvatar(): void {
  const size = 200;
  const canvas = createCanvas(size, size);
  const ctx = canvas.getContext('2d');

  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, '#007cf0'); 
  gradient.addColorStop(1, '#00dfd8');
  
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'white';
  ctx.font = 'bold 80px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('👤', size / 2, size / 2);

  const avatarsDir = path.join(__dirname, '..', '..', 'uploads', 'avatars');
  
  if (!fs.existsSync(avatarsDir)) {
    fs.mkdirSync(avatarsDir, { recursive: true });
  }

  const buffer = canvas.toBuffer('image/png');
  const filePath = path.join(avatarsDir, 'default_avatar.png');
  
  fs.writeFileSync(filePath, buffer);
  console.log('✅ TypeScript blue avatar created:', filePath);
  console.log('🎨 Gradient: #007cf0 → #00dfd8');
}

createDefaultAvatar();