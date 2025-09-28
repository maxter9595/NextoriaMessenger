const API_BASE_URL = '/api';

export interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
  avatar_path?: string;
}

export interface AuthResponse {
  success: boolean;
  sessionToken?: string;
  user?: User;
  error?: string;
  message?: string;
  userId?: number;
}

export interface SessionValidation {
  valid: boolean;
  user?: User;
}

export interface Message {
  id: number;
  user_id: number;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: string;
  username: string;
  avatar_path: string;
}

export interface MessagesResponse {
  messages: Message[];
}

class ApiClient {
  private sessionToken: string | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.sessionToken = localStorage.getItem('sessionToken');
      console.log('🔌 API Client initialized, has token:', !!this.sessionToken);
    }
  }

  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    
    console.log('🌐 API Request:', { 
      url, 
      method: options.method,
      backendUrl: process.env.BACKEND_URL 
    });
    
    const config = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      ...options,
    };

    if (this.sessionToken) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${this.sessionToken}`,
      };
    }

    try {
      const response = await fetch(url, config);
      console.log('📡 API Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('API Error:', { status: response.status, errorText });
        
        try {
          const errorJson = JSON.parse(errorText);
          throw new Error(errorJson.error || `HTTP error! status: ${response.status}`);
        } catch {
          throw new Error(errorText || `HTTP error! status: ${response.status}`);
        }
      }
      
      const data = await response.json();
      console.log('📡 API Response data:', data);
      return data;
    } catch (error) {
      console.error('API Request failed:', error);
      throw error;
    }
  }

  async register(username: string, email: string, password: string): Promise<AuthResponse> {
    try {
      console.log('👤 Attempting registration for user:', username);
      
      const result = await this.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({ username, email, password }),
      });

      console.log('👤 Registration result:', result);

      if (result.success && result.sessionToken) {
        this.sessionToken = result.sessionToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sessionToken', result.sessionToken);
          if (result.user) {
            localStorage.setItem('user', JSON.stringify(result.user));
          }
          console.log('✅ Registration successful and user logged in');
        }
      }

      return result;
    } catch (error: any) {
      console.error('Registration error:', error);
      return { 
        success: false, 
        error: error.message || 'Network error' 
      };
    }
  }

  async login(username: string, password: string): Promise<AuthResponse> {
    try {
      console.log('🔐 Attempting login for user:', username);
      
      const result = await this.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });

      console.log('🔐 Login result:', result);

      if (result.success && result.sessionToken) {
        this.sessionToken = result.sessionToken;
        if (typeof window !== 'undefined') {
          localStorage.setItem('sessionToken', result.sessionToken);
          localStorage.setItem('user', JSON.stringify(result.user));
          console.log('✅ Session saved to localStorage');
        }
      }

      return result;
    } catch (error: any) {
      console.error('Login error:', error);
      return { 
        success: false, 
        error: error.message || 'Network error' 
      };
    }
  }

  async logout(): Promise<{ success: boolean }> {
    if (!this.sessionToken) {
      return { success: true };
    }

    try {
      const result = await this.request('/auth/logout', {
        method: 'POST',
        body: JSON.stringify({ sessionToken: this.sessionToken }),
      });

      if (result.success) {
        this.sessionToken = null;
        if (typeof window !== 'undefined') {
          localStorage.removeItem('sessionToken');
          localStorage.removeItem('user');
        }
      }

      return result;
    } catch (error) {
      console.error('Logout error:', error);
      return { success: false };
    }
  }

  async validateSession(): Promise<SessionValidation> {
    if (!this.sessionToken) {
      console.log('❌ No session token available');
      return { valid: false };
    }

    try {
      console.log('🔍 Validating session...');
      const result = await this.request('/auth/validate', {
        method: 'POST',
        body: JSON.stringify({ sessionToken: this.sessionToken }),
      });
      console.log('🔍 Session validation result:', result);
      return result;
    } catch (error) {
      console.error('Session validation error:', error);
      return { valid: false };
    }
  }

  async getUsers(params?: string): Promise<{ users: User[], pagination?: any }> {
    try {
      const result = await this.request('/users');
      return result;
    } catch (error: any) {
      console.error('Get users error:', error);
      throw error;
    }
  }

  async createAdmin(userData: {
    username: string;
    email: string;
    password: string;
    role: 'admin';
  }): Promise<{ success: boolean; userId?: number; error?: string }> {
    try {
      const result = await this.request('/users', {
        method: 'POST',
        body: JSON.stringify(userData),
      });
      return result;
    } catch (error: any) {
      console.error('Create admin error:', error);
      throw error;
    }
  }

  async toggleUserActive(userId: number, isActive: boolean): Promise<{ success: boolean }> {
    try {
      const result = await this.request(`/users/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: isActive }),
      });
      return result;
    } catch (error: any) {
      console.error('Toggle user active error:', error);
      throw error;
    }
  }

  async changeUserPassword(userId: number, newPassword: string): Promise<{ success: boolean }> {
    try {
      const result = await this.request(`/users/${userId}/password`, {
        method: 'PATCH',
        body: JSON.stringify({ password: newPassword }),
      });
      return result;
    } catch (error: any) {
      console.error('Change password error:', error);
      throw error;
    }
  }

  async getMessages(limit: number = 10, offset: number = 0): Promise<MessagesResponse> {
    try {
      const result = await this.request(`/messages?limit=${limit}&offset=${offset}`);
      return result;
    } catch (error: any) {
      console.error('Get messages error:', error);
      throw error;
    }
  }

  async sendMessage(messageData: {
    content: string;
    message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
    file?: File;
  }): Promise<{ success: boolean; message?: Message }> {
    try {
      const formData = new FormData();
      formData.append('content', messageData.content);
      formData.append('message_type', messageData.message_type);
      
      if (messageData.file) {
        formData.append('file', messageData.file);
      }

      const result = await fetch(`${API_BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
        },
        body: formData,
      });

      if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      return await result.json();
    } catch (error: any) {
      console.error('Send message error:', error);
      throw error;
    }
  }

  async uploadAvatar(file: File): Promise<{ success: boolean; avatarPath: string }> {
    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const result = await fetch(`${API_BASE_URL}/messages/avatar`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.sessionToken}`,
        },
        body: formData,
      });

      if (!result.ok) {
        throw new Error(`HTTP error! status: ${result.status}`);
      }

      return await result.json();
    } catch (error: any) {
      console.error('Upload avatar error:', error);
      throw error;
    }
  }

  getCurrentUser(): User | null {
    if (typeof window === 'undefined') return null;
    
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return this.sessionToken !== null;
  }

  getFileUrl(filename: string): string {
    return `${API_BASE_URL}/messages/file/${filename}`;
  }

  getAvatarUrl(filename: string): string {
    return `${API_BASE_URL}/messages/avatar/${filename}`;
  }
}

export const apiClient = new ApiClient();