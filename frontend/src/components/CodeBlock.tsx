'use client';

import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { dracula } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface CodeBlockProps {
  content: string;
}

interface CodeSegment {
  code: string;
  language: string;
  startIndex: number;
  endIndex: number;
  fullMatch: string;
}

export default function CodeBlock({ content }: CodeBlockProps) {
  console.log('🔍 CodeBlock received content:', content);

  const extractCodeBlocks = (text: string): CodeSegment[] => {
    const blocks: CodeSegment[] = [];
    
    const codeBlockRegex = /```(\w+)?\r?\n([\s\S]*?)```/g;
    
    let match;
    while ((match = codeBlockRegex.exec(text)) !== null) {
      const language = match[1] || 'text';
      const code = match[2].trimEnd();
      blocks.push({
        code,
        language,
        startIndex: match.index,
        endIndex: match.index + match[0].length,
        fullMatch: match[0]
      });
    }
    
    return blocks;
  };

  const splitContent = (text: string): Array<{ type: 'text' | 'code'; content: string; language?: string }> => {
    const blocks = extractCodeBlocks(text);
    const result: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
    
    if (blocks.length === 0) {
      return [{ type: 'text', content: text }];
    }
    
    let lastIndex = 0;
    
    blocks.forEach(block => {
      if (block.startIndex > lastIndex) {
        const textBefore = text.slice(lastIndex, block.startIndex);
        if (textBefore.trim() !== '') {
          result.push({ type: 'text', content: textBefore });
        }
      }
      
      result.push({ 
        type: 'code', 
        content: block.code,
        language: block.language
      });
      
      lastIndex = block.endIndex;
    });
    
    if (lastIndex < text.length) {
      const textAfter = text.slice(lastIndex);
      if (textAfter.trim() !== '') {
        result.push({ type: 'text', content: textAfter });
      }
    }
    
    return result;
  };

  const contentParts = splitContent(content);

  return (
    <div style={{ 
      wordBreak: 'break-word', 
      overflowWrap: 'break-word', 
      whiteSpace: 'pre-wrap',
      lineHeight: '1.4'
    }}>
      {contentParts.map((part, index) => {
        if (part.type === 'text') {
          const isLink = /https?:\/\/[^\s]+/.test(part.content);
          
          if (isLink) {
            const parts = part.content.split(/(https?:\/\/[^\s]+)/g);
            return (
              <div key={index} style={{ 
                marginBottom: '4px',
                wordBreak: 'break-all',
                whiteSpace: 'pre-wrap'
              }}>
                {parts.map((textPart, textIndex) => 
                  textPart.match(/https?:\/\/[^\s]+/) ? (
                    <a 
                      key={textIndex}
                      href={textPart} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ 
                        color: '#0070f3', 
                        textDecoration: 'underline',
                        wordBreak: 'break-all'
                      }}
                    >
                      {textPart}
                    </a>
                  ) : (
                    <span key={textIndex}>{textPart}</span>
                  )
                )}
              </div>
            );
          }
          
          return (
            <div key={index} style={{ 
              marginBottom: '4px',
              whiteSpace: 'pre-wrap'
            }}>
              {part.content}
            </div>
          );
        } else {
          return (
            <div 
              key={index}
              style={{ 
                borderRadius: '8px',
                overflow: 'hidden',
                margin: '4px 0',
                border: '1px solid #444'
              }}
            >
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: '6px 10px',
                backgroundColor: '#2d2d2d',
                borderBottom: '1px solid #444',
                fontSize: '10px'
              }}>
                <span style={{
                  color: '#858585',
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  fontWeight: 'bold'
                }}>
                  {part.language || 'text'}
                </span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(part.content);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#858585',
                    cursor: 'pointer',
                    fontSize: '10px',
                    padding: '2px 6px',
                    borderRadius: '3px',
                    transition: 'all 0.2s'
                  }}
                  title="Копировать код"
                >
                  📋
                </button>
              </div>
              
              <SyntaxHighlighter
                language={part.language || 'text'}
                style={dracula}
                showLineNumbers
                wrapLines
                customStyle={{
                  margin: 0,
                  borderRadius: 0,
                  fontSize: '12px',
                  lineHeight: '1.3',
                  fontFamily: 'Monaco, "Courier New", monospace',
                  padding: '8px'
                }}
                codeTagProps={{
                  style: {
                    fontFamily: 'inherit'
                  }
                }}
              >
                {part.content}
              </SyntaxHighlighter>
            </div>
          );
        }
      })}
    </div>
  );
}