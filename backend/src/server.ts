import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(projectRoot, '.env') });

const app = express();
const BACKEND_URL = process.env.BACKEND_URL;
const FRONTEND_URL = process.env.FRONTEND_URL;

const backendUrl = new URL(BACKEND_URL);
const frontendUrl = new URL(FRONTEND_URL);

const PORT = backendUrl.port || (backendUrl.protocol === 'https:' ? '443' : '80');
const HOST = backendUrl.hostname;

console.log('🚀 Starting backend server with configuration:', {
  backendUrl: BACKEND_URL,
  frontendUrl: FRONTEND_URL,
  host: HOST,
  port: PORT,
  dbHost: process.env.DB_HOST,
  dbName: process.env.DB_NAME
});

app.use(cors({
  origin: FRONTEND_URL,
  credentials: true
}));
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);

app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    backendUrl: BACKEND_URL,
    frontendUrl: FRONTEND_URL
  });
});

app.listen(PORT, HOST, () => {
  console.log(`🚀 Backend server running on ${BACKEND_URL}`);
  console.log(`📊 Health check available at ${BACKEND_URL}/api/health`);
  console.log(`🔗 CORS enabled for: ${FRONTEND_URL}`);
});
