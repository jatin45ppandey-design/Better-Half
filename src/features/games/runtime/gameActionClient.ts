import { socketService } from '../../../services/socket';

export interface GameActionEnvelope<T = any> {
  sessionId: string;
  actionId: string;
  expectedVersion: number;
  action: T;
}

export async function sendGameAction<T = any>(
  sessionId: string,
  expectedVersion: number,
  action: T
): Promise<{ success: boolean; error?: string; version?: number }> {
  const actionId = `act-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const envelope: GameActionEnvelope<T> = {
    sessionId,
    actionId,
    expectedVersion,
    action,
  };

  return new Promise((resolve) => {
    socketService.emit('game:action', envelope, (response: any) => {
      resolve(response || { success: false, error: 'No response from server.' });
    });
  });
}

