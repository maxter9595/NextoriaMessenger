export interface Message {
  id: number;
  user_id: number;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: Date;
}

export interface CreateMessageData {
  user_id: number;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file';
  file_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}
