import { db } from '../database/connection.js';
import { userService } from './userService.js';
import crypto from 'crypto';

export class AuthService {
  async login(username: string, password: string): Promise<{ success: boolean; sessionToken?: string; user?: any; error?: string }> {
    try {
      const user = await userService.getUserByUsername(username);
      
      if (!user) {
        await this.logSystemActivity('login_attempt', `Неудачная попытка входа: пользователь ${username} не найден`);
        return { success: false, error: 'Пользователь не найден' };
      }

      if (!user.is_active) {
        await this.logUserActivity(user.id, 'login_attempt', 'Попытка входа в деактивированную учетную запись');
        return { success: false, error: 'Учетная запись деактивирована' };
      }

      const isValidPassword = await userService.validatePassword(password, user.password_hash);
      
      if (!isValidPassword) {
        await this.logUserActivity(user.id, 'login_attempt', 'Неверный пароль при попытке входа');
        return { success: false, error: 'Неверный пароль' };
      }

      const sessionToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      const sql = `
        INSERT INTO sessions (user_id, session_token, expires_at) 
        VALUES (?, ?, ?)
      `;
      
      await db.query(sql, [user.id, sessionToken, expiresAt]);

      await this.logUserActivity(user.id, 'login_success', 'Успешный вход в систему');

      return { 
        success: true, 
        sessionToken,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role
        }
      };
    } catch (error) {
      console.error('Login error:', error);
      await this.logSystemActivity('login_error', `Ошибка при входе для пользователя ${username}: ${error.message}`);
      return { success: false, error: 'Ошибка при входе' };
    }
  }

  async logout(sessionToken: string): Promise<boolean> {
    try {
      const sessionInfo = await this.getSessionInfo(sessionToken);
      
      const sql = 'DELETE FROM sessions WHERE session_token = ?';
      const result = await db.query(sql, [sessionToken]);
      
      if (result.affectedRows > 0 && sessionInfo.userId) {
        await this.logUserActivity(sessionInfo.userId, 'logout', 'Выход из системы');
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Logout error:', error);
      await this.logSystemActivity('logout_error', `Ошибка при выходе: ${error.message}`);
      return false;
    }
  }

  async validateSession(sessionToken: string): Promise<{ valid: boolean; user?: any }> {
    try {
      const sql = `
        SELECT s.*, u.username, u.email, u.role, u.is_active 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.session_token = ? AND s.expires_at > NOW() AND u.is_active = TRUE
      `;
      
      const sessions = await db.query(sql, [sessionToken]);
      
      if (sessions.length === 0) {
        return { valid: false };
      }

      const session = sessions[0];
      
      await this.logUserActivity(session.user_id, 'session_validation', 'Успешная проверка сессии');
      
      return { 
        valid: true, 
        user: {
          id: session.user_id,
          username: session.username,
          email: session.email,
          role: session.role
        }
      };
    } catch (error) {
      console.error('Session validation error:', error);
      await this.logSystemActivity('session_validation_error', `Ошибка проверки сессии: ${error.message}`);
      return { valid: false };
    }
  }

  async cleanupExpiredSessions(): Promise<number> {
    try {
      const sql = 'DELETE FROM sessions WHERE expires_at <= NOW()';
      const result = await db.query(sql);
      
      if (result.affectedRows > 0) {
        await this.logSystemActivity('session_cleanup', `Удалено ${result.affectedRows} просроченных сессий`);
      }
      
      return result.affectedRows;
    } catch (error) {
      console.error('Session cleanup error:', error);
      return 0;
    }
  }

  async logUserActivity(userId: number, action: string, description: string, ipAddress?: string, userAgent?: string): Promise<void> {
    try {
      const sql = `
        INSERT INTO user_activity_log (user_id, action, description, ip_address, user_agent) 
        VALUES (?, ?, ?, ?, ?)
      `;
      await db.query(sql, [userId, action, description, ipAddress || null, userAgent || null]);
    } catch (error) {
      console.error('User activity log error:', error);
    }
  }

  async logSystemActivity(action: string, description: string): Promise<void> {
    try {
      const sql = `
        INSERT INTO user_activity_log (user_id, action, description) 
        VALUES (NULL, ?, ?)
      `;
      await db.query(sql, [action, description]);
    } catch (error) {
      console.error('System activity log error:', error);
    }
  }

  private async getSessionInfo(sessionToken: string): Promise<{ userId: number | null }> {
    try {
      const sql = 'SELECT user_id FROM sessions WHERE session_token = ?';
      const sessions = await db.query(sql, [sessionToken]);
      return { userId: sessions.length > 0 ? sessions[0].user_id : null };
    } catch (error) {
      return { userId: null };
    }
  }
}

export const authService = new AuthService();