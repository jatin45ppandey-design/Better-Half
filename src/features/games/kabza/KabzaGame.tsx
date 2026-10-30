import React, { useState } from 'react';
import {
  RotateCcw,
  Trophy,
  Shield,
  ChevronRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface KabzaProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  isPaused?: boolean;
}

const GRID_SIZE = 6; // 6x6 = 36 territory cells
const TOTAL_CELLS = GRID_SIZE * GRID_SIZE;

const PLAYER_PALETTE = [
  { bg: 'bg-violet-600', ring: 'ring-violet-400', border: 'border-violet-500', text: 'text-violet-700', hex: '#7c3aed' },
  { bg: 'bg-pink-600', ring: 'ring-pink-400', border: 'border-pink-500', text: 'text-pink-700', hex: '#db2777' },
  { bg: 'bg-cyan-600', ring: 'ring-cyan-400', border: 'border-cyan-500', text: 'text-cyan-700', hex: '#0891b2' },
  { bg: 'bg-amber-600', ring: 'ring-amber-400', border: 'border-amber-500', text: 'text-amber-700', hex: '#d97706' },
];

interface Cell {
  row: number;
  col: number;
  ownerId: string | null;
  capturedThisTurn?: boolean;
}

export const KabzaGame: React.FC<KabzaProps> = ({
  players,
  onFinishMatch,
  isPaused = false,
}) => {
  const [round, setRound] = useState(1);
  const [turnIndex, setTurnIndex] = useState(0);
  const [board, setBoard] = useState<Cell[]>(() => {
    const cells: Cell[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        cells.push({ row: r, col: c, ownerId: null });
      }
    }
    return cells;
  });
  const [lastCaptureCount, setLastCaptureCount] = useState<number>(0);
  const [roundOver, setRoundOver] = useState(false);

  const activePlayer = players[turnIndex % players.length];
  const activeColor = PLAYER_PALETTE[turnIndex % PLAYER_PALETTE.length];

  // Calculate territory counts
  const territoryCounts: { [id: string]: number } = {};
  players.forEach((p) => {
    territoryCounts[p.id] = board.filter((c) => c.ownerId === p.id).length;
  });

  const getCellIndex = (r: number, c: number) => r * GRID_SIZE + c;

  // Handle cell claim & capture logic
  const handleCellClick = (r: number, c: number) => {
    if (isPaused || roundOver) return;

    const idx = getCellIndex(r, c);
    if (board[idx].ownerId !== null) return; // already claimed

    const newBoard = board.map((cell) => ({ ...cell, capturedThisTurn: false }));

    // Claim clicked cell
    newBoard[idx].ownerId = activePlayer.id;

    // Check Kabza Flanking / Enclosure captures on orthogonal neighbors
    const neighbors = [
      { r: r - 1, c: c },
      { r: r + 1, c: c },
      { r: r, c: c - 1 },
      { r: r, c: c + 1 },
    ];

    let capturedTotal = 0;

    neighbors.forEach((n) => {
      if (n.r >= 0 && n.r < GRID_SIZE && n.c >= 0 && n.c < GRID_SIZE) {
        const nIdx = getCellIndex(n.r, n.c);
        const neighborCell = newBoard[nIdx];

        // If cell is owned by another player, check if surrounded
        if (neighborCell.ownerId && neighborCell.ownerId !== activePlayer.id) {
          // Count surrounding cells owned by active player
          const surrounding = [
            { r: n.r - 1, c: n.c },
            { r: n.r + 1, c: n.c },
            { r: n.r, c: n.c - 1 },
            { r: n.r, c: n.c + 1 },
          ];

          const friendlySides = surrounding.filter(
            (s) =>
              s.r >= 0 &&
              s.r < GRID_SIZE &&
              s.c >= 0 &&
              s.c < GRID_SIZE &&
              newBoard[getCellIndex(s.r, s.c)].ownerId === activePlayer.id
          ).length;

          // If 2 or more friendly sides surround enemy cell, it gets captured (Kabza!)
          if (friendlySides >= 2) {
            neighborCell.ownerId = activePlayer.id;
            neighborCell.capturedThisTurn = true;
            capturedTotal++;
          }
        }
      }
    });

    setLastCaptureCount(capturedTotal);
    setBoard(newBoard);

    // Check if board full
    const isFull = newBoard.every((cell) => cell.ownerId !== null);
    if (isFull) {
      setRoundOver(true);
      // Determine match winner
      const finalCounts: { [id: string]: number } = {};
      players.forEach((p) => {
        finalCounts[p.id] = newBoard.filter((cell) => cell.ownerId === p.id).length;
      });

      let highestScore = -1;
      let winnerPlayer = players[0];
      players.forEach((p) => {
        if (finalCounts[p.id] > highestScore) {
          highestScore = finalCounts[p.id];
          winnerPlayer = p;
        }
      });

      setTimeout(() => {
        onFinishMatch({
          winnerName: winnerPlayer.name,
          playerScores: players.map((p) => ({
            playerId: p.id,
            name: p.name,
            avatarInitials: p.avatarInitials,
            avatarColor: p.avatarColor,
            score: finalCounts[p.id] || 0,
            isWinner: p.id === winnerPlayer.id,
            stats: [
              { label: 'Territories Claimed', value: finalCounts[p.id] || 0 },
              { label: 'Board Control', value: `${Math.round(((finalCounts[p.id] || 0) / TOTAL_CELLS) * 100)}%` },
            ],
          })),
        });
      }, 1500);
    } else {
      // Advance turn
      setTurnIndex((prev) => prev + 1);
    }
  };

  const handleResetBoard = () => {
    const cells: Cell[] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        cells.push({ row: r, col: c, ownerId: null });
      }
    }
    setBoard(cells);
    setRoundOver(false);
    setLastCaptureCount(0);
    setRound((r) => r + 1);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-primary-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center font-black">
            🏰
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Kabza: Territory Conquest</h3>
            <p className="text-xs text-gray-700">
              Round {round} • Flank enemy cells on 2 sides to conquer them!
            </p>
          </div>
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResetBoard}
          className="text-xs text-gray-700 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Map
        </Button>
      </div>

      {/* Players Territory Ownership Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {players.map((p, idx) => {
          const count = territoryCounts[p.id] || 0;
          const percentage = Math.round((count / TOTAL_CELLS) * 100);
          const palette = PLAYER_PALETTE[idx % PLAYER_PALETTE.length];
          const isCurrent = p.id === activePlayer.id && !roundOver;

          return (
            <div
              key={p.id}
              className={`p-3.5 rounded-2xl border-2 transition-all flex flex-col gap-2 ${
                isCurrent
                  ? 'border-violet-500 bg-violet-50/70 shadow-md ring-2 ring-violet-300'
                  : 'border-gray-200 bg-white/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-lg ${palette.bg} text-white font-bold flex items-center justify-center text-xs shadow-sm`}>
                    {p.avatarInitials}
                  </div>
                  <span className="font-bold text-xs text-gray-900 truncate max-w-[80px]">
                    {p.name}
                  </span>
                </div>
                {isCurrent && (
                  <Badge variant="purple" className="text-[10px] py-0 px-1.5">
                    Turn
                  </Badge>
                )}
              </div>

              <div>
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="font-bold text-gray-800">{count} Sectors</span>
                  <span className="text-gray-700 font-semibold">{percentage}%</span>
                </div>
                {/* Progress bar */}
                <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${palette.bg} transition-all duration-300`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid Territory Surface */}
      <div className="flex flex-col items-center justify-center py-2">
        <div className="relative p-5 bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 rounded-3xl shadow-2xl border-4 border-indigo-200/40">
          {/* Subtle grid backdrop decoration */}
          <div className="grid grid-cols-6 gap-2 w-72 sm:w-96">
            {board.map((cell, idx) => {
              const ownerIdx = players.findIndex((p) => p.id === cell.ownerId);
              const ownerPalette = ownerIdx !== -1 ? PLAYER_PALETTE[ownerIdx % PLAYER_PALETTE.length] : null;

              return (
                <button
                  key={idx}
                  onClick={() => handleCellClick(cell.row, cell.col)}
                  disabled={Boolean(cell.ownerId || roundOver || isPaused)}
                  aria-label={`Sector Row ${cell.row + 1} Col ${cell.col + 1}`}
                  className={`aspect-square rounded-xl flex items-center justify-center transition-all duration-200 relative group select-none shadow-sm
                    ${
                      cell.ownerId
                        ? `${ownerPalette?.bg} text-white shadow-md ${
                            cell.capturedThisTurn ? 'ring-4 ring-amber-300 scale-105 animate-pulse' : ''
                          }`
                        : 'bg-white/10 hover:bg-white/25 active:scale-95 border border-white/10 cursor-pointer'
                    }`}
                >
                  {cell.ownerId ? (
                    <Shield className="w-5 h-5 text-white/90 drop-shadow-md" />
                  ) : (
                    <span className="text-[10px] text-white/20 group-hover:text-white/60 font-mono">
                      {cell.row + 1},{cell.col + 1}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Capture toast banner */}
          {lastCaptureCount > 0 && !roundOver && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-amber-500 text-gray-950 font-black text-xs px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 animate-in bounce-in">
              <Sparkles className="w-3.5 h-3.5" />
              KABZA! Captured +{lastCaptureCount} Sector{lastCaptureCount > 1 ? 's' : ''}!
            </div>
          )}

          {/* Full Board Round Finish Overlay */}
          {roundOver && (
            <div className="absolute inset-4 bg-gray-900/95 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-xl flex flex-col items-center justify-center text-center gap-3 animate-in zoom-in-95">
              <Trophy className="w-12 h-12 text-amber-400 animate-bounce" />
              <h4 className="text-xl font-black text-white">Grid Fully Conquered!</h4>
              <p className="text-xs text-gray-300">
                All 36 territory sectors have been claimed. Computing supreme realm ruler...
              </p>
              <Button
                size="md"
                onClick={handleResetBoard}
                className="mt-2 bg-violet-600 hover:bg-violet-700 text-white font-bold flex items-center gap-2"
              >
                Start New Campaign <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Turn prompt & Rules hint */}
        <div className="mt-4 flex flex-col sm:flex-row items-center justify-between w-full max-w-md text-xs text-gray-600 gap-2 px-2">
          <div className="flex items-center gap-2">
            <span className={`w-3 h-3 rounded-full ${activeColor.bg}`} />
            <span className="font-bold text-gray-900">{activePlayer.name}'s turn</span>
            <span>to place an outpost</span>
          </div>
          <div className="flex items-center gap-1 text-gray-700">
            <Info className="w-3.5 h-3.5 text-primary-500" />
            <span>Surround enemy on 2 sides to capture!</span>
          </div>
        </div>
      </div>
    </div>
  );
};
