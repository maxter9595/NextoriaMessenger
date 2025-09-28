import express from 'express';
import { authService } from '../services/authService.js';
import { userService } from '../services/userService.js';
import { db } from '../database/connection.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  
  if (!username || !email || !password) {
    return res.status(400).json({ error: 'Username, email and password required' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
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
      role: 'user'
    });
    
    const defaultAvatarPath = `avatars/default_avatar.png`;
    await db.query(`
      INSERT INTO user_avatars (user_id, avatar_path, mime_type, file_size) 
      VALUES (?, ?, 'image/png', 0)
    `, [userId, defaultAvatarPath]);
    
    const loginResult = await authService.login(username, password);
    
    if (loginResult.success) {
      res.json({ 
        success: true, 
        sessionToken: loginResult.sessionToken,
        user: loginResult.user,
        message: 'Registration successful'
      });
    } else {
      res.status(201).json({ 
        success: true, 
        userId,
        message: 'Registration successful, please login' 
      });
    }
    
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }
  
  const result = await authService.login(username, password);
  
  if (result.success) {
    res.json({ 
      success: true, 
      sessionToken: result.sessionToken,
      user: result.user
    });
  } else {
    res.status(401).json({ 
      success: false, 
      error: result.error 
    });
  }
});

router.post('/logout', async (req, res) => {
  const { sessionToken } = req.body;
  
  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token required' });
  }
  
  const success = await authService.logout(sessionToken);
  res.json({ success });
});

router.post('/validate', async (req, res) => {
  const { sessionToken } = req.body;
  
  if (!sessionToken) {
    return res.status(400).json({ error: 'Session token required' });
  }
  
  const result = await authService.validateSession(sessionToken);
  res.json(result);
});

export default router;
