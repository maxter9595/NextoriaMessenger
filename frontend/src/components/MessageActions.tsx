'use client';

import { useRef, useEffect } from 'react';

interface MessageActionsProps {
  messageId: number;
  isOwnMessage: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
  position: { x: number; y: number };
}

export default function MessageActions({ 
  messageId, 
  isOwnMessage, 
  onEdit, 
  onDelete, 
  onClose,
  position 
}: MessageActionsProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const adjustedPosition = {
    left: Math.min(position.x, window.innerWidth - 150),
    top: Math.min(position.y, window.innerHeight - 120)
  };

  if (!isOwnMessage) {
    return null;
  }

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: adjustedPosition.left,
        top: adjustedPosition.top,
        backgroundColor: 'white',
        border: '1px solid #ddd',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
        zIndex: 1000,
        minWidth: '120px',
        padding: '5px 0'
      }}
    >
      <button
        onClick={onEdit}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#f5f5f5'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        ✏️ Редактировать
      </button>
      
      <button
        onClick={onDelete}
        style={{
          width: '100%',
          padding: '8px 12px',
          backgroundColor: 'transparent',
          border: 'none',
          textAlign: 'left',
          cursor: 'pointer',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          color: '#dc3545'
        }}
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#fff0f0'}
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
      >
        🗑️ Удалить
      </button>
    </div>
  );
}
