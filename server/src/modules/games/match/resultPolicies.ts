import type { GameEngineContext } from '../core/gameEngine.types.js';

export interface ParticipantResult {
  userId: string;
  placement: number;
  scoreValue: number;
  scoreLabel: string;
  isWinner: boolean;
  outcome: 'WIN' | 'LOSS' | 'DRAW' | 'COMPLETED' | 'ABANDONED';
}

export interface MatchEvaluationResult {
  resultType: 'COMPETITIVE' | 'COOPERATIVE' | 'DRAW' | 'ABANDONED';
  winnerUserId: string | null;
  participants: ParticipantResult[];
  roundsPlayed: number;
  resultSummary: Record<string, any>;
}

export function evaluateGameResult(context: GameEngineContext): MatchEvaluationResult {
  const { gameId, mode, participants, scores, state, winnerUserId } = context;

  // 1. Cooperative Games: Truth or Dare, Would You Rather, BETWEEN US
  if (gameId === 'truth-or-dare' || gameId === 'would-you-rather' || gameId === 'between-us') {
    const participantResults: ParticipantResult[] = participants.map((p) => ({
      userId: p.userId,
      placement: 1,
      scoreValue: scores[p.userId] || 0,
      scoreLabel: `${scores[p.userId] || 0} pts`,
      isWinner: false,
      outcome: 'COMPLETED',
    }));

    return {
      resultType: 'COOPERATIVE',
      winnerUserId: null,
      participants: participantResults,
      roundsPlayed: state?.round || state?.currentRound || 1,
      resultSummary: {
        gameId,
        mode,
        type: 'cooperative_completion',
        completedRounds: state?.round || state?.currentRound || 1,
      },
    };
  }

  // 2. Blind Ranking: Cooperative alignment in couple mode, competitive in friend mode
  if (gameId === 'blind-ranking') {
    if (mode === 'couple') {
      const alignmentScore = scores[participants[0]?.userId] || 0;
      const participantResults: ParticipantResult[] = participants.map((p) => ({
        userId: p.userId,
        placement: 1,
        scoreValue: alignmentScore,
        scoreLabel: `${alignmentScore} alignment pts`,
        isWinner: false,
        outcome: 'COMPLETED',
      }));

      return {
        resultType: 'COOPERATIVE',
        winnerUserId: null,
        participants: participantResults,
        roundsPlayed: 5,
        resultSummary: {
          gameId,
          mode,
          alignmentScore,
        },
      };
    }
  }

  // 3. Aloo Golf: LOWEST strokes wins!
  if (gameId === 'aloo-golf') {
    const sorted = [...participants].sort((a, b) => {
      const strokesA = scores[a.userId] ?? 999;
      const strokesB = scores[b.userId] ?? 999;
      return strokesA - strokesB; // Ascending: fewer strokes is better!
    });

    const bestStrokes = scores[sorted[0]?.userId] ?? 999;
    const secondStrokes = scores[sorted[1]?.userId] ?? 999;
    const isTie = sorted.length > 1 && bestStrokes === secondStrokes;
    const matchWinnerId = isTie ? null : sorted[0]?.userId || null;
    const resultType = isTie ? 'DRAW' : 'COMPETITIVE';

    let currentPlacement = 1;
    const participantResults: ParticipantResult[] = sorted.map((p, idx) => {
      const userStrokes = scores[p.userId] ?? 999;
      if (idx > 0 && userStrokes > (scores[sorted[idx - 1].userId] ?? 999)) {
        currentPlacement = idx + 1;
      }
      const isWin = !isTie && p.userId === matchWinnerId;
      const isDraw = isTie && userStrokes === bestStrokes;

      return {
        userId: p.userId,
        placement: currentPlacement,
        scoreValue: userStrokes,
        scoreLabel: `${userStrokes} strokes`,
        isWinner: isWin,
        outcome: isWin ? 'WIN' : isDraw ? 'DRAW' : 'LOSS',
      };
    });

    return {
      resultType,
      winnerUserId: matchWinnerId,
      participants: participantResults,
      roundsPlayed: state?.totalHoles || 3,
      resultSummary: {
        gameId,
        scoring: 'lowest_strokes_wins',
        strokes: scores,
      },
    };
  }

  // 4. Default Competitive Games (Higher score is better: Basketball, Fries, Kabza, Pen Fight, UNO, Tic Tac Toe)
  const isDirectWinner = winnerUserId !== undefined && winnerUserId !== null;
  const isDraw = state?.isDraw || (!isDirectWinner && participants.length > 1 &&
    Object.values(scores).length > 1 &&
    new Set(Object.values(scores)).size === 1);

  const sorted = [...participants].sort((a, b) => {
    if (isDirectWinner) {
      if (a.userId === winnerUserId) return -1;
      if (b.userId === winnerUserId) return 1;
    }
    const scoreA = scores[a.userId] || 0;
    const scoreB = scores[b.userId] || 0;
    return scoreB - scoreA; // Descending: higher is better
  });

  const topScore = scores[sorted[0]?.userId] || 0;
  const matchWinner = isDraw ? null : (winnerUserId || sorted[0]?.userId || null);

  let currentPlacement = 1;
  const participantResults: ParticipantResult[] = sorted.map((p, idx) => {
    const s = scores[p.userId] || 0;
    if (idx > 0 && s < (scores[sorted[idx - 1].userId] || 0)) {
      currentPlacement = idx + 1;
    }
    const isWin = !isDraw && p.userId === matchWinner;
    const isPlayerDraw = isDraw && s === topScore;

    return {
      userId: p.userId,
      placement: isWin ? 1 : currentPlacement,
      scoreValue: s,
      scoreLabel: `${s} pts`,
      isWinner: isWin,
      outcome: isWin ? 'WIN' : isPlayerDraw ? 'DRAW' : 'LOSS',
    };
  });

  return {
    resultType: isDraw ? 'DRAW' : 'COMPETITIVE',
    winnerUserId: isDraw ? null : matchWinner,
    participants: participantResults,
    roundsPlayed: state?.round || state?.currentRound || state?.dropRound || 1,
    resultSummary: {
      gameId,
      scores,
      isDraw: !!isDraw,
    },
  };
}

