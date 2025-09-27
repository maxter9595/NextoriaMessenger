import express from 'express';
import { userService } from '../services/userService.js';
import { authService } from '../services/authService.js';
import { db } from '../database/connection.js';

const router = express.Router();

const requireAdmin = async (req: any, res: any, next: any) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({ error: 'Session token required' });
  }
  
  const session = await authService.validateSession(sessionToken);
  if (!session.valid) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  if (session.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.user = session.user;
  next();
};

router.get('/', requireAdmin, async (req, res) => {
  try {
    const sql = `SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC`;
    
    const users = await db.query(sql);
    
    res.json({
      users,
      pagination: {
        page: 1,
        limit: users.length,
        total: users.length,
        totalPages: 1
      }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAdmin, async (req, res) => {
  const { username, email, password, role } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password required' });
  }
  
  try {
    const existingUser = await userService.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists' });
    }
    
    const existingEmail = await userService.getUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Email already exists' });
    }
    
    const userId = await userService.createUser({
      username,
      email,
      password,
      role: role || 'user'
    });
    
    res.json({ success: true, userId });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { is_active } = req.body;

    if (is_active === undefined) {
      return res.status(400).json({ error: 'is_active field required' });
    }

    const success = await userService.updateUser(userId, { is_active });
    res.json({ success });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.patch('/:id/password', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({ error: 'Password required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const success = await userService.changePassword(userId, password);
    res.json({ success });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/activity', requireAdmin, async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const sql = `
      SELECT * FROM user_activity_log 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const logs = await db.query(sql, [userId, limit, offset]);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/activity/system', requireAdmin, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    const sql = `
      SELECT * FROM user_activity_log 
      WHERE user_id IS NULL 
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    
    const logs = await db.query(sql, [limit, offset]);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;