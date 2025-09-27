'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';

interface User {
  id: number;
  username: string;
  email: string;
  role: 'admin' | 'user';
  is_active: boolean;
  created_at: string;
}

type UserRoleFilter = 'all' | 'admin' | 'user';
type UserStatusFilter = 'all' | 'active' | 'inactive';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(apiClient.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [error, setError] = useState('');
  const [formLoading, setFormLoading] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<UserStatusFilter>('all');

  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const checkAuth = async () => {
      const validation = await apiClient.validateSession();
      if (!validation.valid) {
        router.push('/login');
      } else if (validation.user?.role !== 'admin') {
        router.push('/chat');
      } else {
        setUser(validation.user);
        setLoading(false);
        loadUsers();
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    let filtered = users;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.id.toString().includes(term) ||
        user.username.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(user => 
        statusFilter === 'active' ? user.is_active : !user.is_active
      );
    }

    setFilteredUsers(filtered);
  }, [users, searchTerm, roleFilter, statusFilter]);

  const loadUsers = async () => {
    try {
      setError('');
      const response = await apiClient.getUsers();
      if (response && response.users) {
        setUsers(response.users);
      }
    } catch (error: any) {
      console.error("Error loading users:", error);
      setError('Ошибка загрузки пользователей');
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!formData.username.trim()) {
      errors.username = 'Имя пользователя обязательно';
    } else if (formData.username.length < 3) {
      errors.username = 'Имя пользователя должно быть не менее 3 символов';
    }

    if (!formData.email.trim()) {
      errors.email = 'Email обязателен';
    } else if (!emailRegex.test(formData.email)) {
      errors.email = 'Некорректный формат email';
    }

    if (!formData.password) {
      errors.password = 'Пароль обязателен';
    } else if (formData.password.length < 6) {
      errors.password = 'Пароль должен содержать минимум 6 символов';
    }

    if (!formData.confirmPassword) {
      errors.confirmPassword = 'Подтверждение пароля обязательно';
    } else if (formData.password !== formData.confirmPassword) {
      errors.confirmPassword = 'Пароли не совпадают';
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setFormLoading(true);

    try {
      await apiClient.createAdmin({
        username: formData.username,
        email: formData.email,
        password: formData.password,
        role: 'admin'
      });
      
      setShowCreateForm(false);
      setFormData({ username: '', email: '', password: '', confirmPassword: '' });
      await loadUsers();
      alert('Администратор успешно создан');
    } catch (error: any) {
      alert(error.message || 'Ошибка создания администратора');
    } finally {
      setFormLoading(false);
    }
  };

  const canEditUser = (targetUser: User) => {
    if (targetUser.id === user?.id) {
      return true;
    }
    
    if (targetUser.role === 'admin') {
      return false;
    }
    
    return true;
  };

  const canToggleActive = (targetUser: User) => {
    if (targetUser.id === user?.id) {
      return false;
    }
    
    if (targetUser.role === 'admin') {
      return false;
    }
    
    return true;
  };

  const handleToggleActive = async (targetUser: User) => {
    if (!canToggleActive(targetUser)) {
      if (targetUser.id === user?.id) {
        alert('Нельзя деактивировать самого себя');
      } else {
        alert('Нельзя изменять статус администратора');
      }
      return;
    }

    try {
      const result = await apiClient.toggleUserActive(targetUser.id, !targetUser.is_active);
      if (result.success) {
        await loadUsers();
        alert(`Пользователь ${targetUser.is_active ? 'деактивирован' : 'активирован'} успешно`);
      } else {
        alert('Ошибка изменения статуса пользователя');
      }
    } catch (error: any) {
      console.error('Error toggling user active status:', error);
      alert(error.message || 'Ошибка изменения статуса пользователя');
    }
  };
  
  const handleChangePassword = async (targetUser: User) => {
    if (!canEditUser(targetUser)) {
      alert('Нельзя изменять пароль администратора');
      return;
    }

    const newPassword = prompt('Введите новый пароль:');
    if (!newPassword) return;

    if (newPassword.length < 6) {
      alert('Пароль должен быть не менее 6 символов');
      return;
    }

    try {
      setFormLoading(true);
      const result = await apiClient.changeUserPassword(targetUser.id, newPassword);
      if (result.success) {
        alert('Пароль успешно изменен');
      } else {
        alert('Ошибка изменения пароля');
      }
    } catch (error: any) {
      console.error('Error changing password:', error);
      alert(error.message || 'Ошибка изменения пароля');
    } finally {
      setFormLoading(false);
    }
  };

  const handleLogout = async () => {
    await apiClient.logout();
    router.push('/');
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    setFormErrors(prev => ({
      ...prev,
      [field]: ''
    }));
  };

  const clearFilters = () => {
    setSearchTerm('');
    setRoleFilter('all');
    setStatusFilter('all');
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Загрузка...</div>;
  }

  return (
    <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1>Панель администратора</h1>
          <p>Пользователь: {user?.username} ({user?.role})</p>
        </div>
        <div>
          <button 
            onClick={() => router.push('/chat')}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              marginRight: '10px'
            }}
          >
            Перейти в чат
          </button>
          <button 
            onClick={handleLogout}
            style={{
              padding: '8px 16px',
              backgroundColor: '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Выйти
          </button>
        </div>
      </div>

      {/* Кнопка создания администратора */}
      {!showCreateForm && (
        <div style={{ marginBottom: '20px' }}>
          <button 
            onClick={() => setShowCreateForm(true)}
            style={{
              padding: '10px 20px',
              backgroundColor: '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Создать администратора
          </button>
        </div>
      )}

      {/* Сообщения об ошибках */}
      {error && (
        <div style={{ 
          color: 'red', 
          padding: '10px', 
          backgroundColor: '#fff0f0',
          border: '1px solid red',
          borderRadius: '4px',
          marginBottom: '20px'
        }}>
          {error}
        </div>
      )}

      {/* Форма создания администратора */}
      {showCreateForm && (
        <form onSubmit={handleCreateAdmin} style={{ 
          border: '1px solid #ddd', 
          padding: '20px', 
          borderRadius: '8px',
          backgroundColor: '#f9f9f9',
          marginBottom: '30px'
        }}>
          <h3 style={{ marginTop: 0 }}>Создание администратора</h3>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Имя пользователя *
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => handleInputChange('username', e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: formErrors.username ? '1px solid red' : '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            {formErrors.username && (
              <span style={{ color: 'red', fontSize: '14px' }}>{formErrors.username}</span>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Email *
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => handleInputChange('email', e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: formErrors.email ? '1px solid red' : '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            {formErrors.email && (
              <span style={{ color: 'red', fontSize: '14px' }}>{formErrors.email}</span>
            )}
          </div>

          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Пароль *
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => handleInputChange('password', e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: formErrors.password ? '1px solid red' : '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            {formErrors.password && (
              <span style={{ color: 'red', fontSize: '14px' }}>{formErrors.password}</span>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Подтверждение пароля *
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => handleInputChange('confirmPassword', e.target.value)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: formErrors.confirmPassword ? '1px solid red' : '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
            {formErrors.confirmPassword && (
              <span style={{ color: 'red', fontSize: '14px' }}>{formErrors.confirmPassword}</span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              disabled={formLoading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: formLoading ? 'not-allowed' : 'pointer',
                opacity: formLoading ? 0.6 : 1
              }}
            >
              {formLoading ? 'Создание...' : 'Создать администратора'}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreateForm(false);
                setFormData({ username: '', email: '', password: '', confirmPassword: '' });
                setFormErrors({});
              }}
              style={{
                padding: '10px 20px',
                backgroundColor: '#6c757d',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer'
              }}
            >
              Отмена
            </button>
          </div>
        </form>
      )}

      {/* Панель фильтрации */}
      <div style={{ 
        border: '1px solid #ddd', 
        padding: '20px', 
        borderRadius: '8px',
        backgroundColor: '#f9f9f9',
        marginBottom: '20px'
      }}>
        <h3 style={{ marginTop: 0, marginBottom: '15px' }}>Фильтры</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '15px', marginBottom: '15px' }}>
          {/* Поиск по ID, имени и email */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Поиск (ID, Имя, Email)
            </label>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Введите для поиска..."
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            />
          </div>

          {/* Фильтр по роли */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Роль
            </label>
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRoleFilter)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            >
              <option value="all">Все пользователи</option>
              <option value="admin">Только администраторы</option>
              <option value="user">Только обычные пользователи</option>
            </select>
          </div>

          {/* Фильтр по статусу */}
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
              Статус
            </label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as UserStatusFilter)}
              style={{ 
                width: '100%', 
                padding: '8px', 
                border: '1px solid #ccc',
                borderRadius: '4px'
              }}
            >
              <option value="all">Все статусы</option>
              <option value="active">Только активные</option>
              <option value="inactive">Только неактивные</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: '#666' }}>
            Найдено пользователей: {filteredUsers.length} из {users.length}
          </span>
          <button
            onClick={clearFilters}
            style={{
              padding: '6px 12px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '14px'
            }}
          >
            Сбросить фильтры
          </button>
        </div>
      </div>

      {/* Таблица пользователей */}
      <div>
        <div style={{ marginBottom: '20px' }}>
          <h3>Управление пользователями</h3>
        </div>

        {filteredUsers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
            {users.length === 0 ? 'Пользователи не найдены' : 'Пользователи не найдены по заданным фильтрам'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ 
              width: '100%', 
              borderCollapse: 'collapse',
              backgroundColor: 'white',
              minWidth: '800px'
            }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5' }}>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Имя пользователя</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Email</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Роль</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Статус</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Дата регистрации</th>
                  <th style={{ padding: '12px', border: '1px solid #ddd', textAlign: 'left' }}>Действия</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map((userItem) => (
                  <tr key={userItem.id} style={{ 
                    backgroundColor: userItem.role === 'admin' ? '#fff3cd' : 'white'
                  }}>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{userItem.id}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                      {userItem.username}
                      {userItem.id === user?.id && (
                        <span style={{ 
                          marginLeft: '8px',
                          padding: '2px 6px', 
                          backgroundColor: '#0070f3',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '10px'
                        }}>
                          Вы
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>{userItem.email}</td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        backgroundColor: userItem.role === 'admin' ? '#0070f3' : '#28a745',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {userItem.role === 'admin' ? 'Администратор' : 'Пользователь'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                      <span style={{ 
                        padding: '4px 8px', 
                        borderRadius: '4px',
                        backgroundColor: userItem.is_active ? '#28a745' : '#dc3545',
                        color: 'white',
                        fontSize: '12px'
                      }}>
                        {userItem.is_active ? 'Активен' : 'Неактивен'}
                      </span>
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                      {new Date(userItem.created_at).toLocaleDateString('ru-RU')}
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        <button
                          onClick={() => handleToggleActive(userItem)}
                          disabled={formLoading || !canToggleActive(userItem)}
                          title={!canToggleActive(userItem) ? 
                            (userItem.id === user?.id ? 'Нельзя деактивировать самого себя' : 'Нельзя изменять статус администратора') : ''}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: userItem.is_active ? '#ffc107' : '#28a745',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: (formLoading || !canToggleActive(userItem)) ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            opacity: (formLoading || !canToggleActive(userItem)) ? 0.5 : 1
                          }}
                        >
                          {userItem.is_active ? 'Деактивировать' : 'Активировать'}
                        </button>
                        
                        <button
                          onClick={() => handleChangePassword(userItem)}
                          disabled={formLoading || !canEditUser(userItem)}
                          title={!canEditUser(userItem) ? 'Нельзя изменять пароль администратора' : ''}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#17a2b8',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: (formLoading || !canEditUser(userItem)) ? 'not-allowed' : 'pointer',
                            fontSize: '12px',
                            opacity: (formLoading || !canEditUser(userItem)) ? 0.5 : 1
                          }}
                        >
                          Сменить пароль
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}