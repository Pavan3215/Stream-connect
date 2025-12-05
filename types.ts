export interface User {
  id: string;
  name: string;
  avatar: string;
  designation?: string;
  address?: string;
  dob?: string;
}

export interface MeetingHistory {
  roomId: string;
  timestamp: number;
  hostName?: string;
}

export type SignalType = 'offer' | 'answer' | 'ice-candidate' | 'join' | 'ready';

export interface SignalMessage {
  type: SignalType;
  payload?: any;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  targetId?: string;
}

export interface RoomConfig {
  roomId: string;
  isHost: boolean;
}