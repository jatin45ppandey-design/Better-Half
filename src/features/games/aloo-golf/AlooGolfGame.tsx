import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw,
  Trophy,
  Target,
  Zap,
  Flag,
  Info,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface AlooGolfProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  isPaused?: boolean;
  sessionState?: any;
  onSendAction?: (action: any) => Promise<{ success: boolean; error?: string }>;
  currentUserId?: string;
}

interface HoleConfig {
  number: number;
  name: string;
  par: number;
  startX: number;
  startY: number;
  holeX: number;
  holeY: number;
  hazards: Array<{ x: number; y: number; width: number; height: number; type: 'BUTTER' | 'SAND' }>;
  obstacles: Array<{ x: number; y: number; radius: number }>;
}

const HOLES: HoleConfig[] = [
  {
    number: 1,
    name: 'The Spud Meadow',
    par: 3,
    startX: 90,
    startY: 210,
    holeX: 540,
    holeY: 210,
    hazards: [
      { x: 280, y: 150, width: 80, height: 120, type: 'SAND' },
    ],
    obstacles: [],
  },
  {
    number: 2,
    name: 'Butter Slip Bunker',
    par: 3,
    startX: 80,
    startY: 320,
    holeX: 540,
    holeY: 100,
    hazards: [
      { x: 240, y: 80, width: 90, height: 100, type: 'BUTTER' },
      { x: 380, y: 220, width: 80, height: 110, type: 'SAND' },
    ],
    obstacles: [
      { x: 300, y: 220, radius: 24 },
    ],
  },
  {
    number: 3,
    name: 'Peri-Peri Volcano',
    par: 4,
    startX: 90,
    startY: 210,
    holeX: 550,
    holeY: 210,
    hazards: [
      { x: 220, y: 130, width: 70, height: 160, type: 'SAND' },
      { x: 390, y: 130, width: 70, height: 160, type: 'BUTTER' },
    ],
    obstacles: [
      { x: 310, y: 140, radius: 20 },
      { x: 310, y: 280, radius: 20 },
    ],
  },
];

const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 420;

export const AlooGolfGame: React.FC<AlooGolfProps> = ({
  players,
  onFinishMatch,
  isPaused = false,
  sessionState,
  onSendAction,
  currentUserId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [localCurrentHoleIdx, setCurrentHoleIdx] = useState(0);
  const isMultiplayer = Boolean(sessionState && onSendAction);
  const currentHoleIdx = isMultiplayer ? sessionState.currentHoleIdx : localCurrentHoleIdx;
  const currentHole: HoleConfig = isMultiplayer ? sessionState.hole : HOLES[currentHoleIdx];

  // Strokes per player per hole: strokes[holeIdx][playerId]
  const [localHoleStrokes, setHoleStrokes] = useState<{ [hole: number]: { [pId: string]: number } }>({
    0: {},
    1: {},
    2: {},
  });

  const [localCurrentTurnIdx, setCurrentTurnIdx] = useState(0);
  const currentTurnIdx = isMultiplayer
    ? Math.max(0, players.findIndex((player) => player.id === sessionState.currentTurnUserId))
    : localCurrentTurnIdx;
  const holeStrokes = isMultiplayer ? sessionState.holeStrokes || {} : localHoleStrokes;
  const [completedPlayersThisHole, setCompletedPlayersThisHole] = useState<string[]>([]);

  const [localBall, setBall] = useState<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    inMotion: boolean;
    rotation: number;
  }>({
    x: currentHole.startX,
    y: currentHole.startY,
    vx: 0,
    vy: 0,
    inMotion: false,
    rotation: 0,
  });

  const [aimAngle, setAimAngle] = useState(0); // degrees
  const [shotPower, setShotPower] = useState(60);
  const [holeToast, setHoleToast] = useState<string | null>(null);
  const [serverBall, setServerBall] = useState<any>(null);
  const activePlayer = players[currentTurnIdx % players.length];
  const isMyTurn = !isMultiplayer || sessionState.currentTurnUserId === currentUserId;
  const activeServerBall = isMultiplayer ? sessionState.balls?.[activePlayer.id] : null;
  const ball = isMultiplayer
    ? serverBall || {
        x: activeServerBall?.x ?? currentHole.startX,
        y: activeServerBall?.y ?? currentHole.startY,
        vx: 0,
        vy: 0,
        inMotion: false,
        rotation: 0,
      }
    : localBall;
  const activeStrokes = holeStrokes[currentHoleIdx]?.[activePlayer.id] || 0;

  // Total strokes across all played holes
  const getTotalStrokes = (pId: string) => {
    if (isMultiplayer) return sessionState.totalStrokes?.[pId] || 0;
    let sum = 0;
    for (let h = 0; h < HOLES.length; h++) {
      sum += holeStrokes[h]?.[pId] || 0;
    }
    return sum;
  };

  // Ball Movement & Rolling Simulation Loop. In a room, only the server
  // simulates collision physics; this component animates the returned path.
  useEffect(() => {
    if (isMultiplayer || !ball.inMotion || isPaused) return;

    let animId: number;

    const tick = () => {
      setBall((prev) => {
        if (!prev.inMotion) return prev;

        let friction = 0.965; // Normal fairway

        // Check Hazards
        currentHole.hazards.forEach((h) => {
          if (
            prev.x >= h.x &&
            prev.x <= h.x + h.width &&
            prev.y >= h.y &&
            prev.y <= h.y + h.height
          ) {
            if (h.type === 'SAND') friction = 0.88; // Deep sand slows down
            if (h.type === 'BUTTER') friction = 0.99; // Slippery butter
          }
        });

        let nextX = prev.x + prev.vx;
        let nextY = prev.y + prev.vy;
        let nextVx = prev.vx * friction;
        let nextVy = prev.vy * friction;

        // Wall collisions
        const margin = 20;
        if (nextX <= margin || nextX >= CANVAS_WIDTH - margin) {
          nextVx = -nextVx * 0.8;
          nextX = Math.max(margin, Math.min(CANVAS_WIDTH - margin, nextX));
        }
        if (nextY <= margin || nextY >= CANVAS_HEIGHT - margin) {
          nextVy = -nextVy * 0.8;
          nextY = Math.max(margin, Math.min(CANVAS_HEIGHT - margin, nextY));
        }

        // Circular Obstacle Collisions
        currentHole.obstacles.forEach((obs) => {
          const dx = nextX - obs.x;
          const dy = nextY - obs.y;
          const dist = Math.hypot(dx, dy);
          if (dist < obs.radius + 12) {
            const nx = dx / dist;
            const ny = dy / dist;
            nextVx = nx * 5;
            nextVy = ny * 5;
          }
        });

        // Check Hole / Cup sink
        const distToHole = Math.hypot(nextX - currentHole.holeX, nextY - currentHole.holeY);
        const speed = Math.hypot(nextVx, nextVy);

        if (distToHole < 16 && speed < 3.2) {
          // Ball sunk in cup!
          handleBallSunk(nextX, nextY);
          return {
            ...prev,
            x: currentHole.holeX,
            y: currentHole.holeY,
            vx: 0,
            vy: 0,
            inMotion: false,
          };
        }

        // Rest threshold
        if (speed < 0.12) {
          return {
            ...prev,
            vx: 0,
            vy: 0,
            inMotion: false,
          };
        }

        return {
          ...prev,
          x: nextX,
          y: nextY,
          vx: nextVx,
          vy: nextVy,
          rotation: prev.rotation + speed * 0.08,
        };
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [ball.inMotion, isPaused, currentHole, isMultiplayer]);

  const handleBallSunk = useCallback((_sunkX: number, _sunkY: number) => {
    const finalStrokes = activeStrokes + 1;
    const diff = finalStrokes - currentHole.par;
    let label = 'Par';
    if (diff <= -2) label = '🦅 Eagle!';
    else if (diff === -1) label = '🐦 Birdie!';
    else if (diff === 0) label = '⛳ Par';
    else if (diff === 1) label = 'Bogey';
    else label = 'Double Bogey+';

    setHoleToast(`${activePlayer.name} finished Hole ${currentHole.number} in ${finalStrokes} strokes! (${label})`);

    const updatedHole = {
      ...holeStrokes[currentHoleIdx],
      [activePlayer.id]: finalStrokes,
    };
    const updatedAll = {
      ...holeStrokes,
      [currentHoleIdx]: updatedHole,
    };
    setHoleStrokes(updatedAll);

    const nextCompleted = [...completedPlayersThisHole, activePlayer.id];
    setCompletedPlayersThisHole(nextCompleted);

    setTimeout(() => {
      setHoleToast(null);

      // Check if all players finished this hole
      if (nextCompleted.length >= players.length) {
        if (currentHoleIdx + 1 < HOLES.length) {
          // Advance to next hole!
          const nextH = currentHoleIdx + 1;
          setCurrentHoleIdx(nextH);
          setCompletedPlayersThisHole([]);
          setBall({
            x: HOLES[nextH].startX,
            y: HOLES[nextH].startY,
            vx: 0,
            vy: 0,
            inMotion: false,
            rotation: 0,
          });
          setCurrentTurnIdx(0);
        } else {
          // Final match finish! Lowest total strokes wins
          let lowest = 9999;
          let champ = players[0];
          players.forEach((p) => {
            let total = 0;
            for (let h = 0; h < HOLES.length; h++) {
              total += updatedAll[h]?.[p.id] || 0;
            }
            if (total < lowest) {
              lowest = total;
              champ = p;
            }
          });

          onFinishMatch({
            winnerName: champ.name,
            playerScores: players.map((p) => {
              let total = 0;
              for (let h = 0; h < HOLES.length; h++) {
                total += updatedAll[h]?.[p.id] || 0;
              }
              return {
                playerId: p.id,
                name: p.name,
                avatarInitials: p.avatarInitials,
                avatarColor: p.avatarColor,
                score: total, // In golf, lower is better
                isWinner: p.id === champ.id,
                stats: [
                  { label: 'Total Strokes', value: `${total} strokes` },
                  { label: 'Holes Finished', value: `${HOLES.length} Holes` },
                ],
              };
            }),
          });
        }
      } else {
        // Next player's turn on this hole
        setCurrentTurnIdx((prev) => prev + 1);
        setBall({
          x: currentHole.startX,
          y: currentHole.startY,
          vx: 0,
          vy: 0,
          inMotion: false,
          rotation: 0,
        });
      }
    }, 1800);
  }, [activePlayer, currentHole, currentHoleIdx, holeStrokes, completedPlayersThisHole, players, onFinishMatch, activeStrokes]);

  const handlePutt = () => {
    if (ball.inMotion || isPaused || !isMyTurn || (isMultiplayer && (activeServerBall?.sunk || sessionState.matchOver))) return;
    if (isMultiplayer) {
      const serverAngle = ((aimAngle % 360) + 360) % 360;
      void onSendAction?.({ type: 'STROKE', angle: serverAngle, power: shotPower });
      return;
    }

    // Increment stroke counter
    setHoleStrokes((prev) => ({
      ...prev,
      [currentHoleIdx]: {
        ...prev[currentHoleIdx],
        [activePlayer.id]: (prev[currentHoleIdx]?.[activePlayer.id] || 0) + 1,
      },
    }));

    const rad = (aimAngle * Math.PI) / 180;
    const speed = shotPower * 0.16;

    setBall((prev) => ({
      ...prev,
      vx: Math.cos(rad) * speed,
      vy: Math.sin(rad) * speed,
      inMotion: true,
    }));
  };

  useEffect(() => {
    if (!isMultiplayer) {
      setServerBall(null);
      return;
    }

    const trajectory = sessionState.lastTrajectory;
    if (!Array.isArray(trajectory) || trajectory.length === 0) return;

    let index = 0;
    let frameId = 0;
    const renderFrame = () => {
      const point = trajectory[index];
      if (point) {
        setServerBall({
          x: point.x,
          y: point.y,
          vx: 0,
          vy: 0,
          inMotion: index < trajectory.length - 1,
          rotation: index * 0.12,
        });
        index += 1;
      }

      if (index < trajectory.length) {
        frameId = requestAnimationFrame(renderFrame);
      } else {
        const latestBall = sessionState.balls?.[activePlayer.id];
        setServerBall({
          x: latestBall?.x ?? currentHole.startX,
          y: latestBall?.y ?? currentHole.startY,
          vx: 0,
          vy: 0,
          inMotion: false,
          rotation: 0,
        });
      }
    };

    frameId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(frameId);
  }, [isMultiplayer, sessionState?.version, sessionState?.lastTrajectory, sessionState?.balls, currentUserId, activePlayer.id, currentHole.startX, currentHole.startY]);

  // Canvas render mini golf course
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Green Fairway background
    ctx.fillStyle = '#15803d'; // Green 700
    ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Outer Wooden borders
    ctx.strokeStyle = '#78350f';
    ctx.lineWidth = 24;
    ctx.strokeRect(12, 12, CANVAS_WIDTH - 24, CANVAS_HEIGHT - 24);

    // Fairway cut pattern stripes
    ctx.fillStyle = '#16a34a'; // Green 600
    for (let x = 30; x < CANVAS_WIDTH - 30; x += 50) {
      ctx.fillRect(x, 24, 25, CANVAS_HEIGHT - 48);
    }

    // Hazards
    currentHole.hazards.forEach((h) => {
      if (h.type === 'SAND') {
        ctx.fillStyle = '#fef08a'; // Sand yellow
        ctx.beginPath();
        ctx.roundRect(h.x, h.y, h.width, h.height, 16);
        ctx.fill();
        ctx.strokeStyle = '#ca8a04';
        ctx.lineWidth = 2;
        ctx.stroke();
      } else if (h.type === 'BUTTER') {
        ctx.fillStyle = '#fde047'; // Butter gloss
        ctx.beginPath();
        ctx.roundRect(h.x, h.y, h.width, h.height, 16);
        ctx.fill();
        ctx.strokeStyle = '#eab308';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });

    // Obstacles (Boulders / Peppers)
    currentHole.obstacles.forEach((obs) => {
      ctx.fillStyle = '#dc2626'; // Pepper red
      ctx.beginPath();
      ctx.arc(obs.x, obs.y, obs.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#991b1b';
      ctx.lineWidth = 3;
      ctx.stroke();
    });

    // Tee Off Mat
    ctx.fillStyle = '#065f46';
    ctx.beginPath();
    ctx.roundRect(currentHole.startX - 18, currentHole.startY - 18, 36, 36, 6);
    ctx.fill();

    // The Hole (Cup)
    ctx.fillStyle = '#111827';
    ctx.beginPath();
    ctx.arc(currentHole.holeX, currentHole.holeY, 14, 0, Math.PI * 2);
    ctx.fill();

    // Flagstick
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(currentHole.holeX, currentHole.holeY);
    ctx.lineTo(currentHole.holeX, currentHole.holeY - 45);
    ctx.stroke();

    // Red Flag
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.moveTo(currentHole.holeX, currentHole.holeY - 45);
    ctx.lineTo(currentHole.holeX - 22, currentHole.holeY - 35);
    ctx.lineTo(currentHole.holeX, currentHole.holeY - 25);
    ctx.closePath();
    ctx.fill();

    // Aim Guideline (when ball stationary)
    if (!ball.inMotion) {
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);

      const rad = (aimAngle * Math.PI) / 180;
      const guideLen = Math.min(120, shotPower * 1.5);
      ctx.lineTo(ball.x + Math.cos(rad) * guideLen, ball.y + Math.sin(rad) * guideLen);
      ctx.stroke();
      ctx.restore();
    }

    // Aloo (Potato) Golf Ball
    ctx.save();
    ctx.translate(ball.x, ball.y);
    ctx.rotate(ball.rotation);

    // Potato shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.ellipse(2, 4, 12, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    // Potato eccentric shape
    ctx.fillStyle = '#b45309'; // Potato brown skin
    ctx.beginPath();
    ctx.ellipse(0, 0, 11, 8, Math.PI / 6, 0, Math.PI * 2);
    ctx.fill();

    // Potato sprouts/dots
    ctx.fillStyle = '#78350f';
    ctx.beginPath();
    ctx.arc(-4, -2, 1.2, 0, Math.PI * 2);
    ctx.arc(3, 2, 1.2, 0, Math.PI * 2);
    ctx.arc(1, -3, 1, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }, [ball, currentHole, aimAngle, shotPower]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-primary-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 text-green-700 flex items-center justify-center font-black">
            🥔⛳
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Aloo Golf: Mini-Course Tour</h3>
            <p className="text-xs text-gray-700">
              Hole {currentHole.number} of {HOLES.length}: "{currentHole.name}" • Par {currentHole.par}
              {isMultiplayer ? ' • Server-synchronized' : ''}
            </p>
          </div>
        </div>

        {/* Players Scoreboard */}
        <div className="flex items-center gap-2">
          {players.map((p) => {
            const isTurn = p.id === activePlayer.id;
            const total = getTotalStrokes(p.id);
            return (
              <div
                key={p.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  isTurn
                    ? 'border-green-500 bg-green-50 text-green-950 shadow-sm ring-1 ring-green-400'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-md ${p.avatarColor} text-white flex items-center justify-center text-[10px]`}>
                  {p.avatarInitials}
                </div>
                <span>{p.name}:</span>
                <span className="font-black text-green-700">{total} strokes</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Course Canvas */}
      <div className="relative flex flex-col items-center">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-950 bg-green-800">
          <canvas
            ref={canvasRef}
            width={CANVAS_WIDTH}
            height={CANVAS_HEIGHT}
            className="block select-none"
          />

          {/* Sunk Ball Toast */}
          {holeToast && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl bg-gray-950 text-amber-300 font-black text-sm shadow-2xl border border-amber-400/40 flex items-center gap-2 animate-in zoom-in-90">
              <Flag className="w-5 h-5 text-red-500" />
              {holeToast}
            </div>
          )}

          {/* Current Player Indicator */}
          <div className="absolute bottom-4 left-6 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-white text-xs flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-400 animate-pulse" />
            <span className="font-bold">{activePlayer.name}</span>
            <span className="text-gray-300">• Stroke #{activeStrokes + 1}</span>
          </div>
        </div>

        {/* Putting Controls Dashboard */}
        <div className="w-full max-w-2xl mt-4 bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-primary-100 shadow-sm flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Putt Angle Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-primary-600" /> Putt Aim Direction
                </span>
                <span className="font-mono font-bold text-primary-700">{aimAngle}°</span>
              </div>
              <input
                type="range"
                min="-180"
                max="180"
                value={aimAngle}
                disabled={ball.inMotion || (isMultiplayer && !isMyTurn)}
                onChange={(e) => setAimAngle(Number(e.target.value))}
                className="w-full accent-primary-600 cursor-pointer"
              />
            </div>

            {/* Putt Power Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-green-600" /> Putt Power
                </span>
                <span className="font-mono font-bold text-green-600">{shotPower}%</span>
              </div>
              <input
                type="range"
                min="20"
                max="100"
                value={shotPower}
                disabled={ball.inMotion || (isMultiplayer && !isMyTurn)}
                onChange={(e) => setShotPower(Number(e.target.value))}
                className="w-full accent-green-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Action Putt Button */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAimAngle((prev) => (prev + 180 > 180 ? prev - 180 : prev + 180))}
              disabled={ball.inMotion || (isMultiplayer && !isMyTurn)}
              className="text-xs text-gray-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Reverse Aim (180°)
            </Button>

            <Button
              size="lg"
              onClick={handlePutt}
              disabled={ball.inMotion || (isMultiplayer && (!isMyTurn || activeServerBall?.sunk || sessionState.matchOver))}
              className="flex-1 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-black text-base shadow-lg shadow-green-600/30 flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              PUTT THE ALOO!
            </Button>
          </div>
        </div>

        {/* Course Rules hint */}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
          <Info className="w-4 h-4 text-primary-500" />
          <span>
            Yellow butter areas are frictionless slide zones; light sand traps slow your potato down!
          </span>
        </div>
      </div>
    </div>
  );
};
