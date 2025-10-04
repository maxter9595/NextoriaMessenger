'use client';

import { useState, useRef, useEffect } from 'react';

interface CodeEditorProps {
  onCodeSubmit: (formattedCode: string) => void;
  onCancel: () => void;
  initialCode?: string;
}

const languages = [
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'cpp', label: 'C++' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'sql', label: 'SQL' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'php', label: 'PHP' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'go', label: 'Go' },
  { value: 'rust', label: 'Rust' },
  { value: 'shell', label: 'Shell' },
  { value: 'yaml', label: 'YAML' },
  { value: 'markdown', label: 'Markdown' }
];

export default function CodeEditor({ onCodeSubmit, onCancel, initialCode = '' }: CodeEditorProps) {
  const [code, setCode] = useState(initialCode);
  const [language, setLanguage] = useState('javascript');
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  }, []);

  const handleSubmit = () => {
    if (code.trim()) {
      if (code.length > 10000) {
        alert('Код слишком большой. Пожалуйста, сократите его до 10000 символов.');
        return;
      }

      const trimmedCode = code.trim();
      const formattedCode = `\`\`\`${language}\n${trimmedCode}\n\`\`\``;
      
      console.log('📤 Inserting formatted code:', {
        content_length: formattedCode.length,
        language: language
      });
      
      onCodeSubmit(formattedCode);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab' && !e.shiftKey) {
      e.preventDefault();
      const start = textareaRef.current!.selectionStart;
      const end = textareaRef.current!.selectionEnd;
      
      const newCode = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newCode);
      
      setTimeout(() => {
        textareaRef.current!.selectionStart = textareaRef.current!.selectionEnd = start + 2;
      }, 0);
    }
    
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSubmit();
    }
    
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  const lineCount = code.split('\n').length;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
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
        maxWidth: '800px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <h3 style={{ margin: '0 0 15px 0' }}>Вставка кода</h3>
        
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold', fontSize: '14px' }}>
              Язык программирования:
            </label>
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              style={{
                padding: '8px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                minWidth: '150px'
              }}
            >
              {languages.map(lang => (
                <option key={lang.value} value={lang.value}>
                  {lang.label}
                </option>
              ))}
            </select>
          </div>
          
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <input
              type="checkbox"
              id="lineNumbers"
              checked={showLineNumbers}
              onChange={(e) => setShowLineNumbers(e.target.checked)}
            />
            <label htmlFor="lineNumbers" style={{ fontSize: '14px' }}>
              Нумерация строк
            </label>
          </div>
        </div>

        <div style={{
          flex: 1,
          display: 'flex',
          border: '1px solid #ccc',
          borderRadius: '4px',
          overflow: 'hidden',
          backgroundColor: '#1e1e1e',
          color: '#d4d4d4',
          fontFamily: 'Monaco, "Courier New", monospace',
          fontSize: '14px',
          lineHeight: '1.5'
        }}>
          {showLineNumbers && (
            <div style={{
              padding: '10px',
              backgroundColor: '#2d2d2d',
              color: '#858585',
              textAlign: 'right',
              userSelect: 'none',
              borderRight: '1px solid #444',
              minWidth: '50px'
            }}>
              {Array.from({ length: lineCount }, (_, i) => (
                <div key={i + 1}>{i + 1}</div>
              ))}
            </div>
          )}
          
          <textarea
            ref={textareaRef}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Введите ваш код здесь..."
            style={{
              flex: 1,
              padding: '10px',
              backgroundColor: 'transparent',
              color: '#d4d4d4',
              border: 'none',
              outline: 'none',
              resize: 'none',
              fontFamily: 'inherit',
              fontSize: 'inherit',
              lineHeight: 'inherit'
            }}
            rows={15}
          />
        </div>

        <div style={{
          fontSize: '12px',
          color: '#666',
          marginTop: '5px',
          marginBottom: '15px'
        }}>
          💡 Используйте Tab для отступа, Ctrl+Enter для вставки, Esc для отмены. 
          Код будет вставлен в формате: ```язык\nваш_код\n```
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
            disabled={!code.trim()}
            style={{
              padding: '8px 16px',
              backgroundColor: code.trim() ? '#28a745' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: code.trim() ? 'pointer' : 'not-allowed'
            }}
          >
            Вставить код
          </button>
        </div>
      </div>
    </div>
  );
}