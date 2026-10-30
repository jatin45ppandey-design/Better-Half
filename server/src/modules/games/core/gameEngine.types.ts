export interface GameParticipant {
  userId: string;
  name: string;
  seatIndex: number;
  isHost?: boolean;
}

export interface GameEngineContext<TState = any, TPrivateState = any> {
  sessionId: string;
  gameId: string;
  mode: 'couple' | 'friend';
  participants: GameParticipant[];
  state: TState;
  privateStates: Record<string, TPrivateState>; // userId -> privateState
  version: number;
  isPaused: boolean;
  status: 'ACTIVE' | 'PAUSED' | 'COMPLETED' | 'ABANDONED';
  winnerUserId?: string | null;
  scores: Record<string, number>;
  rngSeed?: string;
  currentTurnUserId?: string | null;
}

export interface ActionResult<TState = any, TPrivateState = any> {
  success: boolean;
  error?: string;
  newState?: TState;
  newPrivateStates?: Record<string, TPrivateState>;
  nextTurnUserId?: string | null;
  scores?: Record<string, number>;
  isCompleted?: boolean;
  winnerUserId?: string | null;
  events?: Array<{ type: string; payload: unknown; targetUserId?: string }>;
}

export interface IGameEngine<TState = any, TPrivateState = any, TAction = any> {
  gameId: string;

  createInitialState(params: {
    sessionId: string;
    mode: 'couple' | 'friend';
    participants: GameParticipant[];
    rngSeed: string;
  }): {
    state: TState;
    privateStates: Record<string, TPrivateState>;
    currentTurnUserId?: string | null;
    scores?: Record<string, number>;
  };

  validateAction(
    action: TAction,
    context: GameEngineContext<TState, TPrivateState>,
    actorUserId: string
  ): { valid: boolean; error?: string };

  applyAction(
    action: TAction,
    context: GameEngineContext<TState, TPrivateState>,
    actorUserId: string
  ): ActionResult<TState, TPrivateState>;

  getPublicProjection(
    state: TState,
    context: GameEngineContext<TState, TPrivateState>
  ): Record<string, unknown>;

  getPrivateProjection(
    privateState: TPrivateState,
    state: TState,
    userId: string,
    context: GameEngineContext<TState, TPrivateState>
  ): Record<string, unknown> | null;
}

export interface GameActionEnvelope {
  sessionId: string;
  actionId: string;
  expectedVersion: number;
  action: {
    type: string;
    [key: string]: unknown;
  };
}
