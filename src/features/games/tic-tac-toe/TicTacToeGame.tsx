import React, { useState } from 'react';
import {
  RotateCcw,
  Trophy,
  History,
  Users,
  Swords,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface TicTacToeProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  isPaused?: boolean;
  sessionState?: any;
  onSendAction?: (action: any) => Promise<{ success: boolean; error?: string }>;
  currentUserId?: string;
}

type BoardState = (string | null)[]; // 'X' | 'O' | null
type SeriesFormat = 1 | 3 | 5;

const WINNING_COMBOS = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

export const TicTacToeGame: React.FC<TicTacToeProps> = ({
  players,
  onFinishMatch,
  isPaused = false,
  sessionState,
  onSendAction,
  currentUserId,
}) => {
  // If >2 players, assign active duelists indices
  const [duelist1Idx] = useState(0);
  const [duelist2Idx, setDuelist2Idx] = useState(1);
  const [localSeriesFormat, setSeriesFormat] = useState<SeriesFormat>(3);

  const localPlayer1 = players[duelist1Idx] || { id: 'p1', name: 'Player 1', avatarInitials: 'P1', avatarColor: 'bg-primary-500' };
  const localPlayer2 = players[duelist2Idx] || { id: 'p2', name: 'Player 2', avatarInitials: 'P2', avatarColor: 'bg-secondary-500' };

  const [localBoard, setBoard] = useState<BoardState>(Array(9).fill(null));
  const [localTurnSymbol, setTurnSymbol] = useState<'X' | 'O'>('X');
  const [localP1Wins, setP1Wins] = useState(0);
  const [localP2Wins, setP2Wins] = useState(0);
  const [localDraws, setDraws] = useState(0);
  const [localCurrentRound, setCurrentRound] = useState(1);
  const [localWinningCombo, setWinningCombo] = useState<number[] | null>(null);
  const [localRoundWinner, setRoundWinner] = useState<'X' | 'O' | 'DRAW' | null>(null);

  const isMultiplayer = Boolean(sessionState && onSendAction);
  const serverState = isMultiplayer ? sessionState : null;
  const player1 = isMultiplayer
    ? players.find((player) => player.id === serverState.duelistXUserId) || localPlayer1
    : localPlayer1;
  const player2 = isMultiplayer
    ? players.find((player) => player.id === serverState.duelistOUserId) || localPlayer2
    : localPlayer2;
  const board: BoardState = isMultiplayer ? serverState.board : localBoard;
  const turnSymbol: 'X' | 'O' = isMultiplayer ? serverState.currentSymbol : localTurnSymbol;
  const p1Wins = isMultiplayer ? serverState.xWins : localP1Wins;
  const p2Wins = isMultiplayer ? serverState.oWins : localP2Wins;
  const draws = isMultiplayer ? serverState.draws : localDraws;
  const currentRound = isMultiplayer ? serverState.currentRound : localCurrentRound;
  const seriesFormat: SeriesFormat = isMultiplayer ? serverState.seriesFormat : localSeriesFormat;
  const winningCombo: number[] | null = isMultiplayer ? serverState.winningCombo : localWinningCombo;
  const roundWinner: 'X' | 'O' | 'DRAW' | null = isMultiplayer
    ? serverState.roundStatus === 'X_WON'
      ? 'X'
      : serverState.roundStatus === 'O_WON'
      ? 'O'
      : serverState.roundStatus === 'DRAW'
      ? 'DRAW'
      : null
    : localRoundWinner;
  const isMyTurn = !isMultiplayer || serverState.currentTurnUserId === currentUserId;
  const [moveHistory, setMoveHistory] = useState<Array<{ round: number; player: string; cell: number; symbol: 'X' | 'O' }>>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Check victory logic
  const checkWinner = (squares: BoardState): { winner: 'X' | 'O' | null; combo: number[] | null } => {
    for (const combo of WINNING_COMBOS) {
      const [a, b, c] = combo;
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return { winner: squares[a] as 'X' | 'O', combo };
      }
    }
    return { winner: null, combo: null };
  };

  const activePlayer = turnSymbol === 'X' ? player1 : player2;

  const handleCellClick = (index: number) => {
    if (isPaused || board[index] || roundWinner || !isMyTurn) return;
    if (isMultiplayer) {
      void onSendAction?.({ type: 'MAKE_MOVE', cellIndex: index });
      return;
    }

    const newBoard = [...board];
    newBoard[index] = turnSymbol;
    setBoard(newBoard);

    const newMove = {
      round: currentRound,
      player: activePlayer.name,
      cell: index,
      symbol: turnSymbol,
    };
    setMoveHistory((prev) => [newMove, ...prev]);

    const { winner, combo } = checkWinner(newBoard);
    if (winner) {
      setWinningCombo(combo);
      setRoundWinner(winner);
      const isP1 = winner === 'X';
      const updatedP1 = isP1 ? p1Wins + 1 : p1Wins;
      const updatedP2 = !isP1 ? p2Wins + 1 : p2Wins;
      if (isP1) setP1Wins(updatedP1);
      else setP2Wins(updatedP2);

      const targetWins = Math.ceil(seriesFormat / 2);
      if (updatedP1 >= targetWins || updatedP2 >= targetWins) {
        // Match over
        setTimeout(() => {
          const matchWinner = updatedP1 > updatedP2 ? player1 : player2;
          onFinishMatch({
            winnerName: matchWinner.name,
            playerScores: players.map((p) => {
              let score = 0;
              if (p.id === player1.id) score = updatedP1;
              else if (p.id === player2.id) score = updatedP2;
              return {
                playerId: p.id,
                name: p.name,
                avatarInitials: p.avatarInitials,
                avatarColor: p.avatarColor,
                score,
                isWinner: p.id === matchWinner.id,
                stats: [
                  { label: 'Rounds Won', value: p.id === player1.id ? updatedP1 : p.id === player2.id ? updatedP2 : 0 },
                  { label: 'Role', value: p.id === player1.id ? 'Duelist (X)' : p.id === player2.id ? 'Duelist (O)' : 'Queue Spectator' },
                ],
              };
            }),
          });
        }, 1500);
      }
    } else if (newBoard.every((cell) => cell !== null)) {
      setRoundWinner('DRAW');
      setDraws((d) => d + 1);
    } else {
      setTurnSymbol((prev) => (prev === 'X' ? 'O' : 'X'));
    }
  };

  const handleNextRound = () => {
    if (isMultiplayer) {
      void onSendAction?.({ type: 'START_NEXT_ROUND' });
      return;
    }
    setBoard(Array(9).fill(null));
    setWinningCombo(null);
    setRoundWinner(null);
    setCurrentRound((r) => r + 1);
    setTurnSymbol('X');
  };

  const handleRotateDuelist = () => {
    if (isMultiplayer || players.length <= 2) return;
    // Rotate player2 with next in line
    const nextIdx = (duelist2Idx + 1) % players.length;
    const finalNextIdx = nextIdx === duelist1Idx ? (nextIdx + 1) % players.length : nextIdx;
    setDuelist2Idx(finalNextIdx);
    setBoard(Array(9).fill(null));
    setWinningCombo(null);
    setRoundWinner(null);
  };

  const getCellLabel = (idx: number) => {
    const row = Math.floor(idx / 3) + 1;
    const col = (idx % 3) + 1;
    return `R${row}C${col}`;
  };

  const waitingPlayers = isMultiplayer
    ? (serverState.waitingQueueUserIds || [])
        .map((userId: string) => players.find((player) => player.id === userId))
        .filter(Boolean)
    : players.filter((_, idx) => idx !== duelist1Idx && idx !== duelist2Idx);
  const targetWins = Math.ceil(seriesFormat / 2);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-primary-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold">
            3x3
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Neon Tic Tac Toe</h3>
            <p className="text-xs text-gray-700">
              Best of {seriesFormat} Series • First to {targetWins} wins
            </p>
          </div>
        </div>

        {/* Series format selector if at round 1 start */}
        {currentRound === 1 && board.every((c) => c === null) && (
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl">
            {([1, 3, 5] as SeriesFormat[]).map((fmt) => (
              <button
                key={fmt}
                onClick={() => {
                  if (isMultiplayer) void onSendAction?.({ type: 'SET_SERIES_FORMAT', format: fmt });
                  else setSeriesFormat(fmt);
                }}
                className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all ${
                  seriesFormat === fmt ? 'bg-primary-600 text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Best of {fmt}
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            className="flex items-center gap-1.5 text-xs text-gray-700"
          >
            <History className="w-3.5 h-3.5" />
            {showHistory ? 'Hide Moves' : 'Move Log'}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleNextRound}
            disabled={isMultiplayer && !roundWinner}
            className="flex items-center gap-1.5 text-xs text-gray-700"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Clear Board
          </Button>
        </div>
      </div>

      {/* Duelist Matchup Header */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Duelist X */}
        <div
          className={`relative p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
            turnSymbol === 'X' && !roundWinner
              ? 'border-primary-500 bg-primary-50/70 shadow-md ring-2 ring-primary-300'
              : 'border-gray-200 bg-white/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl ${player1.avatarColor} text-white font-bold flex items-center justify-center text-lg shadow-sm`}>
              {player1.avatarInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{player1.name}</span>
                <span className="w-5 h-5 rounded-md bg-primary-600 text-white text-xs font-black flex items-center justify-center">
                  X
                </span>
              </div>
              <p className="text-xs text-primary-700 font-medium">
                {turnSymbol === 'X' && !roundWinner ? '👉 Your Turn to Play' : 'Waiting'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-primary-700">{p1Wins}</span>
            <span className="text-xs text-gray-700 block">/ {targetWins} wins</span>
          </div>
        </div>

        {/* Duelist O */}
        <div
          className={`relative p-4 rounded-2xl border-2 transition-all flex items-center justify-between ${
            turnSymbol === 'O' && !roundWinner
              ? 'border-secondary-500 bg-secondary-50/70 shadow-md ring-2 ring-secondary-300'
              : 'border-gray-200 bg-white/80'
          }`}
        >
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl ${player2.avatarColor} text-white font-bold flex items-center justify-center text-lg shadow-sm`}>
              {player2.avatarInitials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-gray-900">{player2.name}</span>
                <span className="w-5 h-5 rounded-md bg-secondary-600 text-white text-xs font-black flex items-center justify-center">
                  O
                </span>
              </div>
              <p className="text-xs text-secondary-700 font-medium">
                {turnSymbol === 'O' && !roundWinner ? '👉 Your Turn to Play' : 'Waiting'}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-2xl font-black text-secondary-700">{p2Wins}</span>
            <span className="text-xs text-gray-700 block">/ {targetWins} wins</span>
          </div>
        </div>
      </div>

      {/* Main Playing Area */}
      <div className="flex flex-col lg:flex-row items-center justify-center gap-8 py-4">
        {/* 3x3 Grid Board */}
        <div className="relative p-4 bg-gradient-to-br from-gray-900 via-primary-950 to-gray-900 rounded-3xl shadow-2xl border-4 border-primary-200/50">
          {/* Subtle grid backdrop decoration */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-primary-500/10 via-transparent to-transparent pointer-events-none rounded-3xl" />

          <div className="grid grid-cols-3 gap-3 w-72 h-72 sm:w-88 sm:h-88 relative z-10">
            {board.map((cell, idx) => {
              const isWinning = winningCombo?.includes(idx);
              return (
                <button
                  key={idx}
                  onClick={() => handleCellClick(idx)}
                  disabled={Boolean(cell || roundWinner || isPaused || !isMyTurn)}
                  aria-label={`Cell ${getCellLabel(idx)}`}
                  className={`relative rounded-2xl flex items-center justify-center font-black transition-all duration-200 shadow-inner group
                    ${
                      cell
                        ? isWinning
                          ? 'bg-amber-400 text-gray-950 scale-105 shadow-lg shadow-amber-400/50 ring-4 ring-amber-300'
                          : cell === 'X'
                          ? 'bg-primary-900/80 text-primary-300 border border-primary-700/60'
                          : 'bg-secondary-900/80 text-secondary-300 border border-secondary-700/60'
                        : 'bg-white/10 hover:bg-white/20 active:scale-95 border border-white/10 cursor-pointer'
                    }`}
                >
                  {/* Subtle coordinate watermark */}
                  <span className="absolute top-1.5 left-2 text-[10px] text-white/20 group-hover:text-white/40 font-mono select-none">
                    {getCellLabel(idx)}
                  </span>

                  {cell === 'X' && (
                    <span className="text-5xl sm:text-6xl font-black drop-shadow-[0_0_12px_rgba(168,85,247,0.7)] animate-in zoom-in-50 duration-150">
                      ✕
                    </span>
                  )}
                  {cell === 'O' && (
                    <span className="text-5xl sm:text-6xl font-black drop-shadow-[0_0_12px_rgba(236,72,153,0.7)] animate-in zoom-in-50 duration-150">
                      ◯
                    </span>
                  )}
                  {!cell && !roundWinner && (
                    <span className="text-3xl font-black text-white/0 group-hover:text-white/20 transition-colors select-none">
                      {turnSymbol === 'X' ? '✕' : '◯'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Round status banner overlay if round ended */}
          {roundWinner && (
            <div className="absolute inset-x-4 bottom-4 z-20 bg-gray-900/95 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-xl flex items-center justify-between animate-in fade-in slide-in-from-bottom-4">
              <div>
                <p className="text-xs text-primary-300 uppercase tracking-widest font-semibold">
                  Round {currentRound} Result
                </p>
                <h4 className="text-lg font-bold text-white flex items-center gap-1.5">
                  {roundWinner === 'DRAW' ? (
                    <>🤝 Cat's Game (Draw)</>
                  ) : (
                    <>
                      <Trophy className="w-5 h-5 text-amber-400" />
                      {roundWinner === 'X' ? player1.name : player2.name} wins round!
                    </>
                  )}
                </h4>
              </div>
              <Button
                size="sm"
                onClick={handleNextRound}
                className="flex items-center gap-1 bg-primary-600 hover:bg-primary-700 text-white"
              >
                Next Round <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Friend Mode Queue Panel if > 2 players */}
        {waitingPlayers.length > 0 && (
          <div className="w-full lg:w-72 bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-primary-100 shadow-sm flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-600" />
                <h4 className="font-bold text-gray-900 text-sm">Next in Duel Queue</h4>
              </div>
              <Badge variant="lavender" className="text-[10px]">
                {waitingPlayers.length} Waiting
              </Badge>
            </div>
            <p className="text-xs text-gray-700">
              Tic Tac Toe is strictly 2 players on the active board. Non-active friends wait their turn or challenge the winner.
            </p>
            <div className="space-y-2 mt-1">
              {waitingPlayers.map((p) => (
                <div key={p.id} className="flex items-center justify-between p-2.5 rounded-xl bg-gray-50 border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-lg ${p.avatarColor} text-white font-bold flex items-center justify-center text-xs`}>
                      {p.avatarInitials}
                    </div>
                    <span className="text-xs font-semibold text-gray-800">{p.name}</span>
                  </div>
                  <span className="text-[10px] text-gray-600 bg-gray-200 px-2 py-0.5 rounded-full">
                    Queue
                  </span>
                </div>
              ))}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotateDuelist}
              className="mt-2 w-full text-xs flex items-center justify-center gap-1.5"
            >
              <Swords className="w-3.5 h-3.5" />
              Swap Duelist O with Queue
            </Button>
          </div>
        )}
      </div>

      {/* Move History Drawer */}
      {showHistory && (
        <div className="bg-white/90 backdrop-blur-md rounded-2xl p-5 border border-primary-100 shadow-sm">
          <h4 className="font-bold text-gray-900 text-sm mb-3 flex items-center gap-2">
            <History className="w-4 h-4 text-primary-600" />
            Turn-by-Turn Move History
          </h4>
          {moveHistory.length === 0 ? (
            <p className="text-xs text-gray-600">No moves made yet this game.</p>
          ) : (
            <div className="max-h-48 overflow-y-auto space-y-1.5 text-xs pr-2">
              {moveHistory.map((m, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 px-3 rounded-lg bg-gray-50 border border-gray-100">
                  <span className="font-medium text-gray-700">
                    R{m.round} • {m.player} marked <span className="font-mono font-bold text-primary-600">{getCellLabel(m.cell)}</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded font-black text-[11px] ${m.symbol === 'X' ? 'bg-primary-100 text-primary-700' : 'bg-secondary-100 text-secondary-700'}`}>
                    {m.symbol}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Footer Status */}
      <div className="flex items-center justify-between text-xs text-gray-600 px-2">
        <span className="flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary-500" />
          Round {currentRound} • Draws: {draws}
        </span>
        <span>{isMultiplayer ? 'Server-synchronized multiplayer' : 'Local 2-Player Pass-and-Play Protocol'}</span>
      </div>
    </div>
  );
};
