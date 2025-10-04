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
    let content = messageData.content || '';
    
    if (messageData.file_path && !messageData.content) {
      content = messageData.file_name || 'Файл';
    }
    
    const sql = `
      INSERT INTO messages (user_id, content, message_type, language, file_path, file_name, file_size, mime_type) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    try {
      console.log('🔍 Creating message with data:', {
        user_id: messageData.user_id,
        content_length: content.length,
        message_type: messageData.message_type,
        language: messageData.language || null,
        file_path: messageData.file_path,
        file_name: messageData.file_name,
        file_size: messageData.file_size,
        mime_type: messageData.mime_type
      });
      
      const result = await db.query(sql, [
        messageData.user_id,
        content,
        messageData.message_type,
        messageData.language || null,
        messageData.file_path || null,
        messageData.file_name || null,
        messageData.file_size || 0,
        messageData.mime_type || null
      ]);
      
      await authService.logUserActivity(
        messageData.user_id, 
        'message_sent', 
        `Отправлено сообщение типа: ${messageData.message_type}`
      );
      
      return result.insertId;
    } catch (error: any) {
      console.error('❌ Database error in createMessage:', error);
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
      
      const processedMessages = messages.map(message => ({
        ...message,
        is_edited: message.is_edited === 1 || message.is_edited === true,
        file_size: message.file_size || 0,
        user_id: Number(message.user_id),
        id: Number(message.id)
      }));
      
      return processedMessages.reverse();
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
    
    if (messages.length > 0) {
      const message = messages[0];
      return {
        ...message,
        is_edited: message.is_edited === 1 || message.is_edited === true,
        file_size: message.file_size || 0,
        user_id: Number(message.user_id),
        id: Number(message.id)
      };
    }
    
    return null;
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

  async updateMessage(id: number, messageData: UpdateMessageData): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (messageData.content !== undefined) {
      updates.push('content = ?');
      params.push(messageData.content);
    }
    if (messageData.message_type !== undefined) {
      updates.push('message_type = ?');
      params.push(messageData.message_type);
    }
    updates.push('is_edited = TRUE');
    updates.push('updated_at = CURRENT_TIMESTAMP');

    if (updates.length === 0) return false;

    const sql = `UPDATE messages SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    try {
      const result = await db.query(sql, params);
      
      if (result.affectedRows > 0) {
        await authService.logUserActivity(
          (await this.getMessageById(id))?.user_id, 
          'message_updated', 
          `Сообщение ${id} обновлено, тип: ${messageData.message_type}`
        );
      }
      
      return result.affectedRows > 0;
    } catch (error: any) {
      await authService.logSystemActivity('message_update_failed', error.message);
      throw error;
    }
  }
  
  async deleteMessage(id: number): Promise<boolean> {
    try {
      const message = await this.getMessageById(id);
      const sql = 'DELETE FROM messages WHERE id = ?';
      const result = await db.query(sql, [id]);
      
      if (result.affectedRows > 0 && message) {
        await authService.logUserActivity(
          message.user_id, 
          'message_deleted', 
          `Сообщение ${id} удалено`
        );
        
        if (message.file_path) {
          try {
            const filePath = path.join(uploadsDir, message.file_path);
            await fs.unlink(filePath);
          } catch (fileError) {
            console.error('Error deleting file:', fileError);
          }
        }
      }
      
      return result.affectedRows > 0;
    } catch (error: any) {
      await authService.logSystemActivity('message_deletion_failed', error.message);
      throw error;
    }
  }

  async canEditMessage(messageId: number, userId: number): Promise<boolean> {
    try {
      const message = await this.getMessageById(messageId);
      return message?.user_id === userId;
    } catch (error) {
      return false;
    }
  }
}

export const messageService = new MessageService();