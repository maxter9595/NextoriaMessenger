'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import Link from 'next/link';

export default function RegisterPage() {
  const defaultAvatarUrl = `${process.env.BACKEND_URL}/uploads/avatars/default_avatar.png`;
  const router = useRouter();
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        alert('Пожалуйста, выберите изображение');
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) { // 5MB limit
        alert('Размер файла не должен превышать 5MB');
        return;
      }
      
      setAvatar(file);
      
      const reader = new FileReader();
      reader.onload = (e) => {
        setAvatarPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (formData.password.length < 6) {
      setError('Пароль должен быть не менее 6 символов');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Пароли не совпадают');
      setLoading(false);
      return;
    }

    try {
      const result = await apiClient.register(
        formData.username, 
        formData.email, 
        formData.password
      );
      
      if (result.success && result.sessionToken) {
        if (avatar) {
          try {
            await apiClient.uploadAvatar(avatar);
            console.log('✅ Аватар успешно загружен');
          } catch (avatarError) {
            console.error('Ошибка загрузки аватара:', avatarError);
          }
        }
        
        router.push('/chat');
      } else if (result.success) {
        router.push('/login?message=Регистрация успешна! Пожалуйста, войдите.');
      } else {
        setError(result.error || 'Ошибка регистрации');
      }
    } catch (error: any) {
      setError(error.message || 'Ошибка сети');
    } finally {
      setLoading(false);
    }
  };

  const removeAvatar = () => {
    setAvatar(null);
    setAvatarPreview(null);
    if (avatarInputRef.current) {
      avatarInputRef.current.value = '';
    }
  };

  return (
    <div style={{ 
      padding: '20px', 
      maxWidth: '400px', 
      margin: '50px auto',
      border: '1px solid #ddd',
      borderRadius: '8px',
      boxShadow: '0 2px 10px rgba(0,0,0,0.1)'
    }}>
      <h1 style={{ textAlign: 'center', marginBottom: '30px' }}>Регистрация</h1>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <div 
          onClick={() => avatarInputRef.current?.click()}
          style={{
            width: '100px',
            height: '100px',
            borderRadius: '50%',
            backgroundColor: avatarPreview ? 'transparent' : '#0070f3',
            margin: '0 auto 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            fontSize: '24px',
            overflow: 'hidden',
            border: '2px solid #ddd',
            backgroundImage: avatarPreview ? 'none' : `url(${defaultAvatarUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }}
        >
          {avatarPreview ? (
            <img 
              src={avatarPreview} 
              alt="Avatar preview" 
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            !defaultAvatarUrl && formData.username?.charAt(0).toUpperCase() || ''
          )}
        </div>
        
        <input
          type="file"
          ref={avatarInputRef}
          style={{ display: 'none' }}
          accept="image/*"
          onChange={handleAvatarChange}
        />
        
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
          <button
            type="button"
            onClick={() => avatarInputRef.current?.click()}
            style={{
              padding: '5px 10px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '12px'
            }}
          >
            {avatar ? 'Сменить' : 'Выбрать аватар'}
          </button>
          
          {avatar && (
            <button
              type="button"
              onClick={removeAvatar}
              style={{
                padding: '5px 10px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Удалить
            </button>
          )}
        </div>
        
        <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
          Необязательно (макс. 5MB)
        </div>
      </div>
      
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Имя пользователя:
          </label>
          <input
            type="text"
            name="username"
            value={formData.username}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            placeholder="Введите имя пользователя"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Email:
          </label>
          <input
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            required
            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            placeholder="Введите email"
          />
        </div>
        
        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Пароль:
          </label>
          <input
            type="password"
            name="password"
            value={formData.password}
            onChange={handleChange}
            required
            minLength={6}
            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            placeholder="Не менее 6 символов"
          />
        </div>

        <div style={{ marginBottom: '15px' }}>
          <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
            Подтвердите пароль:
          </label>
          <input
            type="password"
            name="confirmPassword"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
            minLength={6}
            style={{ width: '100%', padding: '10px', border: '1px solid #ccc', borderRadius: '4px' }}
            placeholder="Повторите пароль"
          />
        </div>
        
        {error && (
          <div style={{ 
            color: 'red', 
            marginBottom: '15px',
            padding: '10px',
            backgroundColor: '#fff0f0',
            border: '1px solid red',
            borderRadius: '4px'
          }}>
            {error}
          </div>
        )}
        
        <button 
          type="submit"
          disabled={loading}
          style={{ 
            width: '100%', 
            padding: '12px', 
            backgroundColor: '#28a745',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            fontSize: '16px',
            fontWeight: 'bold'
          }}
        >
          {loading ? 'Регистрация...' : 'Зарегистрироваться'}
        </button>
      </form>
      
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <span style={{ color: '#666' }}>Уже есть аккаунт? </span>
        <Link 
          href="/login" 
          style={{ color: '#0070f3', textDecoration: 'none', fontWeight: 'bold' }}
        >
          Войти
        </Link>
      </div>
    </div>
  );
}