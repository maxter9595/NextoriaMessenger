export interface Session {
  id: number;
  user_id: number;
  session_token: string;
  expires_at: Date;
  created_at: Date;
}