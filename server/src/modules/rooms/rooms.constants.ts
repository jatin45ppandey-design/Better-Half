import crypto from 'node:crypto';

export const ROOM_MODES = {
  COUPLE: 'couple',
  FRIEND: 'friend',
} as const;

export type RoomMode = (typeof ROOM_MODES)[keyof typeof ROOM_MODES];

export const ROOM_STATUS = {
  WAITING: 'WAITING',
  READY_TO_START: 'READY_TO_START',
  IN_PROGRESS: 'IN_PROGRESS',
  COMPLETED: 'COMPLETED',
  CLOSED: 'CLOSED',
  EXPIRED: 'EXPIRED',
} as const;

export type RoomStatus = (typeof ROOM_STATUS)[keyof typeof ROOM_STATUS];

export const ROOM_PARTICIPANT_ROLES = {
  HOST: 'HOST',
  PLAYER: 'PLAYER',
} as const;

export const INVITATION_STATUS = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
  CANCELLED: 'CANCELLED',
  EXPIRED: 'EXPIRED',
} as const;

export const MODE_CAPACITIES: Record<RoomMode, { min: number; max: number }> = {
  couple: { min: 2, max: 2 },
  friend: { min: 2, max: 4 },
};

/**
 * Server-authoritative game eligibility dictionary.
 * Does not rely only on client registry.
 */
export const GAME_MODE_ALLOWLIST: Record<string, RoomMode[]> = {
  'truth-or-dare': ['couple'],
  'would-you-rather': ['couple'],
  'between-us': ['couple'],
  'blind-ranking': ['couple', 'friend'],
  'uno-style': ['couple', 'friend'],
  'original-card-game': ['couple', 'friend'], // Canonical alias
  'tic-tac-toe': ['couple', 'friend'],
  'pen-fight': ['couple', 'friend'],
  'kabza': ['couple', 'friend'],
  'basketball-rivalry': ['couple', 'friend'],
  'snatch-the-fries': ['couple', 'friend'],
  'aloo-golf': ['couple', 'friend'],
};

export function normalizeGameId(gameId: string): string {
  const normalized = gameId.trim().toLowerCase();
  return normalized === 'original-card-game' ? 'uno-style' : normalized;
}

export function isGamePermittedForMode(gameId: string, mode: RoomMode | string): boolean {
  const normalizedMode = mode.toLowerCase() as RoomMode;
  const normalizedGameId = normalizeGameId(gameId);
  const allowedModes = GAME_MODE_ALLOWLIST[normalizedGameId];
  if (!allowedModes) return false;
  return allowedModes.includes(normalizedMode);
}

// 6-character unambiguous alphabet (avoiding 0, O, 1, I)
const CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function generateRoomCode(): string {
  let result = '';
  for (let i = 0; i < 6; i++) {
    const randomIndex = crypto.randomInt(0, CODE_ALPHABET.length);
    result += CODE_ALPHABET[randomIndex];
  }
  return result;
}

