export interface Message {
  id: number;
  user_id: number;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'code';
  language?: string;
  file_path: string;
  file_name: string;
  file_size: number;
  mime_type: string;
  created_at: Date;
  updated_at: Date;
  is_edited: boolean;
}

export interface CreateMessageData {
  user_id: number;
  content: string;
  message_type: 'text' | 'image' | 'video' | 'audio' | 'file' | 'code';
  language?: string;
  file_path?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

export interface UpdateMessageData {
  content?: string;
  message_type?: 'text' | 'image' | 'video' | 'audio' | 'file' | 'code';
  is_edited?: boolean;
}
