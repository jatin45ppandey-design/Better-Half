import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Zap,
  Timer,
  AlertTriangle,
  Sparkles,
  Info,
} from 'lucide-react';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface SnatchTheFriesProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  isPaused?: boolean;
}

interface FryItem {
  type: 'REGULAR' | 'GOLDEN' | 'SPICY' | 'SOGGY_TRAP';
  name: string;
  points: number;
  emoji: string;
  color: string;
}

const FRY_TYPES: FryItem[] = [
  { type: 'REGULAR', name: 'Crispy Golden Fry', points: 100, emoji: '🍟', color: 'from-amber-400 to-yellow-500' },
  { type: 'GOLDEN', name: 'Legendary 24K Fry', points: 250, emoji: '✨🍟✨', color: 'from-yellow-300 via-amber-300 to-yellow-500' },
  { type: 'SPICY', name: 'Spicy Peri-Peri Fry', points: 150, emoji: '🌶️🍟', color: 'from-red-500 to-orange-500' },
  { type: 'SOGGY_TRAP', name: 'Soggy Mystery Fry (Trap!)', points: -120, emoji: '🤢🍟', color: 'from-emerald-700 to-green-800' },
];

const TOTAL_DROPS = 8;
const HOTKEYS = ['Q', 'P', 'Z', 'M'];

export const SnatchTheFriesGame: React.FC<SnatchTheFriesProps> = ({
  players,
  onFinishMatch,
  isPaused = false,
}) => {
  const [dropRound, setDropRound] = useState(1);
  const [scores, setScores] = useState<{ [id: string]: number }>({});
  const [reactionTimes, setReactionTimes] = useState<{ [id: string]: number[] }>({});
  const [currentFry, setCurrentFry] = useState<FryItem | null>(null);
  const [dropState, setDropState] = useState<'WAITING' | 'DROPPED' | 'SNATCHED' | 'FALSE_START'>('WAITING');
  const [dropTimestamp, setDropTimestamp] = useState<number>(0);
  const [snatchMessage, setSnatchMessage] = useState<string | null>(null);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const matchFinishedRef = useRef(false);

  // Trigger random fry drop
  const scheduleNextDrop = useCallback(() => {
    if (dropRound > TOTAL_DROPS) return;

    setDropState('WAITING');
    setCurrentFry(null);
    setSnatchMessage(null);

    const randomDelay = Math.floor(Math.random() * 2600) + 1400; // 1.4s to 4s
    timeoutRef.current = setTimeout(() => {
      // Pick random fry type
      const rand = Math.random();
      let picked: FryItem;
      if (rand < 0.18) picked = FRY_TYPES[1]; // Golden
      else if (rand < 0.38) picked = FRY_TYPES[2]; // Spicy
      else if (rand < 0.52) picked = FRY_TYPES[3]; // Trap
      else picked = FRY_TYPES[0]; // Regular

      setCurrentFry(picked);
      setDropTimestamp(Date.now());
      setDropState('DROPPED');
    }, randomDelay);
  }, [dropRound]);

  useEffect(() => {
    if (!isPaused && dropRound <= TOTAL_DROPS && dropState === 'WAITING' && !currentFry) {
      scheduleNextDrop();
    }
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [dropRound, dropState, isPaused, currentFry, scheduleNextDrop]);

  // Snatch Action
  const handlePlayerSnatch = useCallback((playerIndex: number) => {
    if (isPaused || matchFinishedRef.current) return;
    const player = players[playerIndex];
    if (!player) return;

    if (dropState === 'WAITING') {
      // FALSE START PENALTY!
      const penalty = 50;
      setScores((prev) => ({
        ...prev,
        [player.id]: (prev[player.id] || 0) - penalty,
      }));
      setDropState('FALSE_START');
      setSnatchMessage(`⚠️ False Start by ${player.name}! -${penalty} pts penalty!`);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      setTimeout(() => {
        setDropState('WAITING');
        setSnatchMessage(null);
        scheduleNextDrop();
      }, 1500);
      return;
    }

    if (dropState === 'DROPPED' && currentFry) {
      // Valid Snatch!
      const reactionMs = Date.now() - dropTimestamp;
      setDropState('SNATCHED');

      const pts = currentFry.points;
      setScores((prev) => {
        const updated = {
          ...prev,
          [player.id]: (prev[player.id] || 0) + pts,
        };

        // Check if last round
        if (dropRound >= TOTAL_DROPS) {
          matchFinishedRef.current = true;
          setTimeout(() => {
            let highest = -9999;
            let winner = players[0];
            players.forEach((p) => {
              const sc = updated[p.id] || 0;
              if (sc > highest) {
                highest = sc;
                winner = p;
              }
            });

            onFinishMatch({
              winnerName: winner.name,
              playerScores: players.map((p) => {
                const times = reactionTimes[p.id] || [];
                const avgReaction = times.length ? Math.round(times.reduce((a, b) => a + b, 0) / times.length) : reactionMs;
                return {
                  playerId: p.id,
                  name: p.name,
                  avatarInitials: p.avatarInitials,
                  avatarColor: p.avatarColor,
                  score: updated[p.id] || 0,
                  isWinner: p.id === winner.id,
                  stats: [
                    { label: 'Total Score', value: `${updated[p.id] || 0} pts` },
                    { label: 'Avg Reaction', value: `${avgReaction} ms` },
                  ],
                };
              }),
            });
          }, 1500);
        }

        return updated;
      });

      setReactionTimes((prev) => ({
        ...prev,
        [player.id]: [...(prev[player.id] || []), reactionMs],
      }));

      setSnatchMessage(
        `${player.name} snatched the ${currentFry.name} in ${reactionMs}ms! (${pts >= 0 ? '+' : ''}${pts} pts)`
      );

      // Advance round
      setTimeout(() => {
        if (dropRound < TOTAL_DROPS) {
          setDropRound((r) => r + 1);
          setDropState('WAITING');
          setCurrentFry(null);
        }
      }, 1400);
    }
  }, [isPaused, dropState, currentFry, dropTimestamp, dropRound, onFinishMatch, players, reactionTimes, scheduleNextDrop]);

  // Keyboard shortcut listener (Q, P, Z, M)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toUpperCase();
      const pIdx = HOTKEYS.indexOf(key);
      if (pIdx !== -1 && pIdx < players.length) {
        handlePlayerSnatch(pIdx);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [players.length, handlePlayerSnatch]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-primary-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
            🍟
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Snatch The Fries</h3>
            <p className="text-xs text-gray-700">
              Round {Math.min(dropRound, TOTAL_DROPS)} of {TOTAL_DROPS} • Snatch fastest when fry drops! Beware false starts (-50)
            </p>
          </div>
        </div>

        {/* Real-time Scores */}
        <div className="flex items-center gap-2">
          {players.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-gray-200 bg-white text-xs font-semibold shadow-sm"
            >
              <div className={`w-5 h-5 rounded-md ${p.avatarColor} text-white flex items-center justify-center text-[10px]`}>
                {p.avatarInitials}
              </div>
              <span>{p.name}:</span>
              <span className="font-black text-amber-600">{scores[p.id] || 0}</span>
              <span className="text-[10px] bg-gray-100 text-gray-600 px-1 rounded font-mono font-bold">
                [{HOTKEYS[idx]}]
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Center Table & Plate */}
      <div className="relative flex flex-col items-center justify-center py-6">
        <div className="relative w-80 h-80 sm:w-96 sm:h-96 rounded-full bg-gradient-to-br from-amber-100 via-orange-50 to-amber-200 shadow-2xl border-8 border-amber-900/20 flex flex-col items-center justify-center p-6 select-none overflow-hidden">
          {/* Porcelain Plate texture */}
          <div className="w-64 h-64 sm:w-76 sm:h-76 rounded-full bg-white shadow-inner border-4 border-gray-200 flex flex-col items-center justify-center relative">
            {/* Center Status / Fry */}
            {dropState === 'WAITING' && (
              <div className="flex flex-col items-center gap-2 text-gray-700 animate-pulse">
                <Timer className="w-8 h-8 text-amber-500 animate-spin" />
                <span className="text-xs font-black uppercase tracking-widest text-amber-800">
                  Ready your hands...
                </span>
                <span className="text-[10px] text-gray-600">Fry dropping soon!</span>
              </div>
            )}

            {dropState === 'DROPPED' && currentFry && (
              <div className="flex flex-col items-center gap-2 animate-in zoom-in-50 duration-75">
                <div className={`text-6xl sm:text-7xl drop-shadow-xl filter drop-shadow-[0_10px_10px_rgba(0,0,0,0.2)] animate-bounce`}>
                  {currentFry.emoji}
                </div>
                <div className="bg-amber-500 text-gray-950 font-black text-xs px-3 py-1 rounded-full shadow-md animate-pulse">
                  SNATCH NOW! (+{currentFry.points} pts)
                </div>
              </div>
            )}

            {dropState === 'SNATCHED' && (
              <div className="flex flex-col items-center gap-2 animate-in zoom-in-75">
                <span className="text-4xl">⚡</span>
                <span className="text-xs font-black text-emerald-600 uppercase tracking-wider">
                  SNATCHED!
                </span>
              </div>
            )}

            {dropState === 'FALSE_START' && (
              <div className="flex flex-col items-center gap-2 text-red-500 animate-in shake">
                <AlertTriangle className="w-10 h-10" />
                <span className="text-xs font-black uppercase tracking-wider">
                  FALSE START!
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Snatch Toast Notification */}
        {snatchMessage && (
          <div className="mt-4 px-4 py-2 rounded-xl bg-gray-900 text-white font-bold text-xs shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
            <Sparkles className="w-4 h-4 text-amber-400" />
            {snatchMessage}
          </div>
        )}
      </div>

      {/* Interactive Snatch Buttons for All Players */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {players.map((p, idx) => (
          <button
            key={p.id}
            onClick={() => handlePlayerSnatch(idx)}
            className="group relative p-4 rounded-2xl bg-gradient-to-b from-white to-gray-50 border-2 border-primary-200 hover:border-amber-400 hover:shadow-xl active:scale-95 transition-all flex flex-col items-center gap-2 cursor-pointer"
          >
            <div className={`w-12 h-12 rounded-2xl ${p.avatarColor} text-white font-bold flex items-center justify-center text-lg shadow-md group-hover:scale-105 transition-transform`}>
              {p.avatarInitials}
            </div>

            <div className="text-center">
              <span className="font-bold text-sm text-gray-900 block truncate max-w-[120px]">
                {p.name}
              </span>
              <span className="text-xs font-mono font-bold text-primary-600">
                Key [{HOTKEYS[idx]}]
              </span>
            </div>

            <div className="w-full mt-1 py-2 px-3 rounded-xl bg-amber-500 group-hover:bg-amber-600 text-gray-950 font-black text-xs flex items-center justify-center gap-1.5 shadow-sm">
              <Zap className="w-3.5 h-3.5" />
              SNATCH!
            </div>
          </button>
        ))}
      </div>

      {/* Instructions footer */}
      <div className="flex items-center justify-between text-xs text-gray-700 px-2">
        <span className="flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5 text-primary-500" />
          Players can press their hotkey or click their personal Snatch button!
        </span>
        <span>Local Reaction Prototype</span>
      </div>
    </div>
  );
};
