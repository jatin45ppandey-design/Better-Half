import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RotateCcw,
  Trophy,
  Zap,
  Target,
  ChevronRight,
  ShieldAlert,
  Info,
} from 'lucide-react';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface PenFightProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  isPaused?: boolean;
}

interface Pen {
  id: string;
  name: string;
  color: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number; // in radians
  length: number;
  width: number;
  isAlive: boolean;
}

const ARENA_WIDTH = 640;
const ARENA_HEIGHT = 440;
const PADDING = 40;
const FRICTION = 0.96;
const REST_THRESHOLD = 0.15;
const TARGET_ROUND_WINS = 3;

const PEN_COLORS = [
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#06b6d4', // Cyan
  '#eab308', // Amber
];

export const PenFightGame: React.FC<PenFightProps> = ({
  players,
  onFinishMatch,
  isPaused = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [round, setRound] = useState(1);
  const [roundWins, setRoundWins] = useState<{ [playerId: string]: number }>({});
  const [currentTurnIdx, setCurrentTurnIdx] = useState(0);
  const [isAiming, setIsAiming] = useState(false);
  const [aimVector, setAimVector] = useState<{ dx: number; dy: number; power: number }>({ dx: 0, dy: 0, power: 0 });
  const [isSimulating, setIsSimulating] = useState(false);
  const [roundWinner, setRoundWinner] = useState<string | null>(null);
  const [fallMessage, setFallMessage] = useState<string | null>(null);

  // Initialize pens
  const spawnPens = useCallback(() => {
    const penList: Pen[] = [];
    const spawnPositions = [
      { x: PADDING + 80, y: PADDING + 80, angle: Math.PI / 4 },
      { x: ARENA_WIDTH - PADDING - 80, y: ARENA_HEIGHT - PADDING - 80, angle: -Math.PI * 0.75 },
      { x: ARENA_WIDTH - PADDING - 80, y: PADDING + 80, angle: Math.PI * 0.75 },
      { x: PADDING + 80, y: ARENA_HEIGHT - PADDING - 80, angle: -Math.PI / 4 },
    ];

    players.forEach((p, i) => {
      const pos = spawnPositions[i % spawnPositions.length];
      penList.push({
        id: p.id,
        name: p.name,
        color: PEN_COLORS[i % PEN_COLORS.length],
        x: pos.x,
        y: pos.y,
        vx: 0,
        vy: 0,
        angle: pos.angle,
        length: 44,
        width: 14,
        isAlive: true,
      });
    });
    return penList;
  }, [players]);

  const [pens, setPens] = useState<Pen[]>(spawnPens);
  const pensRef = useRef<Pen[]>(pens);

  useEffect(() => {
    pensRef.current = pens;
  }, [pens]);

  const activePlayer = players[currentTurnIdx] || players[0];
  const activePen = pens.find((p) => p.id === activePlayer.id);

  // Check round victory
  const checkRoundStatus = useCallback((currentPens: Pen[]) => {
    const alive = currentPens.filter((p) => p.isAlive);
    if (alive.length === 1) {
      const winner = alive[0];
      setRoundWinner(winner.name);
      setRoundWins((prev) => {
        const nextWins = (prev[winner.id] || 0) + 1;
        const updated = { ...prev, [winner.id]: nextWins };

        if (nextWins >= TARGET_ROUND_WINS) {
          setTimeout(() => {
            onFinishMatch({
              winnerName: winner.name,
              playerScores: players.map((p) => ({
                playerId: p.id,
                name: p.name,
                avatarInitials: p.avatarInitials,
                avatarColor: p.avatarColor,
                score: updated[p.id] || 0,
                isWinner: p.id === winner.id,
                stats: [
                  { label: 'Rounds Won', value: updated[p.id] || 0 },
                  { label: 'Target', value: TARGET_ROUND_WINS },
                ],
              })),
            });
          }, 1200);
        }
        return updated;
      });
    } else if (alive.length === 0) {
      setRoundWinner('DRAW');
    }
  }, [players, onFinishMatch]);

  // Main 2D Physics Animation Loop
  useEffect(() => {
    let animId: number;

    const updatePhysics = () => {
      if (isPaused) {
        animId = requestAnimationFrame(updatePhysics);
        return;
      }

      if (isSimulating) {
        let anyMoving = false;
        const updated = pensRef.current.map((pen) => ({ ...pen }));

        // 1. Move pens & apply friction
        for (let i = 0; i < updated.length; i++) {
          const pen = updated[i];
          if (!pen.isAlive) continue;

          pen.x += pen.vx;
          pen.y += pen.vy;
          pen.vx *= FRICTION;
          pen.vy *= FRICTION;

          if (Math.abs(pen.vx) > REST_THRESHOLD || Math.abs(pen.vy) > REST_THRESHOLD) {
            anyMoving = true;
            // update angle slightly in motion direction
            pen.angle = Math.atan2(pen.vy, pen.vx);
          } else {
            pen.vx = 0;
            pen.vy = 0;
          }

          // Boundary / Desk Fall Detection
          if (
            pen.x < PADDING ||
            pen.x > ARENA_WIDTH - PADDING ||
            pen.y < PADDING ||
            pen.y > ARENA_HEIGHT - PADDING
          ) {
            pen.isAlive = false;
            pen.vx = 0;
            pen.vy = 0;
            setFallMessage(`${pen.name}'s pen fell off the desk!`);
            setTimeout(() => setFallMessage(null), 2000);
          }
        }

        // 2. Simple Pen-to-Pen elastic collision
        for (let i = 0; i < updated.length; i++) {
          for (let j = i + 1; j < updated.length; j++) {
            const p1 = updated[i];
            const p2 = updated[j];
            if (!p1.isAlive || !p2.isAlive) continue;

            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const dist = Math.hypot(dx, dy);
            const minDist = (p1.length + p2.length) * 0.42;

            if (dist < minDist && dist > 0) {
              // Overlap resolution
              const overlap = minDist - dist;
              const nx = dx / dist;
              const ny = dy / dist;

              p1.x -= (nx * overlap) / 2;
              p1.y -= (ny * overlap) / 2;
              p2.x += (nx * overlap) / 2;
              p2.y += (ny * overlap) / 2;

              // Momentum exchange
              const kx = p1.vx - p2.vx;
              const ky = p1.vy - p2.vy;
              const p = 2 * (nx * kx + ny * ky) / 2;

              p1.vx -= p * nx * 0.9;
              p1.vy -= p * ny * 0.9;
              p2.vx += p * nx * 0.9;
              p2.vy += p * ny * 0.9;

              anyMoving = true;
            }
          }
        }

        setPens(updated);

        // Simulation concluded when all pens come to rest
        if (!anyMoving) {
          setIsSimulating(false);
          checkRoundStatus(updated);

          // Advance turn to next alive player
          let nextTurn = (currentTurnIdx + 1) % players.length;
          let count = 0;
          while (!updated.find((p) => p.id === players[nextTurn].id)?.isAlive && count < players.length) {
            nextTurn = (nextTurn + 1) % players.length;
            count++;
          }
          setCurrentTurnIdx(nextTurn);
        }
      }

      // Draw canvas arena
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Clear
          ctx.clearRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

          // Desk Surface: Ruled paper / wooden border texture
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

          // Outer table border (Fall zone)
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = PADDING * 2;
          ctx.strokeRect(PADDING, PADDING, ARENA_WIDTH - PADDING * 2, ARENA_HEIGHT - PADDING * 2);

          // Desk boundary edge line
          ctx.strokeStyle = '#cbd5e1';
          ctx.lineWidth = 3;
          ctx.strokeRect(PADDING, PADDING, ARENA_WIDTH - PADDING * 2, ARENA_HEIGHT - PADDING * 2);

          // Ruled notebook lines inside the arena
          ctx.strokeStyle = '#e2e8f0';
          ctx.lineWidth = 1;
          for (let y = PADDING + 24; y < ARENA_HEIGHT - PADDING; y += 24) {
            ctx.beginPath();
            ctx.moveTo(PADDING + 4, y);
            ctx.lineTo(ARENA_WIDTH - PADDING - 4, y);
            ctx.stroke();
          }

          // Center margin line (notebook look)
          ctx.strokeStyle = '#fca5a5';
          ctx.lineWidth = 1.5;
          ctx.beginPath();
          ctx.moveTo(PADDING + 60, PADDING);
          ctx.lineTo(PADDING + 60, ARENA_HEIGHT - PADDING);
          ctx.stroke();

          // Draw Pens
          pensRef.current.forEach((pen) => {
            if (!pen.isAlive) return;

            ctx.save();
            ctx.translate(pen.x, pen.y);
            ctx.rotate(pen.angle);

            // Active player glow ring
            if (pen.id === activePlayer.id && !isSimulating && !roundWinner) {
              ctx.beginPath();
              ctx.arc(0, 0, pen.length * 0.7, 0, Math.PI * 2);
              ctx.strokeStyle = '#8b5cf6';
              ctx.lineWidth = 3;
              ctx.setLineDash([4, 4]);
              ctx.stroke();
              ctx.setLineDash([]);
            }

            // Pen shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(-pen.length / 2 + 2, -pen.width / 2 + 3, pen.length, pen.width);

            // Pen Body
            ctx.fillStyle = pen.color;
            ctx.beginPath();
            ctx.roundRect(-pen.length / 2, -pen.width / 2, pen.length - 12, pen.width, 3);
            ctx.fill();

            // Pen Grip
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(-pen.length / 2 + 4, -pen.width / 2, 8, pen.width);

            // Pen Tip / Nib
            ctx.fillStyle = '#475569';
            ctx.beginPath();
            ctx.moveTo(pen.length / 2 - 12, -pen.width / 2);
            ctx.lineTo(pen.length / 2, 0);
            ctx.lineTo(pen.length / 2 - 12, pen.width / 2);
            ctx.closePath();
            ctx.fill();

            // Pen clip
            ctx.fillStyle = '#94a3b8';
            ctx.fillRect(-pen.length / 2 + 16, -pen.width / 2 - 2, 12, 2);

            ctx.restore();
          });

          // Draw Aim Vector
          if (isAiming && activePen && activePen.isAlive && !isSimulating) {
            ctx.save();
            ctx.translate(activePen.x, activePen.y);

            const arrowLength = Math.min(100, aimVector.power * 5);
            const targetX = aimVector.dx * arrowLength;
            const targetY = aimVector.dy * arrowLength;

            // Dotted aim guide
            ctx.beginPath();
            ctx.setLineDash([5, 5]);
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 2.5;
            ctx.moveTo(0, 0);
            ctx.lineTo(targetX, targetY);
            ctx.stroke();
            ctx.setLineDash([]);

            // Aim arrowhead
            ctx.beginPath();
            ctx.arc(targetX, targetY, 6, 0, Math.PI * 2);
            ctx.fillStyle = '#ef4444';
            ctx.fill();

            ctx.restore();
          }
        }
      }

      animId = requestAnimationFrame(updatePhysics);
    };

    animId = requestAnimationFrame(updatePhysics);
    return () => cancelAnimationFrame(animId);
  }, [isSimulating, isPaused, activePlayer.id, isAiming, aimVector, roundWinner, checkRoundStatus, players]);

  // Handle Drag / Aiming Controls
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isSimulating || isPaused || roundWinner || !activePen || !activePen.isAlive) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    // Check if clicked near active pen
    const dist = Math.hypot(clickX - activePen.x, clickY - activePen.y);
    if (dist < 60) {
      setIsAiming(true);
      setAimVector({ dx: 0, dy: 0, power: 0 });
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isAiming || !activePen) return;

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const curX = e.clientX - rect.left;
    const curY = e.clientY - rect.top;

    // Slingshot pull: flick is OPPOSITE to pull direction
    const pullX = activePen.x - curX;
    const pullY = activePen.y - curY;
    const dist = Math.hypot(pullX, pullY);

    if (dist > 5) {
      const power = Math.min(20, dist / 4);
      setAimVector({
        dx: pullX / dist,
        dy: pullY / dist,
        power,
      });
    }
  };

  const handleMouseUp = () => {
    if (!isAiming || !activePen) return;

    if (aimVector.power > 1.5) {
      // Launch pen!
      const updated = pensRef.current.map((p) => {
        if (p.id === activePen.id) {
          return {
            ...p,
            vx: aimVector.dx * aimVector.power * 0.9,
            vy: aimVector.dy * aimVector.power * 0.9,
          };
        }
        return p;
      });
      setPens(updated);
      setIsSimulating(true);
    }
    setIsAiming(false);
  };

  // Keyboard / Quick flick fallback
  const handleQuickFlick = (powerMultiplier = 1) => {
    if (isSimulating || isPaused || roundWinner || !activePen || !activePen.isAlive) return;
    const angle = activePen.angle;
    const power = 12 * powerMultiplier;
    const updated = pensRef.current.map((p) => {
      if (p.id === activePen.id) {
        return {
          ...p,
          vx: Math.cos(angle) * power,
          vy: Math.sin(angle) * power,
        };
      }
      return p;
    });
    setPens(updated);
    setIsSimulating(true);
  };

  const handleRotatePen = () => {
    if (isSimulating || isPaused || roundWinner || !activePen || !activePen.isAlive) return;
    setPens((prev) =>
      prev.map((p) => (p.id === activePen.id ? { ...p, angle: p.angle + Math.PI / 8 } : p))
    );
  };

  const handleNextRound = () => {
    setPens(spawnPens());
    setRoundWinner(null);
    setRound((r) => r + 1);
    setIsSimulating(false);
  };

  return (
    <div className="max-w-4xl mx-auto flex flex-col gap-6">
      {/* Top Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-primary-100 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
            ✏️
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">Classroom Pen Fight</h3>
            <p className="text-xs text-gray-700">
              Round {round} • First to {TARGET_ROUND_WINS} round wins takes the match!
            </p>
          </div>
        </div>

        {/* Round Wins Scoreboard */}
        <div className="flex items-center gap-2">
          {players.map((p, idx) => (
            <div
              key={p.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-semibold ${
                p.id === activePlayer.id
                  ? 'border-primary-500 bg-primary-50 text-primary-900 shadow-sm'
                  : 'border-gray-200 bg-white text-gray-700'
              }`}
            >
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: PEN_COLORS[idx % PEN_COLORS.length] }}
              />
              <span>{p.name}:</span>
              <span className="font-black">{roundWins[p.id] || 0}</span>
            </div>
          ))}
        </div>

        <Button
          variant="ghost"
          size="sm"
          onClick={handleNextRound}
          className="text-xs text-gray-700 flex items-center gap-1.5"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset Arena
        </Button>
      </div>

      {/* Arena Canvas Surface */}
      <div className="relative flex flex-col items-center">
        {/* Canvas container */}
        <div className="relative rounded-3xl overflow-hidden shadow-2xl border-4 border-amber-900/40 bg-amber-50">
          <canvas
            ref={canvasRef}
            width={ARENA_WIDTH}
            height={ARENA_HEIGHT}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="cursor-crosshair block select-none"
          />

          {/* Fall notification toast */}
          {fallMessage && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <ShieldAlert className="w-4 h-4" />
              {fallMessage}
            </div>
          )}

          {/* Round complete overlay */}
          {roundWinner && (
            <div className="absolute inset-x-8 bottom-8 bg-gray-900/95 backdrop-blur-md rounded-2xl p-5 border border-white/20 shadow-2xl flex items-center justify-between animate-in zoom-in-95">
              <div>
                <Badge variant="warning" className="text-xs mb-1">
                  Round {round} Finished
                </Badge>
                <h4 className="text-xl font-black text-white flex items-center gap-2">
                  <Trophy className="w-6 h-6 text-amber-400" />
                  {roundWinner === 'DRAW' ? 'Round Ended in a Draw!' : `${roundWinner} Won This Round!`}
                </h4>
              </div>
              <Button
                size="md"
                onClick={handleNextRound}
                className="bg-amber-500 hover:bg-amber-600 text-gray-950 font-bold flex items-center gap-2"
              >
                Next Round <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}
        </div>

        {/* Turn & Aim Controls Bar */}
        <div className="w-full max-w-2xl mt-4 bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-primary-100 shadow-sm flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl ${activePlayer.avatarColor} text-white font-bold flex items-center justify-center text-sm shadow-sm`}>
              {activePlayer.avatarInitials}
            </div>
            <div>
              <p className="text-xs font-semibold text-primary-600 uppercase tracking-wider">
                Current Flick Turn
              </p>
              <h4 className="font-bold text-gray-900 text-base">{activePlayer.name}</h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRotatePen}
              disabled={isSimulating || Boolean(roundWinner)}
              className="text-xs text-gray-700 flex items-center gap-1.5"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Aim Rotate (22°)
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleQuickFlick(0.8)}
              disabled={isSimulating || Boolean(roundWinner)}
              className="text-xs flex items-center gap-1.5"
            >
              <Target className="w-3.5 h-3.5" />
              Light Flick
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleQuickFlick(1.4)}
              disabled={isSimulating || Boolean(roundWinner)}
              className="text-xs flex items-center gap-1.5 bg-gradient-to-r from-violet-600 to-indigo-600"
            >
              <Zap className="w-3.5 h-3.5" />
              Power Flick!
            </Button>
          </div>
        </div>

        {/* Instructions Hint */}
        <div className="flex items-center gap-2 mt-3 text-xs text-gray-600">
          <Info className="w-4 h-4 text-primary-500" />
          <span>
            Click and drag your glowing pen backwards like a slingshot to aim & flick, or use the quick buttons!
          </span>
        </div>
      </div>
    </div>
  );
};
