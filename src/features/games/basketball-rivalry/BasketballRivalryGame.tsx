import React, { useState, useEffect, useRef } from 'react';
import {
  Trophy,
  Flame,
  Zap,
  Target,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface BasketballProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  isPaused?: boolean;
  sessionState?: any;
  onSendAction?: (action: any) => Promise<{ success: boolean; error?: string }>;
  currentUserId?: string;
}

const TOTAL_SHOTS_PER_PLAYER = 5;
const COURT_WIDTH = 640;
const COURT_HEIGHT = 420;
const BALL_START_X = 110;
const BALL_START_Y = 320;
const HOOP_X = 490;
const HOOP_Y = 160;

export const BasketballRivalryGame: React.FC<BasketballProps> = ({
  players,
  onFinishMatch,
  isPaused = false,
  sessionState,
  onSendAction,
  currentUserId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Player scores & stats
  const [localScores, setScores] = useState<{ [id: string]: number }>({});
  const [localShotsTaken, setShotsTaken] = useState<{ [id: string]: number }>({});
  const [localStreaks, setStreaks] = useState<{ [id: string]: number }>({});
  const [localCurrentTurnIdx, setCurrentTurnIdx] = useState(0);
  const isMultiplayer = Boolean(sessionState && onSendAction);
  const scores = isMultiplayer ? sessionState.scores || {} : localScores;
  const shotsTaken = isMultiplayer ? sessionState.shotsTaken || {} : localShotsTaken;
  const streaks = isMultiplayer ? sessionState.streaks || {} : localStreaks;
  const currentTurnIdx = isMultiplayer
    ? Math.max(0, players.findIndex((player) => player.id === sessionState.currentTurnUserId))
    : localCurrentTurnIdx;
  const isMyTurn = !isMultiplayer || sessionState.currentTurnUserId === currentUserId;
  const [angle, setAngle] = useState(52); // degrees
  const [power, setPower] = useState(70); // 30 - 100
  const [isPowerPulsing, setIsPowerPulsing] = useState(false);

  // Ball physics state
  const [localBallState, setBallState] = useState<{
    x: number;
    y: number;
    vx: number;
    vy: number;
    inFlight: boolean;
  }>({
    x: BALL_START_X,
    y: BALL_START_Y,
    vx: 0,
    vy: 0,
    inFlight: false,
  });
  const [serverBallState, setServerBallState] = useState({
    x: BALL_START_X, y: BALL_START_Y, vx: 0, vy: 0, inFlight: false,
  });
  const localLastShotResult = useRef<any>(null);
  const ballState = isMultiplayer ? serverBallState : localBallState;
  const lastShotResult = isMultiplayer
    ? sessionState.lastShotResult || { type: null, points: 0, text: '' }
    : localLastShotResult.current?.local || { type: null, points: 0, text: '' };

  const activePlayer = players[currentTurnIdx % players.length];
  const activeShots = shotsTaken[activePlayer.id] || 0;
  const activeStreak = streaks[activePlayer.id] || 0;

  // The server returns the completed trajectory and shot verdict. Clients only
  // animate those coordinates; they never decide points or whether a shot scored.
  useEffect(() => {
    if (!isMultiplayer) return;
    const result = sessionState.lastShotResult;
    const trajectory = result?.trajectory;
    if (!Array.isArray(trajectory) || trajectory.length === 0) return;

    let index = 0;
    let frameId = 0;
    const renderFrame = () => {
      const point = trajectory[index];
      if (point) {
        setServerBallState({
          x: point.x,
          y: point.y,
          vx: 0,
          vy: 0,
          inFlight: index < trajectory.length - 1,
        });
        index += 1;
      }
      if (index < trajectory.length) frameId = requestAnimationFrame(renderFrame);
    };
    frameId = requestAnimationFrame(renderFrame);
    return () => cancelAnimationFrame(frameId);
  }, [isMultiplayer, sessionState?.version, sessionState?.lastShotResult]);

  // Power pulsing oscillation for arcade feel
  useEffect(() => {
    if (!isPowerPulsing || ballState.inFlight || isPaused) return;
    const interval = setInterval(() => {
      setPower((p) => {
        const next = p + 4;
        return next > 95 ? 40 : next;
      });
    }, 40);
    return () => clearInterval(interval);
  }, [isPowerPulsing, ballState.inFlight, isPaused]);

  // Main Ball Flight Physics Loop
  useEffect(() => {
    if (isMultiplayer || !ballState.inFlight || isPaused) return;

    let animId: number;
    const gravity = 0.42;

    const tick = () => {
      setBallState((prev) => {
        if (!prev.inFlight) return prev;

        const nextX = prev.x + prev.vx;
        const nextY = prev.y + prev.vy;
        const nextVy = prev.vy + gravity;

        // Check if ball reached hoop vicinity
        if (nextX >= HOOP_X - 25 && nextX <= HOOP_X + 25 && prev.vy > 0) {
          const diffY = Math.abs(nextY - HOOP_Y);

          if (diffY < 18) {
            // Clean Swish! +3 pts
            handleShotResult('SWISH', 3, '🔥 SWISH! Pure Net (+3)');
            return { ...prev, x: HOOP_X, y: HOOP_Y + 40, inFlight: false, vx: 0, vy: 0 };
          } else if (diffY < 34) {
            // Bank Shot off rim/backboard! +2 pts
            handleShotResult('BANK', 2, '🏀 Bank Shot! Off the rim (+2)');
            return { ...prev, x: HOOP_X + 15, y: HOOP_Y + 45, inFlight: false, vx: 0, vy: 0 };
          }
        }

        // Check out of bounds / floor hit
        if (nextY >= COURT_HEIGHT - 30 || nextX > COURT_WIDTH + 50) {
          handleShotResult('MISS', 0, '💨 Missed! Clank!');
          return { ...prev, x: nextX, y: COURT_HEIGHT - 30, inFlight: false, vx: 0, vy: 0 };
        }

        return {
          ...prev,
          x: nextX,
          y: nextY,
          vy: nextVy,
        };
      });

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [ballState.inFlight, isPaused]);

  const handleShotResult = (type: 'SWISH' | 'BANK' | 'MISS', pts: number, text: string) => {
    if (isMultiplayer) return;
    const isScore = type !== 'MISS';
    const bonus = isScore && activeStreak >= 2 ? 1 : 0; // On-fire bonus
    const totalPts = pts + bonus;

    setLastShotResult({ type, points: totalPts, text: bonus ? `${text} +1 Fire Streak!` : text });

    const newScore = (scores[activePlayer.id] || 0) + totalPts;
    const newShots = activeShots + 1;
    const newStreak = isScore ? activeStreak + 1 : 0;

    const updatedScores = { ...scores, [activePlayer.id]: newScore };
    const updatedShots = { ...shotsTaken, [activePlayer.id]: newShots };
    const updatedStreaks = { ...streaks, [activePlayer.id]: newStreak };

    setScores(updatedScores);
    setShotsTaken(updatedShots);
    setStreaks(updatedStreaks);

    // Check if match over (all players took all shots)
    const allFinished = players.every((p) => (updatedShots[p.id] || 0) >= TOTAL_SHOTS_PER_PLAYER);

    setTimeout(() => {
      if (allFinished) {
        // Calculate match winner
        let highest = -1;
        let winner = players[0];
        players.forEach((p) => {
          const s = updatedScores[p.id] || 0;
          if (s > highest) {
            highest = s;
            winner = p;
          }
        });

        onFinishMatch({
          winnerName: winner.name,
          playerScores: players.map((p) => ({
            playerId: p.id,
            name: p.name,
            avatarInitials: p.avatarInitials,
            avatarColor: p.avatarColor,
            score: updatedScores[p.id] || 0,
            isWinner: p.id === winner.id,
            stats: [
              { label: 'Total Score', value: `${updatedScores[p.id] || 0} pts` },
              { label: 'Shots Made', value: `${updatedShots[p.id] || 0} / ${TOTAL_SHOTS_PER_PLAYER}` },
            ],
          })),
        });
      } else {
        // Reset ball to player and advance turn
        setBallState({
          x: BALL_START_X,
          y: BALL_START_Y,
          vx: 0,
          vy: 0,
          inFlight: false,
        });
        setCurrentTurnIdx((prev) => prev + 1);
      }
    }, 1400);
  };

  const handleShoot = () => {
    if (ballState.inFlight || isPaused || !isMyTurn || activeShots >= TOTAL_SHOTS_PER_PLAYER) return;
    if (isMultiplayer) {
      void onSendAction?.({ type: 'SHOOT', angle, power });
      return;
    }

    // Convert angle to radians
    const rad = (angle * Math.PI) / 180;
    const speed = power * 0.22; // speed factor
    const vx = Math.cos(rad) * speed;
    const vy = -Math.sin(rad) * speed;

    setBallState({
      x: BALL_START_X,
      y: BALL_START_Y,
      vx,
      vy,
      inFlight: true,
    });
  };

  // Canvas render court
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

    // Hardwood court gradient
    const courtGrad = ctx.createLinearGradient(0, 0, 0, COURT_HEIGHT);
    courtGrad.addColorStop(0, '#1e293b'); // Arena backdrop
    courtGrad.addColorStop(0.68, '#334155');
    courtGrad.addColorStop(0.7, '#d97706'); // Hardwood floor
    courtGrad.addColorStop(1, '#b45309');
    ctx.fillStyle = courtGrad;
    ctx.fillRect(0, 0, COURT_WIDTH, COURT_HEIGHT);

    // Court key lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(HOOP_X - 10, COURT_HEIGHT - 30, 90, Math.PI, Math.PI * 2);
    ctx.stroke();

    // 3-Point line arc
    ctx.beginPath();
    ctx.arc(HOOP_X - 20, COURT_HEIGHT - 30, 240, Math.PI, Math.PI * 1.6);
    ctx.stroke();

    // Hoop Post
    ctx.strokeStyle = '#475569';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(HOOP_X + 45, COURT_HEIGHT - 30);
    ctx.lineTo(HOOP_X + 45, HOOP_Y - 40);
    ctx.stroke();

    // Backboard
    ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.fillRect(HOOP_X + 38, HOOP_Y - 50, 8, 70);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.strokeRect(HOOP_X + 38, HOOP_Y - 30, 8, 30);

    // Rim
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(HOOP_X + 38, HOOP_Y);
    ctx.lineTo(HOOP_X, HOOP_Y);
    ctx.stroke();

    // Net
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(HOOP_X, HOOP_Y);
    ctx.lineTo(HOOP_X + 10, HOOP_Y + 28);
    ctx.lineTo(HOOP_X + 32, HOOP_Y + 28);
    ctx.lineTo(HOOP_X + 38, HOOP_Y);
    ctx.stroke();

    // Trajectory Aim Guide (when ball is ready)
    if (!ballState.inFlight) {
      ctx.save();
      ctx.strokeStyle = 'rgba(251, 146, 60, 0.5)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 6]);
      ctx.beginPath();
      ctx.moveTo(BALL_START_X, BALL_START_Y);

      const rad = (angle * Math.PI) / 180;
      const speed = power * 0.22;
      let simX = BALL_START_X;
      let simY = BALL_START_Y;
      let simVy = -Math.sin(rad) * speed;
      const simVx = Math.cos(rad) * speed;

      for (let t = 0; t < 18; t++) {
        simX += simVx;
        simY += simVy;
        simVy += 0.42;
        ctx.lineTo(simX, simY);
      }
      ctx.stroke();
      ctx.restore();
    }

    // Basketball
    ctx.save();
    ctx.translate(ballState.x, ballState.y);

    // Ball shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
    ctx.beginPath();
    ctx.ellipse(0, COURT_HEIGHT - 30 - ballState.y, 14, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Ball sphere
    const ballGrad = ctx.createRadialGradient(-3, -3, 2, 0, 0, 14);
    ballGrad.addColorStop(0, '#fb923c');
    ballGrad.addColorStop(1, '#c2410c');
    ctx.fillStyle = ballGrad;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.fill();

    // Ball black seams
    ctx.strokeStyle = '#7c2d12';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 13, 0, Math.PI * 2);
    ctx.moveTo(-13, 0);
    ctx.lineTo(13, 0);
    ctx.stroke();

    ctx.restore();
  }, [ballState, angle, power]);

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-primary-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center font-black">
            🏀
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Basketball Rivalry Shootout</h3>
            <p className="text-xs text-gray-700">
              {TOTAL_SHOTS_PER_PLAYER} shots each • Swish (+3), Bank (+2), Flame streak bonuses!
            </p>
          </div>
        </div>

        {/* Players Standings */}
        <div className="flex items-center gap-2">
          {players.map((p) => {
            const isTurn = p.id === activePlayer.id;
            const pStreak = streaks[p.id] || 0;
            return (
              <div
                key={p.id}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                  isTurn
                    ? 'border-orange-500 bg-orange-50 text-orange-950 shadow-sm ring-1 ring-orange-400'
                    : 'border-gray-200 bg-white text-gray-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-md ${p.avatarColor} text-white flex items-center justify-center text-[10px]`}>
                  {p.avatarInitials}
                </div>
                <span>{p.name}:</span>
                <span className="font-black text-sm">{scores[p.id] || 0}</span>
                {pStreak >= 2 && (
                  <span className="flex items-center text-red-500 font-bold text-[10px]">
                    <Flame className="w-3 h-3 fill-red-500" /> {pStreak}x
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Arcade Court Canvas */}
      <div className="relative flex flex-col items-center">
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-slate-700 bg-slate-900">
          <canvas
            ref={canvasRef}
            width={COURT_WIDTH}
            height={COURT_HEIGHT}
            className="block select-none"
          />

          {/* Shot Feedback Toast */}
          {lastShotResult.type && (
            <div
              className={`absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 rounded-xl shadow-xl font-black text-sm flex items-center gap-2 animate-in zoom-in-90 ${
                lastShotResult.type === 'SWISH'
                  ? 'bg-amber-400 text-gray-950'
                  : lastShotResult.type === 'BANK'
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-800 text-gray-300'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              {lastShotResult.text}
            </div>
          )}

          {/* Player Turn Watermark */}
          <div className="absolute bottom-4 left-6 bg-black/60 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/10 text-white text-xs flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-orange-500 animate-ping" />
            <span className="font-bold">{activePlayer.name}</span>
            <span className="text-gray-400">
              • Shot {Math.min(TOTAL_SHOTS_PER_PLAYER, activeShots + 1)} / {TOTAL_SHOTS_PER_PLAYER}
            </span>
          </div>
        </div>

        {/* Shooting Control Dashboard */}
        <div className="w-full max-w-2xl mt-4 bg-white/90 backdrop-blur-md p-5 rounded-2xl border border-primary-100 shadow-sm flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Angle Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5 text-primary-600" /> Trajectory Arc
                </span>
                <span className="font-mono font-bold text-primary-700">{angle}°</span>
              </div>
              <input
                type="range"
                min="35"
                max="75"
                value={angle}
                disabled={ballState.inFlight || (isMultiplayer && !isMyTurn)}
                onChange={(e) => setAngle(Number(e.target.value))}
                className="w-full accent-primary-600 cursor-pointer"
              />
            </div>

            {/* Power Slider */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between text-xs font-semibold text-gray-700">
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5 text-orange-600" /> Shot Power
                </span>
                <span className="font-mono font-bold text-orange-600">{power}%</span>
              </div>
              <input
                type="range"
                min="40"
                max="95"
                value={power}
                disabled={ballState.inFlight || (isMultiplayer && !isMyTurn)}
                onChange={(e) => setPower(Number(e.target.value))}
                className="w-full accent-orange-500 cursor-pointer"
              />
            </div>
          </div>

          {/* Action Shoot Button */}
          <div className="flex items-center justify-between gap-4 pt-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPowerPulsing(!isPowerPulsing)}
              disabled={isMultiplayer || ballState.inFlight}
              className="text-xs text-gray-700"
            >
              {isPowerPulsing ? '⏸ Lock Meter' : '⚡ Auto-Pulse Meter'}
            </Button>

            <Button
              size="lg"
              onClick={handleShoot}
              disabled={ballState.inFlight || !isMyTurn || activeShots >= TOTAL_SHOTS_PER_PLAYER}
              className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black text-base shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
            >
              <Trophy className="w-5 h-5" />
              RELEASE SHOT!
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
