'use client';

import { useState, useEffect, useRef } from 'react';
import { Message } from '@/lib/api';

interface MessageEditorProps {
  message: Message;
  onSave: (content: string) => void;
  onCancel: () => void;
}

export default function MessageEditor({ message, onSave, onCancel }: MessageEditorProps) {
  const [content, setContent] = useState(message.content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(content.length, content.length);
    }
  }, []);

  const handleSubmit = () => {
    if (content.trim() && content !== message.content) {
      onSave(content);
    } else {
      onCancel();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  const normalizeSpacing = (text: string): string => {
    return text;
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        backgroundColor: 'white',
        padding: '20px',
        borderRadius: '12px',
        width: '90%',
        maxWidth: '600px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Редактирование сообщения</h3>
        
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          marginBottom: '15px'
        }}>
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={handleKeyDown}
            style={{
              width: '100%',
              flex: 1,
              minHeight: '200px',
              padding: '12px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              resize: 'vertical',
              fontFamily: 'monospace',
              fontSize: '14px',
              lineHeight: '1.4',
              whiteSpace: 'pre-wrap'
            }}
            placeholder="Введите текст сообщения..."
          />
        </div>
        
        <div style={{
          fontSize: '12px',
          color: '#666',
          marginBottom: '15px',
          padding: '8px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px'
        }}>
          💡 <strong>Ctrl+Enter</strong> для сохранения, <strong>Esc</strong> для отмены<br/>
          💡 Сохраняются все пробелы и переносы строк
        </div>

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '8px 16px',
              backgroundColor: '#6c757d',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Отмена
          </button>
          <button
            onClick={handleSubmit}
            disabled={!content.trim() || content === message.content}
            style={{
              padding: '8px 16px',
              backgroundColor: (!content.trim() || content === message.content) ? '#ccc' : '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: (!content.trim() || content === message.content) ? 'not-allowed' : 'pointer'
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
}