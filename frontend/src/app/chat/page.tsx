'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(apiClient.getCurrentUser());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      const validation = await apiClient.validateSession();
      if (!validation.valid) {
        router.push('/login');
      } else {
        setUser(validation.user || apiClient.getCurrentUser());
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const handleLogout = async () => {
    await apiClient.logout();
    router.push('/');
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Загрузка...</div>;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>Чат</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span>Пользователь: {user?.username} ({user?.role})</span>
          
          {isAdmin && (
            <button 
              onClick={() => router.push('/admin')}
              style={{ 
                padding: '5px 10px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Админка
            </button>
          )}
          
          <button 
            onClick={handleLogout}
            style={{ padding: '5px 10px', marginLeft: '10px' }}
          >
            Выйти
          </button>
        </div>
      </div>
      
      <div style={{ 
        border: '1px solid #ccc', 
        height: '400px', 
        padding: '20px',
        marginTop: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ textAlign: 'center' }}>
          <h2>Это страница чата</h2>
          <p>Функционал чата будет добавлен позже</p>
        </div>
      </div>
    </div>
  );
}