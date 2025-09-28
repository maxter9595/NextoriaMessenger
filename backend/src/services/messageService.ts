import { db } from '../database/connection.js';
import { Message, CreateMessageData } from '../models/Message.js';
import { authService } from './authService.js';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '..', '..', 'uploads');

export class MessageService {
  async createMessage(messageData: CreateMessageData): Promise<number> {
    const sql = `
      INSERT INTO messages (user_id, content, message_type, file_path, file_name, file_size, mime_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      const result = await db.query(sql, [
        messageData.user_id,
        messageData.content,
        messageData.message_type,
        messageData.file_path || null,
        messageData.file_name || null,
        messageData.file_size || null,
        messageData.mime_type || null
      ]);
      
      await authService.logUserActivity(
        messageData.user_id, 
        'message_sent', 
        `Отправлено сообщение типа: ${messageData.message_type}`
      );
      
      return result.insertId;
    } catch (error: any) {
      await authService.logSystemActivity('message_creation_failed', error.message);
      throw error;
    }
  }

  async getMessages(limit: number = 10, offset: number = 0): Promise<any[]> {
    try {
      const limitNum = Math.max(1, Math.min(100, parseInt(limit.toString(), 10)));
      const offsetNum = Math.max(0, parseInt(offset.toString(), 10));
      
      console.log('📨 Getting messages with limit:', limitNum, 'offset:', offsetNum);
      
      const sql = `
        SELECT m.*, u.username, ua.avatar_path 
        FROM messages m 
        LEFT JOIN users u ON m.user_id = u.id 
        LEFT JOIN user_avatars ua ON u.id = ua.user_id 
        ORDER BY m.created_at DESC 
        LIMIT ${limitNum} OFFSET ${offsetNum}
      `;
      
      console.log('🔍 SQL query:', sql);
      
      const messages = await db.query(sql);
      console.log('✅ Messages retrieved:', messages.length);
      
      return messages.reverse();
    } catch (error) {
      console.error('❌ Error in getMessages:', error);
      throw error;
    }
  }

  async getMessageById(id: number): Promise<Message | null> {
    const sql = `
      SELECT m.*, u.username, ua.avatar_path 
      FROM messages m 
      LEFT JOIN users u ON m.user_id = u.id 
      LEFT JOIN user_avatars ua ON u.id = ua.user_id 
      WHERE m.id = ?
    `;
    const messages = await db.query(sql, [id]);
    return messages.length > 0 ? messages[0] : null;
  }

  async saveFile(file: any, userId: number, fileType: string): Promise<string> {
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const userDir = path.join(uploadsDir, `user_${userId}`);
    await fs.mkdir(userDir, { recursive: true });
    
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(2, 8);
    
    let originalName: string;
    try {
      originalName = Buffer.from(file.originalname, 'binary').toString('utf8');
    } catch {
      originalName = file.originalname;
    }
    
    let fileExt = path.extname(originalName);
    if (!fileExt) {
      if (fileType === 'audio') fileExt = '.webm';
      else if (fileType === 'video') fileExt = '.webm';
      else fileExt = '.file';
    }
    
    const baseName = path.basename(originalName, fileExt);
    
    const safeBaseName = baseName.replace(/[^a-zA-Zа-яА-Я0-9._-]/g, '_');
    const safeFileName = `${safeBaseName}_${timestamp}_${randomString}${fileExt}`;
    const filePath = path.join(userDir, safeFileName);
    
    await fs.writeFile(filePath, file.buffer);
    
    console.log('💾 File saved:', `user_${userId}/${safeFileName}`);
    return `user_${userId}/${safeFileName}`;
  }

  async saveAvatar(file: any, userId: number): Promise<string> {
    await fs.mkdir(uploadsDir, { recursive: true });
    
    const avatarsDir = path.join(uploadsDir, 'avatars');
    await fs.mkdir(avatarsDir, { recursive: true });
    
    let originalName: string;
    try {
      originalName = Buffer.from(file.originalname, 'binary').toString('utf8');
    } catch {
      originalName = file.originalname;
    }
    
    const fileExt = path.extname(originalName) || '.jpg';
    const fileName = `avatar_${userId}${fileExt}`;
    const filePath = path.join(avatarsDir, fileName);
    
    await fs.writeFile(filePath, file.buffer);
    
    console.log('👤 Avatar saved:', `avatars/${fileName}`);
    return `avatars/${fileName}`;
  }

  async setUserAvatar(userId: number, avatarPath: string, mimeType: string, fileSize: number): Promise<boolean> {
    const sql = `
      INSERT INTO user_avatars (user_id, avatar_path, mime_type, file_size) 
      VALUES (?, ?, ?, ?) 
      ON DUPLICATE KEY UPDATE 
      avatar_path = VALUES(avatar_path), 
      mime_type = VALUES(mime_type), 
      file_size = VALUES(file_size),
      updated_at = CURRENT_TIMESTAMP
    `;
    
    try {
      const result = await db.query(sql, [userId, avatarPath, mimeType, fileSize]);
      await authService.logUserActivity(userId, 'avatar_updated', 'Аватар обновлен');
      return true;
    } catch (error: any) {
      await authService.logSystemActivity('avatar_update_failed', error.message);
      throw error;
    }
  }

  async getUserAvatar(userId: number): Promise<string | null> {
    const sql = 'SELECT avatar_path FROM user_avatars WHERE user_id = ?';
    const avatars = await db.query(sql, [userId]);
    return avatars.length > 0 ? avatars[0].avatar_path : null;
  }

  async getFile(fileName: string): Promise<Buffer> {
    const filePath = path.join(uploadsDir, fileName);
    console.log('📁 Looking for file:', filePath);
    
    try {
      await fs.access(filePath);
      console.log('✅ File found:', filePath);
    } catch (error) {
      console.error('❌ File not found:', filePath);
      throw new Error(`File not found: ${fileName}`);
    }
    
    return await fs.readFile(filePath);
  }

  getFileType(mimeType: string): 'image' | 'video' | 'audio' | 'file' {
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType.startsWith('video/')) return 'video';
    if (mimeType.startsWith('audio/')) return 'audio';
    return 'file';
  }

  async getFileInfo(fileName: string): Promise<{ size: number; mimeType: string }> {
    const filePath = path.join(uploadsDir, fileName);
    const stats = await fs.stat(filePath);
    
    let mimeType = 'application/octet-stream';
    if (fileName.endsWith('.webm')) mimeType = 'video/webm';
    else if (fileName.endsWith('.mp4')) mimeType = 'video/mp4';
    else if (fileName.endsWith('.mp3')) mimeType = 'audio/mpeg';
    else if (fileName.endsWith('.wav')) mimeType = 'audio/wav';
    else if (fileName.endsWith('.jpg') || fileName.endsWith('.jpeg')) mimeType = 'image/jpeg';
    else if (fileName.endsWith('.png')) mimeType = 'image/png';
    else if (fileName.endsWith('.gif')) mimeType = 'image/gif';
    
    return {
      size: stats.size,
      mimeType
    };
  }
}

export const messageService = new MessageService();