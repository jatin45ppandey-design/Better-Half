import { createContext, useContext } from 'react';

export interface GameParticipantInfo {
  userId: string;
  name: string;
  seatIndex: number;
  isHost?: boolean;
}

export interface GameSessionContextType {
  sessionId: string;
  gameId: string;
  mode: 'couple' | 'friend';
  publicState: any;
  privateState: any;
  version: number;
  isPaused: boolean;
  sessionStatus: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  isLoading: boolean;
  error: string | null;
  winnerUserId: string | null;
  scores: Record<string, number>;
  participants: GameParticipantInfo[];
  sendAction: (action: any) => Promise<{ success: boolean; error?: string }>;
  togglePause: () => Promise<void>;
  requestRematch: () => Promise<{ success: boolean; error?: string }>;
  replacementSessionId: string | null;
  lastEvent: { type: string; payload: any } | null;
}

export const GameSessionContext = createContext<GameSessionContextType | null>(null);

export const useGameSession = () => {
  return useContext(GameSessionContext);
};
