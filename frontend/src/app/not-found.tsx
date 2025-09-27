'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api';

export default function NotFound() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const validation = await apiClient.validateSession();
      setIsAuthenticated(validation.valid);
    };
    checkAuth();
  }, []);

  return (
    <div style={{ 
      padding: '40px 20px',
      textAlign: 'center',
      fontFamily: 'Arial, sans-serif',
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center'
    }}>
      <div style={{ marginBottom: '30px' }}>
        <h1 style={{ 
          fontSize: '120px', 
          fontWeight: 'bold', 
          color: '#e0e0e0',
          margin: 0,
          lineHeight: 1
        }}>
          404
        </h1>
        <h2 style={{ 
          fontSize: '32px', 
          color: '#333',
          margin: '10px 0'
        }}>
          Страница не найдена
        </h2>
        <p style={{ 
          fontSize: '18px', 
          color: '#666',
          maxWidth: '500px',
          lineHeight: 1.5
        }}>
          Извините, но страница, которую вы ищете, не существует или была перемещена.
        </p>
      </div>
      
      <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <Link 
          href="/"
          style={{
            padding: '12px 24px',
            backgroundColor: '#0070f3',
            color: 'white',
            textDecoration: 'none',
            borderRadius: '6px',
            fontWeight: 'bold',
            transition: 'background-color 0.2s'
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0056b3'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0070f3'}
        >
          На главную
        </Link>
        
        {isAuthenticated ? (
          <Link 
            href="/chat"
            style={{
              padding: '12px 24px',
              backgroundColor: '#28a745',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#1e7e34'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#28a745'}
          >
            Перейти в чат
          </Link>
        ) : (
          <Link 
            href="/login"
            style={{
              padding: '12px 24px',
              backgroundColor: '#6c757d',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '6px',
              fontWeight: 'bold',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#545b62'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#6c757d'}
          >
            Войти в систему
          </Link>
        )}
        
        <button 
          onClick={() => window.history.back()}
          style={{
            padding: '12px 24px',
            backgroundColor: 'transparent',
            color: '#0070f3',
            border: '1px solid #0070f3',
            borderRadius: '6px',
            fontWeight: 'bold',
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.backgroundColor = '#0070f3';
            e.currentTarget.style.color = 'white';
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent';
            e.currentTarget.style.color = '#0070f3';
          }}
        >
          Назад
        </button>
      </div>
      
      <div style={{ 
        marginTop: '40px',
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderRadius: '8px',
        maxWidth: '600px'
      }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#495057' }}>Возможные причины:</h3>
        <ul style={{ textAlign: 'left', color: '#666', margin: 0, paddingLeft: '20px' }}>
          <li>Неправильно набран адрес</li>
          <li>Страница была удалена или перемещена</li>
          <li>У вас нет доступа к этой странице</li>
        </ul>
      </div>
    </div>
  );
}