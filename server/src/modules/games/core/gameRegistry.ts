export interface ServerGameMeta {
  id: string;
  name: string;
  modes: ('couple' | 'friend')[];
  minPlayers: number;
  maxPlayers: number;
  isTurnBased: boolean;
  hasPrivateState: boolean;
}

export const SERVER_GAMES: Record<string, ServerGameMeta> = {
  'truth-or-dare': {
    id: 'truth-or-dare',
    name: 'Truth or Dare',
    modes: ['couple'],
    minPlayers: 2,
    maxPlayers: 2,
    isTurnBased: true,
    hasPrivateState: false,
  },
  'would-you-rather': {
    id: 'would-you-rather',
    name: 'Would You Rather',
    modes: ['couple'],
    minPlayers: 2,
    maxPlayers: 2,
    isTurnBased: false,
    hasPrivateState: true,
  },
  'blind-ranking': {
    id: 'blind-ranking',
    name: 'Blind Ranking',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: false,
    hasPrivateState: true,
  },
  'uno-style': {
    id: 'uno-style',
    name: 'Original UNO-style Card Game',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: true,
    hasPrivateState: true,
  },
  'tic-tac-toe': {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: true,
    hasPrivateState: false,
  },
  'pen-fight': {
    id: 'pen-fight',
    name: 'Pen Fight',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: true,
    hasPrivateState: false,
  },
  'kabza': {
    id: 'kabza',
    name: 'Kabza',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: true,
    hasPrivateState: false,
  },
  'basketball-rivalry': {
    id: 'basketball-rivalry',
    name: 'Basketball Rivalry',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: true,
    hasPrivateState: false,
  },
  'snatch-the-fries': {
    id: 'snatch-the-fries',
    name: 'Snatch the Fries',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: false,
    hasPrivateState: false,
  },
  'aloo-golf': {
    id: 'aloo-golf',
    name: 'Aloo Golf',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    isTurnBased: true,
    hasPrivateState: false,
  },
  'between-us': {
    id: 'between-us',
    name: 'BETWEEN US',
    modes: ['couple'],
    minPlayers: 2,
    maxPlayers: 2,
    isTurnBased: false,
    hasPrivateState: true,
  },
};

export function isGameEligibleForMode(gameId: string, mode: 'couple' | 'friend'): boolean {
  const meta = SERVER_GAMES[gameId];
  if (!meta) return false;
  return meta.modes.includes(mode);
}

export function validatePlayerCount(gameId: string, count: number): boolean {
  const meta = SERVER_GAMES[gameId];
  if (!meta) return false;
  return count >= meta.minPlayers && count <= meta.maxPlayers;
}

