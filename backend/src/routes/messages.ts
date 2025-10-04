import express from 'express';
import { messageService } from '../services/messageService.js';
import { authService } from '../services/authService.js';
import { db } from '../database/connection.js';
import multer from 'multer';
import path from 'path';

const router = express.Router();
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

const requireAuth = async (req: any, res: any, next: any) => {
  const sessionToken = req.headers.authorization?.replace('Bearer ', '');
  
  if (!sessionToken) {
    return res.status(401).json({ error: 'Session token required' });
  }
  
  const session = await authService.validateSession(sessionToken);
  if (!session.valid) {
    return res.status(401).json({ error: 'Invalid session' });
  }
  
  req.user = session.user;
  next();
};

router.get('/', requireAuth, async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = parseInt(req.query.offset as string) || 0;
    
    console.log('🌐 GET /api/messages - limit:', limit, 'offset:', offset);
    
    try {
      const tableCheck = await db.query("SHOW TABLES LIKE 'messages'");
      if (tableCheck.length === 0) {
        return res.status(500).json({ error: 'Messages table does not exist' });
      }
    } catch (tableError) {
      console.error('❌ Table check error:', tableError);
      return res.status(500).json({ error: 'Database table error' });
    }
    
    const messages = await messageService.getMessages(limit, offset);
    res.json({ messages });
  } catch (error) {
    console.error('❌ Get messages error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  try {
    const { content, message_type, language } = req.body;
    const user = req.user;
    
    console.log('📨 Received message data:', {
      content_length: content?.length,
      message_type,
      language,
      has_file: !!req.file
    });
    
    if (!content && !req.file) {
      return res.status(400).json({ error: 'Content or file required' });
    }
    
    let filePath, fileName, fileSize, mimeType;
    
    if (req.file) {
      let originalName: string;
      try {
        originalName = Buffer.from(req.file.originalname, 'binary').toString('utf8');
      } catch {
        originalName = req.file.originalname;
      }
      
      fileName = await messageService.saveFile(
        { ...req.file, originalname: originalName }, 
        user.id, 
        message_type || 'file'
      );
      filePath = fileName;
      fileSize = req.file.size;
      mimeType = req.file.mimetype;
    }
    
    const actualMessageType = req.file ? 
      messageService.getFileType(req.file.mimetype) : 
      (message_type || 'text');
    
    const messageContent = content || (req.file ? req.file.originalname : '');
    
    const messageId = await messageService.createMessage({
      user_id: user.id,
      content: messageContent,
      message_type: actualMessageType,
      language: language || null,
      file_path: filePath,
      file_name: req.file ? Buffer.from(req.file.originalname, 'binary').toString('utf8') : fileName,
      file_size: fileSize || 0,
      mime_type: mimeType
    });
    
    const message = await messageService.getMessageById(messageId);
    res.json({ success: true, message });
  } catch (error: any) {
    console.error('❌ Create message error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Avatar file required' });
    }
    
    const user = req.user;
    const fileName = await messageService.saveAvatar(req.file, user.id);
    
    await messageService.setUserAvatar(user.id, fileName, req.file.mimetype, req.file.size);
    
    res.json({ success: true, avatarPath: fileName });
  } catch (error: any) {
    console.error('Avatar upload error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.get('/file/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    console.log('📁 Requesting file with path:', filePath);
    
    if (!filePath) {
      return res.status(400).json({ error: 'File path required' });
    }
    
    const fileBuffer = await messageService.getFile(filePath);
    
    let contentType = 'application/octet-stream';
    const fileName = path.basename(filePath);
    
    if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) contentType = 'image/jpeg';
    else if (fileName.endsWith('.png')) contentType = 'image/png';
    else if (fileName.endsWith('.gif')) contentType = 'image/gif';
    else if (fileName.endsWith('.mp4')) contentType = 'video/mp4';
    else if (fileName.endsWith('.webm')) contentType = 'video/webm';
    else if (fileName.endsWith('.mp3')) contentType = 'audio/mpeg';
    else if (fileName.endsWith('.wav')) contentType = 'audio/wav';
    else if (fileName.endsWith('.pdf')) contentType = 'application/pdf';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `inline; filename="${fileName}"`);
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('❌ File not found:', req.params[0], error);
    res.status(404).json({ error: 'File not found' });
  }
});

router.get('/avatar/*', async (req, res) => {
  try {
    const filePath = req.params[0];
    console.log('👤 Requesting avatar with path:', filePath);
    
    if (!filePath) {
      return res.status(400).json({ error: 'Avatar path required' });
    }
    
    const fileBuffer = await messageService.getFile(filePath);
    
    let contentType = 'image/jpeg';
    const fileName = path.basename(filePath);
    
    if (fileName.endsWith('.png')) contentType = 'image/png';
    else if (fileName.endsWith('.gif')) contentType = 'image/gif';
    
    res.setHeader('Content-Type', contentType);
    res.send(fileBuffer);
  } catch (error: any) {
    console.error('❌ Avatar not found:', req.params[0], error);
    res.status(404).json({ error: 'Avatar not found' });
  }
});

router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const { content, message_type } = req.body;
    const user = req.user;

    if (!content && !message_type) {
      return res.status(400).json({ error: 'Content or message_type required' });
    }

    const canEdit = await messageService.canEditMessage(messageId, user.id);
    if (!canEdit) {
      return res.status(403).json({ error: 'You can only edit your own messages' });
    }

    const success = await messageService.updateMessage(messageId, {
      content,
      message_type
    });

    if (success) {
      const updatedMessage = await messageService.getMessageById(messageId);
      res.json({ success: true, message: updatedMessage });
    } else {
      res.status(404).json({ error: 'Message not found' });
    }
  } catch (error: any) {
    console.error('Update message error:', error);
    res.status(500).json({ error: error.message });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const messageId = parseInt(req.params.id);
    const user = req.user;

    const canEdit = await messageService.canEditMessage(messageId, user.id);
    if (!canEdit) {
      return res.status(403).json({ error: 'You can only delete your own messages' });
    }

    const success = await messageService.deleteMessage(messageId);
    res.json({ success });
  } catch (error: any) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
