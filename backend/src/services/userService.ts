import { db } from '../database/connection.js';
import { User, CreateUserData, UpdateUserData } from '../models/User.js';
import bcrypt from 'bcryptjs';
import { authService } from './authService.js';

export class UserService {
  async createUser(userData: CreateUserData): Promise<number> {
    const passwordHash = await bcrypt.hash(userData.password, 10);
    
    const sql = `
      INSERT INTO users (username, email, password_hash, role, is_active) 
      VALUES (?, ?, ?, ?, ?)
    `;
    
    try {
      const result = await db.query(sql, [
        userData.username,
        userData.email,
        passwordHash,
        userData.role || 'user',
        true
      ]);
      
      await authService.logSystemActivity('user_created', `Создан новый пользователь: ${userData.username} (${userData.email})`);
      
      return result.insertId;
    } catch (error: any) {
      await authService.logSystemActivity('user_creation_failed', `Ошибка создания пользователя ${userData.username}: ${error.message}`);
      throw error;
    }
  }

  async updateUser(id: number, userData: UpdateUserData): Promise<boolean> {
    const updates: string[] = [];
    const params: any[] = [];

    if (userData.username !== undefined) {
      updates.push('username = ?');
      params.push(userData.username);
    }
    if (userData.email !== undefined) {
      updates.push('email = ?');
      params.push(userData.email);
    }
    if (userData.is_active !== undefined) {
      updates.push('is_active = ?');
      params.push(userData.is_active);
    }

    if (updates.length === 0) return false;

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    params.push(id);

    try {
      const result = await db.query(sql, params);
      
      if (result.affectedRows > 0) {
        const action = userData.is_active !== undefined ? 
          (userData.is_active ? 'user_activated' : 'user_deactivated') : 'user_updated';
        
        await authService.logUserActivity(id, action, `Обновление данных пользователя`);
      }
      
      return result.affectedRows > 0;
    } catch (error: any) {
      await authService.logSystemActivity('user_update_failed', `Ошибка обновления пользователя ${id}: ${error.message}`);
      throw error;
    }
  }

  async deactivateUser(id: number): Promise<boolean> {
    try {
      const sql = 'UPDATE users SET is_active = FALSE WHERE id = ?';
      const result = await db.query(sql, [id]);
      
      if (result.affectedRows > 0) {
        await authService.logUserActivity(id, 'user_deactivated', 'Деактивация учетной записи');
      }
      
      return result.affectedRows > 0;
    } catch (error: any) {
      await authService.logSystemActivity('user_deactivation_failed', `Ошибка деактивации пользователя ${id}: ${error.message}`);
      throw error;
    }
  }

  async activateUser(id: number): Promise<boolean> {
    try {
      const sql = 'UPDATE users SET is_active = TRUE WHERE id = ?';
      const result = await db.query(sql, [id]);
      
      if (result.affectedRows > 0) {
        await authService.logUserActivity(id, 'user_activated', 'Активация учетной записи');
      }
      
      return result.affectedRows > 0;
    } catch (error: any) {
      await authService.logSystemActivity('user_activation_failed', `Ошибка активации пользователя ${id}: ${error.message}`);
      throw error;
    }
  }

  async changePassword(userId: number, newPassword: string): Promise<boolean> {
    try {
      const passwordHash = await bcrypt.hash(newPassword, 10);
      const sql = 'UPDATE users SET password_hash = ? WHERE id = ?';
      const result = await db.query(sql, [passwordHash, userId]);
      
      if (result.affectedRows > 0) {
        await authService.logUserActivity(userId, 'password_changed', 'Смена пароля');
      }
      
      return result.affectedRows > 0;
    } catch (error: any) {
      await authService.logSystemActivity('password_change_failed', `Ошибка смены пароля для пользователя ${userId}: ${error.message}`);
      throw error;
    }
  }

  async deleteUser(id: number): Promise<boolean> {
    try {
      const user = await this.getUserById(id);
      const sql = 'DELETE FROM users WHERE id = ?';
      const result = await db.query(sql, [id]);
      
      if (result.affectedRows > 0) {
        await authService.logSystemActivity('user_deleted', `Удален пользователь: ${user?.username} (ID: ${id})`);
      }
      
      return result.affectedRows > 0;
    } catch (error: any) {
      await authService.logSystemActivity('user_deletion_failed', `Ошибка удаления пользователя ${id}: ${error.message}`);
      throw error;
    }
  }

  async getUserById(id: number): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE id = ?';
    const users = await db.query(sql, [id]);
    return users.length > 0 ? users[0] : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE username = ?';
    const users = await db.query(sql, [username]);
    return users.length > 0 ? users[0] : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const sql = 'SELECT * FROM users WHERE email = ?';
    const users = await db.query(sql, [email]);
    return users.length > 0 ? users[0] : null;
  }

  async validatePassword(plainPassword: string, hashedPassword: string): Promise<boolean> {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  async getAllUsers(): Promise<User[]> {
    const sql = 'SELECT id, username, email, role, is_active, created_at FROM users ORDER BY created_at DESC';
    return await db.query(sql);
  }
}

export const userService = new UserService();
