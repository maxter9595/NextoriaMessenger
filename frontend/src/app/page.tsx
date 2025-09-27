'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(apiClient.getCurrentUser());

  useEffect(() => {
    const checkAuth = async () => {
      const validation = await apiClient.validateSession();
      setIsAuthenticated(validation.valid);
      if (!validation.valid) {
        localStorage.removeItem('sessionToken');
        localStorage.removeItem('user');
      } else if (validation.user) {
        setUser(validation.user);
        localStorage.setItem('user', JSON.stringify(validation.user));
      }
    };

    checkAuth();
  }, []);

  const handleNavigateToLogin = () => {
    router.push('/login');
  };

  const handleNavigateToChat = () => {
    router.push('/chat');
  };

  const handleLogout = async () => {
    await apiClient.logout();
    setIsAuthenticated(false);
    setUser(null);
    router.push('/');
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <h1>Добро пожаловать в мессенджер!</h1>
      
      {isAuthenticated ? (
        <div>
          <p>Вы авторизованы как: {user?.username} ({user?.role})</p>
          <button 
            onClick={handleNavigateToChat}
            style={{ padding: '10px 20px', margin: '10px', cursor: 'pointer' }}
          >
            Перейти в чат
          </button>
          <button 
            onClick={handleLogout}
            style={{ padding: '10px 20px', margin: '10px', cursor: 'pointer' }}
          >
            Выйти
          </button>
        </div>
      ) : (
        <div>
          <p>Пожалуйста, авторизуйтесь чтобы начать общение</p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <button 
              onClick={() => router.push('/login')}
              style={{ padding: '10px 20px', cursor: 'pointer' }}
            >
              Войти
            </button>
            <button 
              onClick={() => router.push('/register')}
              style={{ 
                padding: '10px 20px', 
                cursor: 'pointer',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none'
              }}
            >
              Зарегистрироваться
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
