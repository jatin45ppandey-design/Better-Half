import React, { useState, useEffect } from 'react';
import { Pause, HelpCircle, Sparkles, Clock, Volume2, VolumeX } from 'lucide-react';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { GameIcon } from '../ui/GameIcon';
import { soundService } from '../../services/soundService';
import type { GameItem } from '../../types/game';

interface GameHeaderProps {
  game: GameItem;
  roomCode?: string;
  mode?: 'couple' | 'friend';
  roundInfo?: string;
  activePlayerName?: string;
  timerSeconds?: number | null;
  onPause: () => void;
  onOpenRules: () => void;
}

export const GameHeader: React.FC<GameHeaderProps> = ({
  game,
  roomCode,
  mode = 'couple',
  roundInfo,
  activePlayerName,
  timerSeconds,
  onPause,
  onOpenRules,
}) => {
  const [muted, setMuted] = useState(soundService.isMuted());

  // Subtle audio tick when timer is critically low
  useEffect(() => {
    if (typeof timerSeconds === 'number' && timerSeconds > 0 && timerSeconds <= 5) {
      soundService.playTimerTick();
    }
  }, [timerSeconds]);

  const handleToggleSound = () => {
    const next = !muted;
    soundService.setMuted(next);
    setMuted(next);
  };

  return (
    <div className="w-full bg-white/95 backdrop-blur-md border-b border-[#EAE3F3] py-2.5 px-4 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
        {/* Left: Game Identity & Room Code */}
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center border ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
          >
            <GameIcon name={game.iconName} className="w-4 h-4" />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <h1 className="text-base font-extrabold text-[#211A2D] leading-tight">
                {game.name}
              </h1>
              <Badge variant={mode === 'couple' ? 'pink' : 'lavender'} size="sm">
                {mode === 'couple' ? 'Couple 2P' : 'Friend 4P'}
              </Badge>
            </div>
            {roomCode && (
              <span className="text-[11px] font-mono font-bold text-[#756D82]">
                ROOM: {roomCode}
              </span>
            )}
          </div>
        </div>

        {/* Center: Turn & Round Status */}
        <div className="flex items-center gap-3">
          {roundInfo && (
            <span className="px-2.5 py-1 rounded-lg bg-[#F8F4FF] border border-[#EAE3F3] text-xs font-semibold text-[#593B91]">
              {roundInfo}
            </span>
          )}

          {activePlayerName && (
            <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCFAFF] border border-[#D5C7EE] shadow-xs">
              <span className="w-2 h-2 rounded-full bg-[#248A62] animate-pulse" />
              <span className="text-xs font-bold text-[#211A2D]">
                Turn: {activePlayerName}
              </span>
            </div>
          )}

          {typeof timerSeconds === 'number' && (
            <div
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-mono font-bold ${
                timerSeconds <= 5
                  ? 'bg-[#FDF0F2] border-[#F8D2D9] text-[#D94C65] animate-pulse'
                  : 'bg-[#FCFAFF] border-[#EAE3F3] text-[#593B91]'
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{timerSeconds}s</span>
            </div>
          )}
        </div>

        {/* Right: Controls, Sound Toggle & Demo Badge */}
        <div className="flex items-center gap-2">
          <Badge variant="subtle" size="sm" className="hidden sm:inline-flex">
            <Sparkles className="w-3 h-3 text-[#9670E8]" />
            Local Match
          </Badge>

          {/* Quick Sound Toggle Button */}
          <button
            type="button"
            onClick={handleToggleSound}
            aria-label={muted ? 'Enable sound effects' : 'Mute sound effects'}
            className="p-2 rounded-xl text-[#756D82] hover:text-[#593B91] hover:bg-[#F8F4FF] border border-[#EAE3F3] transition-colors cursor-pointer"
            title={muted ? 'Sound Muted (Click to Unmute)' : 'Sound Enabled (Click to Mute)'}
          >
            {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4 text-[#9670E8]" />}
          </button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              soundService.playClick();
              onOpenRules();
            }}
            leftIcon={<HelpCircle className="w-4 h-4 text-[#756D82]" />}
            className="text-xs font-bold"
          >
            Rules
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              soundService.playClick();
              onPause();
            }}
            leftIcon={<Pause className="w-4 h-4 text-[#593B91]" />}
            className="text-xs font-bold"
          >
            Pause
          </Button>
        </div>
      </div>
    </div>
  );
};
