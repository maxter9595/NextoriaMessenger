'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient, Message } from '@/lib/api';
import EmojiPicker from '@/components/EmojiPicker';
import CodeEditor from '@/components/CodeEditor';
import MessageActions from '@/components/MessageActions';
import MessageEditor from '@/components/MessageEditor';
import CodeBlock from '@/components/CodeBlock';

const SCROLL_THRESHOLD = 100;
const SCROLL_BUFFER = 50;

interface RecordingState {
  isRecording: boolean;
  type: 'audio' | 'video';
  startTime: number;
  timer: number;
  isPaused: boolean;
  recordedChunks: Blob[];
  previewUrl?: string;
}

export default function ChatPage() {
  const router = useRouter();
  const [user, setUser] = useState(apiClient.getCurrentUser());
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);
  const [recording, setRecording] = useState<RecordingState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [userAvatar, setUserAvatar] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showRecordingPreview, setShowRecordingPreview] = useState(false);
  const [recordingType, setRecordingType] = useState<'audio' | 'video' | null>(null);

  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Message | null>(null);
  const [messageActions, setMessageActions] = useState<{
    messageId: number;
    isOwnMessage: boolean;
    position: { x: number; y: number };
  } | null>(null);
  const [fileWithText, setFileWithText] = useState<{
    file: File;
    text: string;
    messageType: 'image' | 'video' | 'audio' | 'file';
  } | null>(null);
  const [editingFileMessage, setEditingFileMessage] = useState<{
    messageId: number;
    currentText: string;
    fileInfo: any;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewAudioRef = useRef<HTMLAudioElement>(null);
  const recordingStateRef = useRef<RecordingState | null>(null);

  const handleMessageDoubleClick = (message: Message, event: React.MouseEvent) => {
    const isOwnMessage = message.user_id === user?.id;
    
    if (isOwnMessage) {
      if (message.message_type !== 'text' && message.message_type !== 'code') {
        setEditingFileMessage({
          messageId: message.id,
          currentText: message.content !== message.file_name ? message.content : '',
          fileInfo: message
        });
      } else {
        setMessageActions({
          messageId: message.id,
          isOwnMessage,
          position: { x: event.clientX, y: event.clientY }
        });
      }
    }
  };

  const handleEditMessage = async (messageId: number, newContent: string) => {
    try {
      const hasCodeBlocks = newContent.includes('```');
      const messageType = hasCodeBlocks ? 'code' : 'text';
      
      console.log('✏️ Editing message:', {
        messageId,
        content_length: newContent.length,
        message_type: messageType,
        has_code_blocks: hasCodeBlocks
      });

      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ 
          content: newContent,
          message_type: messageType
        })
      });

      if (response.ok) {
        await loadMessages();
        setEditingMessage(null);
      } else {
        throw new Error('Failed to update message');
      }
    } catch (error) {
      console.error('Error editing message:', error);
      alert('Ошибка при редактировании сообщения');
    }
  };

  const handleDeleteMessage = async (messageId: number) => {
    if (!confirm('Вы уверены, что хотите удалить это сообщение?')) {
      return;
    }

    try {
      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        }
      });

      if (response.ok) {
        await loadMessages();
        setMessageActions(null);
      } else {
        throw new Error('Failed to delete message');
      }
    } catch (error) {
      console.error('Error deleting message:', error);
      alert('Ошибка при удалении сообщения');
    }
  };

  const handleCodeSubmit = (formattedCode: string) => {
    setNewMessage(prev => prev + (prev ? '\n\n' : '') + formattedCode);
    setShowCodeEditor(false);
  };

  const handleFileUploadWithText = (file: File, text: string = '') => {
    let messageType: 'image' | 'video' | 'audio' | 'file' = 'file';
    
    if (file.type.startsWith('image/')) messageType = 'image';
    else if (file.type.startsWith('video/')) messageType = 'video';
    else if (file.type.startsWith('audio/')) messageType = 'audio';

    setFileWithText({
      file,
      text,
      messageType
    });
  };

  const handleFileWithTextSubmit = async () => {
    if (!fileWithText) return;

    try {
      const content = fileWithText.text.trim() === '' 
        ? fileWithText.file.name 
        : fileWithText.text;

      console.log('📤 Sending file with text:', {
        file: fileWithText.file.name,
        content: content,
        content_length: content.length,
        has_custom_text: fileWithText.text.trim() !== ''
      });

      await apiClient.sendMessage({
        content: content,
        message_type: fileWithText.messageType,
        file: fileWithText.file
      });

      setFileWithText(null);
      await loadMessages();
    } catch (error) {
      console.error('❌ Error sending file with text:', error);
      alert('Ошибка при отправке файла с текстом');
    }
  };

  const handleFileUpload = async (file: File) => {
    try {
      let messageType: 'image' | 'video' | 'audio' | 'file' = 'file';
      
      if (file.type.startsWith('image/')) messageType = 'image';
      else if (file.type.startsWith('video/')) messageType = 'video';
      else if (file.type.startsWith('audio/')) messageType = 'audio';

      handleFileUploadWithText(file, '');
      
    } catch (error) {
      console.error('Error uploading file:', error);
      alert('Ошибка при загрузке файла');
    }
  };

  const handleEditFileMessage = async (messageId: number, newText: string) => {
    try {
      const content = newText.trim() === '' 
        ? editingFileMessage?.fileInfo.file_name || 'Файл'
        : newText;

      console.log('✏️ Editing file message:', {
        messageId,
        newContent: content,
        has_custom_text: newText.trim() !== ''
      });

      const response = await fetch(`/api/messages/${messageId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('sessionToken')}`
        },
        body: JSON.stringify({ content: content })
      });

      if (response.ok) {
        await loadMessages();
        setEditingFileMessage(null);
      } else {
        throw new Error('Failed to update message');
      }
    } catch (error) {
      console.error('❌ Error editing file message:', error);
      alert('Ошибка при редактировании сообщения');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = async (loadMore: boolean = false) => {
    try {
      if (loadMore) {
        setLoadingMore(true);
        
        const container = messagesContainerRef.current;
        if (container) {
          const previousHeight = container.scrollHeight;
          const currentScrollTop = container.scrollTop;
          
          saveScrollPosition();
          
          const currentOffset = offset + 10;
          const response = await apiClient.getMessages(10, currentOffset);
          
          if (response.messages && response.messages.length > 0) {
            setMessages(prev => [...response.messages, ...prev]);
            setOffset(currentOffset);
            setHasMore(response.messages.length === 10);
            
            requestAnimationFrame(() => {
              restoreScrollPosition(previousHeight);
              setLoadingMore(false);
            });
          } else {
            setLoadingMore(false);
          }
        }
      } else {
        setLoading(true);
        const currentOffset = 0;
        const response = await apiClient.getMessages(10, currentOffset);
        
        if (response.messages) {
          setMessages(response.messages);
          setOffset(0);
          setHasMore(response.messages.length === 10);
        }
        setLoading(false);
      }
    } catch (error) {
      console.error('Error loading messages:', error);
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const calculateScrollPosition = (messageId: number) => {
    const container = messagesContainerRef.current;
    if (!container) return 0;
    
    const messageElement = container.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
      const messageRect = messageElement.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      return messageRect.top - containerRect.top + container.scrollTop;
    }
    
    return 0;
  };

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      const saved = sessionStorage.getItem('scrollPosition');
      if (saved) {
        const { top, height } = JSON.parse(saved);
        const heightDiff = container.scrollHeight - height;
        if (Math.abs(heightDiff) > 10) {
          container.scrollTop = top + heightDiff;
        }
      }
    });

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      const validation = await apiClient.validateSession();
      if (!validation.valid) {
        router.push('/login');
      } else {
        const currentUser = validation.user || apiClient.getCurrentUser();
        setUser(currentUser);
        
        if (currentUser?.avatar_path) {
          setUserAvatar(currentUser.avatar_path);
        }
        
        setLoading(false);
        await loadMessages();
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const loadUserAvatar = async () => {
      if (user?.id) {
        setUserAvatar(user.avatar_path || null);
      }
    };
    
    loadUserAvatar();
  }, [user]);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showPreview) {
        cancelRecording();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [showPreview]);

  const handleSendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      await apiClient.sendMessage({
        content: newMessage,
        message_type: 'text'
      });
      setNewMessage('');
      await loadMessages();
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('Пожалуйста, выберите изображение');
      return;
    }

    try {
      const result = await apiClient.uploadAvatar(file);
      
      setUserAvatar(result.avatarPath);
      
      const currentUser = apiClient.getCurrentUser();
      if (currentUser) {
        const updatedUser = { 
          ...currentUser, 
          avatar_path: result.avatarPath 
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        setUser(updatedUser);
      }
      
      await loadMessages();
      
      alert('Аватар успешно обновлен');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      alert(error.message || 'Ошибка загрузки аватара');
    }
  };

  const startRecording = async (type: 'audio' | 'video') => {
    try {
      console.log('🎬 Starting recording:', type);
      
      if (showPreview) {
        setShowPreview(false);
      }
      if (recording?.previewUrl) {
        URL.revokeObjectURL(recording.previewUrl);
      }

      if (mediaRecorderRef.current && recording?.isRecording) {
        mediaRecorderRef.current.stop();
        cleanupMedia();
      }

      setRecordingType(type);
      setShowRecordingPreview(true);

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video' ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false
      });

      streamRef.current = stream;
      recordedChunksRef.current = [];

      const recordingState: RecordingState = {
        isRecording: true,
        type,
        startTime: Date.now(),
        timer: 0,
        isPaused: false,
        recordedChunks: [],
        previewUrl: undefined
      };

      recordingStateRef.current = recordingState;
      setRecording(recordingState);

      if (type === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.style.transform = 'scaleX(-1)';
        videoPreviewRef.current.play().catch(console.error);
      } else if (type === 'audio') {
        console.log('🔊 Starting audio visualization immediately...');
        visualizeAudio(stream);
      }

      const options = {
        audioBitsPerSecond: 128000,
        videoBitsPerSecond: type === 'video' ? 2500000 : 0,
        mimeType: 'video/webm;codecs=vp8,opus'
      };

      const mediaRecorder = new MediaRecorder(stream, options);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { 
          type: type === 'audio' ? 'audio/webm' : 'video/webm' 
        });
        const previewUrl = URL.createObjectURL(blob);
        
        setRecording(prev => prev ? { ...prev, previewUrl } : null);
        setShowPreview(true);
      };

      mediaRecorder.start(1000);

      const timerInterval = setInterval(() => {
        setRecording(prev => {
          if (!prev?.isRecording) {
            clearInterval(timerInterval);
            return prev;
          }
          return {
            ...prev,
            timer: Math.floor((Date.now() - prev.startTime) / 1000)
          };
        });
      }, 1000);

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Ошибка доступа к медиаустройствам. Проверьте разрешения.');
    }
  };

  const cleanupMedia = () => {
    console.log('🧹 Cleaning up media...');
    recordingStateRef.current = null;
    
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
      videoPreviewRef.current.pause();
    }
    
    const audioPreview = document.getElementById('audio-preview-container');
    if (audioPreview) {
      audioPreview.innerHTML = '';
    }
    
    setShowRecordingPreview(false);
  };

  const visualizeAudio = (stream: MediaStream) => {
    console.log('🎨 Starting audio visualization with stream:', stream);
    
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      console.log('🔊 Audio context created');
      
      const source = audioContext.createMediaStreamSource(stream);
      console.log('🔊 Audio source created');
      
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8;
      
      source.connect(analyser);
      console.log('🔊 Source connected to analyser');
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      console.log('🔊 Buffer length:', bufferLength);
      
      const canvas = document.createElement('canvas');
      canvas.width = 400;
      canvas.height = 120;
      canvas.style.cssText = `
        width: 100%;
        max-width: 400px;
        height: 120px;
        border-radius: 12px;
        background: linear-gradient(135deg, #1a1a2e, #16213e);
        margin: 10px auto;
        display: block;
        border: 2px solid #444;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
      `;
      
      const canvasContainer = document.getElementById('audio-preview-container');
      if (canvasContainer) {
        canvasContainer.innerHTML = '';
        
        const header = document.createElement('div');
        header.style.cssText = `
          color: #fff;
          text-align: center;
          font-size: 16px;
          margin-bottom: 10px;
          font-family: Arial, sans-serif;
          font-weight: bold;
          text-shadow: 0 2px 4px rgba(0,0,0,0.5);
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 10px;
        `;
        
        const timerSpan = document.createElement('span');
        timerSpan.id = 'audio-timer';
        
        header.innerHTML = '🎤 Запись аудио';
        header.appendChild(timerSpan);
        canvasContainer.appendChild(header);
        canvasContainer.appendChild(canvas);
        
        const levelContainer = document.createElement('div');
        levelContainer.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          margin-top: 10px;
          color: #fff;
          font-size: 12px;
        `;
        
        const levelText = document.createElement('span');
        levelText.textContent = '🔊 Уровень:';
        
        const levelBar = document.createElement('div');
        levelBar.style.cssText = `
          width: 200px;
          height: 8px;
          background: #333;
          border-radius: 4px;
          overflow: hidden;
        `;
        
        const levelFill = document.createElement('div');
        levelFill.id = 'audio-level-fill';
        levelFill.style.cssText = `
          width: 0%;
          height: 100%;
          background: linear-gradient(90deg, #00b4db, #0083b0);
          border-radius: 4px;
          transition: width 0.1s ease;
        `;
        
        levelBar.appendChild(levelFill);
        levelContainer.appendChild(levelText);
        levelContainer.appendChild(levelBar);
        canvasContainer.appendChild(levelContainer);
      }
      
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        console.error('❌ Could not get canvas context');
        return;
      }
      
      const draw = () => {
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
        gradient.addColorStop(0, '#1a1a2e');
        gradient.addColorStop(1, '#16213e');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        
        for (let i = 0; i <= canvas.height; i += 20) {
          ctx.beginPath();
          ctx.moveTo(0, i);
          ctx.lineTo(canvas.width, i);
          ctx.stroke();
        }
        
        for (let i = 0; i <= canvas.width; i += 40) {
          ctx.beginPath();
          ctx.moveTo(i, 0);
          ctx.lineTo(i, canvas.height);
          ctx.stroke();
        }
        
        const barWidth = (canvas.width / bufferLength) * 2.5;
        let x = 0;
        
        for (let i = 0; i < bufferLength; i++) {
          const value = dataArray[i];
          const percent = value / 255;
          
          const barHeight = percent * (canvas.height - 20);
          
          let color;
          if (percent > 0.8) {
            color = '#ff6b6b';
          } else if (percent > 0.5) {
            color = '#ffd93d';
          } else if (percent > 0.2) {
            color = '#6bcf7f';
          } else {
            color = '#4d96ff';
          }
          
          ctx.fillStyle = color;
          ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
          
          ctx.fillStyle = `rgba(77, 150, 255, ${percent * 0.3})`;
          ctx.fillRect(x, canvas.height, barWidth - 1, barHeight * 0.3);
          
          x += barWidth + 1;
        }
        
        const levelFill = document.getElementById('audio-level-fill');
        if (levelFill) {
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            sum += dataArray[i];
          }
          const average = sum / bufferLength;
          const levelPercent = (average / 255) * 100;
          
          levelFill.style.width = `${Math.min(levelPercent, 100)}%`;
          
          if (levelPercent > 80) {
            levelFill.style.background = 'linear-gradient(90deg, #ff6b6b, #ff0000)';
          } else if (levelPercent > 50) {
            levelFill.style.background = 'linear-gradient(90deg, #ffd93d, #ff6b6b)';
          } else {
            levelFill.style.background = 'linear-gradient(90deg, #00b4db, #0083b0)';
          }
        }
        
        const timerElement = document.getElementById('audio-timer');
        if (timerElement && recording) {
          const minutes = Math.floor(recording.timer / 60);
          const seconds = recording.timer % 60;
          timerElement.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        requestAnimationFrame(draw);
      };
      
      console.log('🎨 Starting visualization animation...');
      draw();
      
    } catch (error) {
      console.error('❌ Error in audio visualization:', error);
      
      const canvasContainer = document.getElementById('audio-preview-container');
      if (canvasContainer) {
        canvasContainer.innerHTML = `
          <div style="color: #fff; text-align: center; padding: 20px;">
            <div style="font-size: 24px; margin-bottom: 10px;">🎤</div>
            <div style="font-size: 14px; color: #ff6b6b;">Ошибка визуализации звука</div>
            <div style="font-size: 12px; color: #ccc; margin-top: 5px;">Проверьте разрешения микрофона</div>
          </div>
        `;
      }
    }
  };

  const togglePauseRecording = () => {
    if (!mediaRecorderRef.current || !recording) return;

    if (recording.isPaused) {
      mediaRecorderRef.current.resume();
      setRecording(prev => prev ? { ...prev, isPaused: false } : null);
    } else {
      mediaRecorderRef.current.pause();
      setRecording(prev => prev ? { ...prev, isPaused: true } : null);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && recording?.isRecording) {
      mediaRecorderRef.current.stop();
      cleanupMedia();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && recording?.isRecording) {
      mediaRecorderRef.current.stop();
    }
    
    cleanupMedia();
    
    if (recording?.previewUrl) {
      URL.revokeObjectURL(recording.previewUrl);
    }
    
    setRecording(null);
    setShowPreview(false);
    setShowRecordingPreview(false);
    recordedChunksRef.current = [];
  };

  const sendRecording = async () => {
    if (!recording?.previewUrl) return;

    try {
      const blob = new Blob(recordedChunksRef.current, { 
        type: recording.type === 'audio' ? 'audio/webm' : 'video/webm' 
      });
      
      const fileName = `recording_${Date.now()}.webm`;
      const file = new File([blob], fileName, {
        type: recording.type === 'audio' ? 'audio/webm' : 'video/webm'
      });

      await handleFileUpload(file);
      
      if (recording.previewUrl) {
        URL.revokeObjectURL(recording.previewUrl);
      }
      
      setRecording(null);
      setShowPreview(false);
      setShowRecordingPreview(false);
      recordedChunksRef.current = [];
      
    } catch (error) {
      console.error('❌ Ошибка загрузки записи:', error);
      alert('Ошибка загрузки записи');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    files.forEach(file => {
      handleFileUploadWithText(file, '');
    });
  };
  
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    
    const scrollTop = container.scrollTop;
    const scrollHeight = container.scrollHeight;
    const clientHeight = container.clientHeight;
    
    const currentScrollInfo = {
      scrollTop,
      scrollHeight,
      clientHeight,
      timestamp: Date.now()
    };
    sessionStorage.setItem('currentScrollInfo', JSON.stringify(currentScrollInfo));
    
    if (scrollTop <= SCROLL_THRESHOLD && 
        !loadingMore && 
        hasMore) {
      loadMessages(true);
    }
  }, [loadingMore, hasMore, loadMessages]);

  const isNearBottom = (container: HTMLDivElement, threshold: number = 200) => {
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight < threshold;
  };

  const saveScrollPosition = () => {
    const container = messagesContainerRef.current;
    if (container) {
      const currentMessage = messages[0];
      const scrollPosition = {
        top: container.scrollTop,
        height: container.scrollHeight,
        firstMessageId: currentMessage?.id,
        timestamp: Date.now()
      };
      sessionStorage.setItem('scrollPosition', JSON.stringify(scrollPosition));
    }
  };

  const restoreScrollPosition = (previousHeight: number) => {
    const container = messagesContainerRef.current;
    if (!container) return;

    const saved = sessionStorage.getItem('scrollPosition');
    if (saved) {
      const { top, height, firstMessageId } = JSON.parse(saved);
      const heightDiff = container.scrollHeight - previousHeight;
      
      let newScrollTop = top + heightDiff;
      
      if (firstMessageId) {
        setTimeout(() => {
          const targetElement = container.querySelector(`[data-message-id="${firstMessageId}"]`);
          if (targetElement) {
            const targetRect = targetElement.getBoundingClientRect();
            const containerRect = container.getBoundingClientRect();
            const targetPosition = targetRect.top - containerRect.top + container.scrollTop;
            
            if (targetPosition > 0) {
              newScrollTop = targetPosition - 50;
            }
          }
          
          container.scrollTo({
            top: newScrollTop,
            behavior: 'auto'
          });
        }, 0);
      } else {
        container.scrollTop = newScrollTop;
      }
    }
    
    sessionStorage.removeItem('scrollPosition');
    sessionStorage.removeItem('currentScrollInfo');
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

const renderMessageContent = (message: Message) => {
    console.log('🔍 Rendering message:', {
      id: message.id,
      message_type: message.message_type,
      content: message.content,
      has_code_blocks: message.content.includes('```')
    });

    const shouldRenderAsCode = message.message_type === 'code' || message.content.includes('```');
    console.log('🔍 Should render as code:', shouldRenderAsCode);
    
    if (shouldRenderAsCode) {
      console.log('🔍 Rendering as code block');
      return (
        <div style={{ margin: '10px 0' }}> {/* Уменьшаем отступы */}
          <CodeBlock content={message.content} />
          
          {message.is_edited && (
            <div style={{
              fontSize: '10px',
              color: '#666',
              fontStyle: 'italic'
            }}>
              (ред.)
            </div>
          )}
        </div>
      );
    }

    const isLink = /https?:\/\/[^\s]+/.test(message.content);
    if (isLink) {
        const parts = message.content.split(/(https?:\/\/[^\s]+)/g);
        return (
          <div>
            {parts.map((part, index) => 
              part.match(/https?:\/\/[^\s]+/) ? (
                <a 
                  key={index}
                  href={part} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  style={{ 
                    color: '#ffffffff', 
                    textDecoration: 'underline',
                    wordBreak: 'break-all'
                  }}
                >
                  {part}
                </a>
              ) : (
                <span key={index} style={{ wordBreak: 'break-word' }}>{part}</span>
              )
            )}
            {message.is_edited && (
              <div style={{
                fontSize: '10px',
                color: '#666',
                marginTop: '5px',
                fontStyle: 'italic'
              }}>
                (ред.)
              </div>
            )}
          </div>
        );
      }

    if (message.message_type === 'text') {
      return (
        <div>
          <div style={{ 
            wordBreak: 'break-word', 
            overflowWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            lineHeight: '1'
          }}>
            {message.content}
          </div>
          {message.is_edited && (
            <div style={{
              fontSize: '10px',
              color: '#666',
              marginTop: '5px',
              fontStyle: 'italic'
            }}>
              (ред.)
            </div>
          )}
        </div>
      );
    }

    if (message.message_type === 'image') {
      return (
        <div>
          <img 
            src={apiClient.getFileUrl(message.file_path)} 
            alt={message.file_name}
            style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px' }}
          />
          {/* Текст под изображением - показываем только если отличается от имени файла и не пустой */}
          {message.content && message.content !== message.file_name && message.content.trim() !== '' && (
            <div style={{ 
              fontSize: '14px', 
              color: message.user_id === user?.id ? 'rgba(255,255,255,0.9)' : '#333',
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: message.user_id === user?.id ? 'rgba(255,255,255,0.1)' : '#f5f5f5',
              borderRadius: '6px',
              wordBreak: 'break-word'
            }}>
              {message.content}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            {message.file_name} ({formatFileSize(message.file_size)})
            {message.is_edited && (
              <span style={{fontStyle: 'italic', marginLeft: '5px'}}>(ред.)</span>
            )}
          </div>
        </div>
      );
    }

    if (message.message_type === 'video') {
      return (
        <div>
          <video 
            controls 
            style={{ maxWidth: '300px', maxHeight: '300px', borderRadius: '8px' }}
          >
            <source src={apiClient.getFileUrl(message.file_path)} type={message.mime_type} />
          </video>
          {/* Текст под видео */}
          {message.content && message.content !== message.file_name && (
            <div style={{ 
              fontSize: '14px', 
              color: message.user_id === user?.id ? 'rgba(255,255,255,0.9)' : '#333',
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: message.user_id === user?.id ? 'rgba(255,255,255,0.1)' : '#f5f5f5',
              borderRadius: '6px',
              wordBreak: 'break-word'
            }}>
              {message.content}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            {message.is_edited && (
              <span style={{fontStyle: 'italic', marginLeft: '5px'}}>(ред.)</span>
            )}
          </div>
        </div>
      );
    }

    if (message.message_type === 'audio') {
      return (
        <div>
          <audio controls style={{ width: '300px' }}>
            <source src={apiClient.getFileUrl(message.file_path)} type={message.mime_type} />
          </audio>
          {/* Текст под аудио */}
          {message.content && message.content !== message.file_name && (
            <div style={{ 
              fontSize: '14px', 
              color: message.user_id === user?.id ? 'rgba(255,255,255,0.9)' : '#333',
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: message.user_id === user?.id ? 'rgba(255,255,255,0.1)' : '#f5f5f5',
              borderRadius: '6px',
              wordBreak: 'break-word'
            }}>
              {message.content}
            </div>
          )}
          <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
            {message.file_name} ({formatFileSize(message.file_size)})
            {message.is_edited && (
              <span style={{fontStyle: 'italic', marginLeft: '5px'}}>(ред.)</span>
            )}
          </div>
        </div>
      );
    }

    if (message.message_type === 'file') {
      return (
        <div>
          <a 
            href={apiClient.getFileUrl(message.file_path)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ 
              display: 'inline-block', 
              padding: '10px', 
              backgroundColor: '#f5f5f5',
              borderRadius: '4px',
              textDecoration: 'none',
              color: '#333',
              border: '1px solid #ddd'
            }}
          >
            📎 {message.file_name} ({formatFileSize(message.file_size)})
          </a>
          {/* Текст под файлом */}
          {message.content && message.content !== message.file_name && (
            <div style={{ 
              fontSize: '14px', 
              color: message.user_id === user?.id ? 'rgba(255,255,255,0.9)' : '#333',
              marginTop: '8px',
              padding: '8px 12px',
              backgroundColor: message.user_id === user?.id ? 'rgba(255,255,255,0.1)' : '#f5f5f5',
              borderRadius: '6px',
              wordBreak: 'break-word'
            }}>
              {message.content}
            </div>
          )}
          {message.is_edited && (
            <div style={{
              fontSize: '10px',
              color: '#666',
              marginTop: '5px',
              fontStyle: 'italic'
            }}>
              (ред.)
            </div>
          )}
        </div>
      );
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    setNewMessage(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const handleLogout = async () => {
    await apiClient.logout();
    router.push('/');
  };

  if (loading) {
    return <div style={{ padding: '20px' }}>Загрузка...</div>;
  }

  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ 
      height: '100vh', 
      display: 'flex', 
      flexDirection: 'column',
      backgroundColor: '#f0f2f5'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '15px 20px', 
        backgroundColor: 'white',
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>💬 Мессенджер</h1>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {userAvatar ? (
              <img 
                src={apiClient.getAvatarUrl(userAvatar)} 
                alt="Avatar"
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%',
                  cursor: 'pointer'
                }}
                onClick={() => avatarInputRef.current?.click()}
              />
            ) : (
              <div 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  borderRadius: '50%',
                  backgroundColor: '#0070f3',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontWeight: 'bold',
                  cursor: 'pointer'
                }}
                onClick={() => avatarInputRef.current?.click()}
              >
                {user?.username?.charAt(0).toUpperCase()}
              </div>
            )}
            
            <input
              type="file"
              ref={avatarInputRef}
              style={{ display: 'none' }}
              accept="image/*"
              onChange={(e) => {
                if (e.target.files?.[0]) {
                  handleAvatarUpload(e.target.files[0]);
                }
              }}
            />
            
            <div>
              <div style={{ fontWeight: 'bold' }}>{user?.username}</div>
              <div style={{ fontSize: '12px', color: '#666' }}>{user?.role}</div>
            </div>
          </div>
          
          {isAdmin && (
            <button 
              onClick={() => router.push('/admin')}
              style={{ 
                padding: '8px 16px',
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

      {/* Video & Audio Preview During Recording */}
      {showRecordingPreview && recordingType && (
        <>
          {recordingType === 'video' && (
            <div style={{
              padding: '10px',
              backgroundColor: '#000',
              textAlign: 'center',
              borderBottom: '1px solid #333'
            }}>
              <video
                ref={videoPreviewRef}
                muted
                autoPlay
                style={{
                  maxWidth: '300px',
                  maxHeight: '200px',
                  borderRadius: '8px'
                }}
              />
              <div style={{ color: 'white', fontSize: '12px', marginTop: '5px' }}>
                🔴 Прямой эфир - предпросмотр записи
              </div>
            </div>
          )}

          {recordingType === 'audio' && (
            <div style={{
              padding: '10px',
              backgroundColor: '#000',
              textAlign: 'center',
              borderBottom: '1px solid #333'
            }}>
              <div id="audio-preview-container" style={{ padding: '10px' }}>
                <div style={{ color: 'white', fontSize: '14px', marginBottom: '10px' }}>
                  🎤 Запуск визуализатора звука...
                </div>
              </div>
              <div style={{ color: 'white', fontSize: '12px', marginTop: '5px' }}>
                Визуализатор звука активен - вы видите как звучите в реальном времени
              </div>
            </div>
          )}
        </>
      )}

      {/* Preview Modal After Recording */}
      {showPreview && recording?.previewUrl && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '12px',
            maxWidth: '90%',
            maxHeight: '90%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center'
          }}>
            <h3 style={{ margin: '0 0 20px 0' }}>
              Предпросмотр {recording.type === 'audio' ? 'аудио' : 'видео'} записи
            </h3>
            
            {recording.type === 'video' ? (
              <video
                ref={previewVideoRef}
                controls
                autoPlay
                style={{
                  maxWidth: '600px',
                  maxHeight: '400px',
                  borderRadius: '8px',
                  marginBottom: '20px'
                }}
                src={recording.previewUrl}
              />
            ) : (
              <div style={{ marginBottom: '20px', textAlign: 'center' }}>
                <audio
                  ref={previewAudioRef}
                  controls
                  autoPlay
                  style={{
                    width: '400px',
                    marginBottom: '10px'
                  }}
                  src={recording.previewUrl}
                />
                <div style={{ 
                  fontSize: '14px', 
                  color: '#666',
                  marginTop: '10px'
                }}>
                  🎧 Прослушайте запись перед отправкой
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={sendRecording}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#28a745',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ✅ Отправить в чат
              </button>
              
              <button
                onClick={cancelRecording}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                ❌ Удалить запись
              </button>
              
              <button
                onClick={() => {
                  setShowPreview(false);
                  if (recording.previewUrl) {
                    URL.revokeObjectURL(recording.previewUrl);
                  }
                  startRecording(recording.type);
                }}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontWeight: 'bold'
                }}
              >
                🔄 Записать заново
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{ 
          flex: 1,
          padding: '20px',
          overflowY: 'auto',
          backgroundColor: isDragging ? '#e3f2fd' : 'transparent',
          border: isDragging ? '2px dashed #2196f3' : 'none',
          transition: 'all 0.3s ease',
          scrollBehavior: 'smooth'
        }}
      >
        {loadingMore && (
          <div style={{ 
            textAlign: 'center', 
            padding: '10px', 
            color: '#666',
            backgroundColor: '#f5f5f5',
            borderRadius: '8px',
            margin: '10px 0'
          }}>
            ⏳ Загрузка предыдущих сообщений...
          </div>
        )}
                
        {messages.map((message) => (
          <div 
            key={message.id}
            data-message-id={message.id}
            style={{ 
              marginBottom: '15px',
              display: 'flex',
              flexDirection: message.user_id === user?.id ? 'row-reverse' : 'row',
              alignItems: 'flex-start',
              gap: '10px'
            }}
            onDoubleClick={(e) => handleMessageDoubleClick(message, e)}
          >
            
            {/* Avatar */}
            <div style={{ flexShrink: 0 }}>
              {message.avatar_path ? (
                <img 
                  src={apiClient.getAvatarUrl(message.avatar_path)} 
                  alt={message.username}
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%' 
                  }}
                />
              ) : (
                <div 
                  style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '50%',
                    backgroundColor: message.user_id === user?.id ? '#0070f3' : '#28a745',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'white',
                    fontWeight: 'bold'
                  }}
                >
                  {message.username?.charAt(0).toUpperCase()}
                </div>
              )}
            </div>

            {/* Message Content */}
            <div style={{ 
              maxWidth: '70%',
              backgroundColor: message.user_id === user?.id ? '#0070f3' : 'white',
              color: message.user_id === user?.id ? 'white' : 'black',
              padding: '10px 15px',
              borderRadius: '18px',
              boxShadow: '0 1px 2px rgba(0,0,0,0.1)'
            }}>
              <div style={{ 
                fontSize: '12px', 
                marginBottom: '5px',
                opacity: 0.8
              }}>
                {message.username}
              </div>
              
              {renderMessageContent(message)}
              
              <div style={{ 
                fontSize: '10px', 
                textAlign: 'right',
                marginTop: '5px',
                opacity: 0.7
              }}>
                {new Date(message.created_at).toLocaleTimeString('ru-RU', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          </div>
        ))}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Code Editor Modal */}
      {showCodeEditor && (
        <CodeEditor
          onCodeSubmit={handleCodeSubmit}
          onCancel={() => setShowCodeEditor(false)}
        />
      )}

      {/* Message Actions Menu */}
      {messageActions && (
        <MessageActions
          messageId={messageActions.messageId}
          isOwnMessage={messageActions.isOwnMessage}
          onEdit={() => {
            const message = messages.find(m => m.id === messageActions.messageId);
            if (message) {
              setEditingMessage(message);
              setMessageActions(null);
            }
          }}
          onDelete={() => handleDeleteMessage(messageActions.messageId)}
          onClose={() => setMessageActions(null)}
          position={messageActions.position}
        />
      )}

      {/* Message Editor Modal */}
      {editingMessage && (
        <MessageEditor
          message={editingMessage}
          onSave={(content) => handleEditMessage(editingMessage.id, content)}
          onCancel={() => setEditingMessage(null)}
        />
      )}

      {/* File with Text Modal */}
      {fileWithText && (
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
            maxWidth: '500px'
          }}>
            <h3 style={{ margin: '0 0 15px 0' }}>
              {fileWithText.messageType === 'audio' ? 'Добавьте описание к аудиозаписи' :
              fileWithText.messageType === 'video' ? 'Добавьте описание к видео' :
              fileWithText.messageType === 'image' ? 'Добавьте описание к изображению' :
              'Добавьте описание к файлу'}
            </h3>
            
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div><strong>Файл:</strong> {fileWithText.file.name}</div>
              <div><strong>Тип:</strong> {
                fileWithText.messageType === 'image' ? '🖼️ Изображение' :
                fileWithText.messageType === 'video' ? '🎥 Видео' :
                fileWithText.messageType === 'audio' ? '🎵 Аудио' : '📎 Файл'
              }</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                💡 Описание необязательно. Если оставить пустым, будет показано только имя файла.
              </div>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Описание {fileWithText.messageType === 'audio' || fileWithText.messageType === 'video' ? 'записи' : 'файла'}:
              </label>
              <textarea
                value={fileWithText.text}
                onChange={(e) => setFileWithText(prev => prev ? { ...prev, text: e.target.value } : null)}
                placeholder={
                  fileWithText.messageType === 'audio' ? 'Опишите что на аудиозаписи...' :
                  fileWithText.messageType === 'video' ? 'Опишите что на видео...' :
                  fileWithText.messageType === 'image' ? 'Опишите что на изображении...' :
                  'Введите описание файла...'
                }
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '14px'
                }}
                autoFocus
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {fileWithText.text.length}/500 символов
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => {
                  setFileWithText(prev => prev ? { ...prev, text: '' } : null);
                  setTimeout(() => handleFileWithTextSubmit(), 0);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                title="Отправить только файл без описания"
              >
                Без описания
              </button>
              
              <button
                onClick={() => setFileWithText(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Отмена
              </button>
              
              <button
                onClick={handleFileWithTextSubmit}
                disabled={fileWithText.text.length > 500}
                style={{
                  padding: '8px 16px',
                  backgroundColor: fileWithText.text.length > 500 ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: fileWithText.text.length > 500 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Отправить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Модальное окно для редактирования текста файла */}
      {editingFileMessage && (
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
            maxWidth: '500px'
          }}>
            <h3 style={{ margin: '0 0 15px 0' }}>Редактирование описания</h3>
            
            <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f8f9fa', borderRadius: '6px' }}>
              <div><strong>Файл:</strong> {editingFileMessage.fileInfo.file_name}</div>
              <div><strong>Тип:</strong> {
                editingFileMessage.fileInfo.message_type === 'image' ? '🖼️ Изображение' :
                editingFileMessage.fileInfo.message_type === 'video' ? '🎥 Видео' :
                editingFileMessage.fileInfo.message_type === 'audio' ? '🎵 Аудио' : '📎 Файл'
              }</div>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                💡 Чтобы удалить описание, очистите поле и нажмите "Сохранить"
              </div>
            </div>
            
            <div style={{ marginBottom: '15px' }}>
              <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>
                Описание:
              </label>
              <textarea
                value={editingFileMessage.currentText}
                onChange={(e) => setEditingFileMessage(prev => prev ? { ...prev, currentText: e.target.value } : null)}
                placeholder="Введите описание..."
                style={{
                  width: '100%',
                  minHeight: '80px',
                  padding: '10px',
                  border: '1px solid #ccc',
                  borderRadius: '4px',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  fontSize: '14px'
                }}
                autoFocus
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: '5px' }}>
                {editingFileMessage.currentText.length}/500 символов • 
                {editingFileMessage.currentText.trim() === '' ? ' ⚠️ Описание будет удалено' : ' ✓ Текст будет сохранен'}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <button
                onClick={() => setEditingFileMessage(null)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Отмена
              </button>
              
              <button
                onClick={() => {
                  setEditingFileMessage(prev => prev ? { ...prev, currentText: '' } : null);
                  setTimeout(() => handleEditFileMessage(editingFileMessage.messageId, ''), 0);
                }}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
                title="Удалить описание файла"
              >
                Удалить описание
              </button>
              
              <button
                onClick={() => handleEditFileMessage(editingFileMessage.messageId, editingFileMessage.currentText)}
                disabled={editingFileMessage.currentText.length > 500}
                style={{
                  padding: '8px 16px',
                  backgroundColor: editingFileMessage.currentText.length > 500 ? '#ccc' : '#0070f3',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: editingFileMessage.currentText.length > 500 ? 'not-allowed' : 'pointer',
                  fontSize: '14px'
                }}
              >
                Сохранить
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recording Indicator */}
      {recording?.isRecording && (
        <div style={{
          padding: '15px 20px',
          backgroundColor: '#ffebee',
          borderTop: '1px solid #ffcdd2',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <span style={{ color: '#d32f2f', fontWeight: 'bold' }}>
              ● Запись {recording.type === 'audio' ? 'аудио' : 'видео'}
              {recording.isPaused && ' (на паузе)'}
            </span>
            <span style={{ color: '#666', fontFamily: 'monospace' }}>
              {Math.floor(recording.timer / 60)}:{(recording.timer % 60).toString().padStart(2, '0')}
            </span>
          </div>
          
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              onClick={togglePauseRecording}
              style={{
                padding: '6px 12px',
                backgroundColor: recording.isPaused ? '#28a745' : '#ffc107',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              {recording.isPaused ? 'Продолжить' : 'Пауза'}
            </button>
            
            <button 
              onClick={stopRecording}
              style={{
                padding: '6px 12px',
                backgroundColor: '#d32f2f',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '12px'
              }}
            >
              Стоп
            </button>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div style={{ 
        padding: '20px',
        backgroundColor: 'white',
        borderTop: '1px solid #e0e0e0'
      }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
          {/* File Upload Button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '10px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            title="Прикрепить файл"
          >
            📎
          </button>

          <input
            type="file"
            ref={fileInputRef}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files?.[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />

          {/* Code Editor Button */}
          <button
            onClick={() => setShowCodeEditor(true)}
            style={{
              padding: '10px',
              backgroundColor: '#f5f5f5',
              border: 'none',
              borderRadius: '50%',
              cursor: 'pointer',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
            title="Вставить код"
          >
            {'</>'}
          </button>

          {/* Emoji Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              style={{
                padding: '10px',
                backgroundColor: '#f5f5f5',
                border: 'none',
                borderRadius: '50%',
                cursor: 'pointer',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
              title="Смайлики"
            >
              😀
            </button>
            
            {showEmojiPicker && (
              <EmojiPicker 
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>

          {/* Audio Record Button */}
          <button
            onClick={() => recording ? stopRecording() : startRecording('audio')}
            disabled={!!recording && recording.type !== 'audio'}
            style={{
              padding: '10px',
              backgroundColor: recording?.type === 'audio' ? '#ffebee' : '#f5f5f5',
              border: 'none',
              borderRadius: '50%',
              cursor: (recording && recording.type !== 'audio') ? 'not-allowed' : 'pointer',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: recording?.type === 'audio' ? '#d32f2f' : 'inherit',
              opacity: (recording && recording.type !== 'audio') ? 0.5 : 1
            }}
            title={recording?.type === 'audio' ? 'Остановить запись' : 'Записать аудио'}
          >
            🎤
          </button>

          {/* Video Record Button */}
          <button
            onClick={() => recording ? stopRecording() : startRecording('video')}
            disabled={!!recording && recording.type !== 'video'}
            style={{
              padding: '10px',
              backgroundColor: recording?.type === 'video' ? '#ffebee' : '#f5f5f5',
              border: 'none',
              borderRadius: '50%',
              cursor: (recording && recording.type !== 'video') ? 'not-allowed' : 'pointer',
              width: '40px',
              height: '40px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: recording?.type === 'video' ? '#d32f2f' : 'inherit',
              opacity: (recording && recording.type !== 'video') ? 0.5 : 1
            }}
            title={recording?.type === 'video' ? 'Остановить запись' : 'Записать видео'}
          >
            📹
          </button>

          {/* Message Input */}
          <div style={{ flex: 1 }}>
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Введите сообщение..."
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #e0e0e0',
                borderRadius: '24px',
                resize: 'none',
                minHeight: '40px',
                maxHeight: '120px',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
              rows={1}
            />
          </div>

          {/* Send Button */}
          <button
            onClick={handleSendMessage}
            disabled={!newMessage.trim()}
            style={{
              padding: '10px 20px',
              backgroundColor: newMessage.trim() ? '#0070f3' : '#ccc',
              color: 'white',
              border: 'none',
              borderRadius: '24px',
              cursor: newMessage.trim() ? 'pointer' : 'not-allowed',
              fontWeight: 'bold'
            }}
          >
            Отправить
          </button>
        </div>

        {/* Drag & Drop Hint */}
        <div style={{ 
          textAlign: 'center', 
          fontSize: '12px', 
          color: '#666',
          marginTop: '10px'
        }}>
          Перетащите файлы сюда для загрузки
        </div>
      </div>
    </div>
  );
}