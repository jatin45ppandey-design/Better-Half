import React, { useEffect, useRef } from 'react';
import { Trophy, RotateCcw, ArrowRight, Award } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { soundService } from '../../services/soundService';
import { mockSocialAdapter } from '../../services/mockSocialAdapter';

export interface PlayerScoreSummary {
  id?: string;
  playerId?: string;
  name: string;
  avatarInitials: string;
  avatarColor: string;
  score: number | string;
  isWinner?: boolean;
  subtext?: string;
  stats?: Array<{ label: string; value: string | number }>;
}

interface GameResultsModalProps {
  isOpen: boolean;
  onRematch: () => void;
  onReturnToLobby: () => void;
  gameName: string;
  winnerName?: string;
  isDraw?: boolean;
  playerScores: PlayerScoreSummary[];
  customMessage?: string;
}

export const GameResultsModal: React.FC<GameResultsModalProps> = ({
  isOpen,
  onRematch,
  onReturnToLobby,
  gameName,
  winnerName,
  isDraw = false,
  playerScores,
  customMessage,
}) => {
  const hasRecordedRef = useRef(false);

  useEffect(() => {
    if (isOpen && !hasRecordedRef.current) {
      hasRecordedRef.current = true;
      soundService.playVictory();

      // Automatically record live match into local session history
      try {
        const numericScores = playerScores.map((p) => {
          const num = typeof p.score === 'number' ? p.score : parseInt(String(p.score)) || 0;
          return {
            name: p.name,
            avatarInitials: p.avatarInitials,
            avatarColor: p.avatarColor,
            score: num,
            isWinner: !!p.isWinner,
          };
        });

        mockSocialAdapter.recordMatch({
          gameId: gameName.toLowerCase().replace(/\s+/g, '-'),
          gameName,
          mode: playerScores.length === 2 ? 'couple' : 'friend',
          date: 'Just now',
          duration: '3m 15s',
          roundsPlayed: 1,
          winnerName: isDraw ? 'Draw' : winnerName || 'Match Finished',
          details: customMessage || `Match concluded with ${playerScores.length} players`,
          participants: numericScores,
        });
      } catch {
        // Safe failover for local session
      }
    } else if (!isOpen) {
      hasRecordedRef.current = false;
    }
  }, [isOpen, gameName, winnerName, isDraw, playerScores, customMessage]);

  const handleRematchClick = () => {
    soundService.playClick();
    onRematch();
  };

  const handleReturnClick = () => {
    soundService.playClick();
    onReturnToLobby();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleReturnClick}
      title={isDraw ? 'Match Draw!' : `${winnerName || 'Player'} Wins!`}
      description={`Final Match Results • ${gameName}`}
      maxWidth="md"
      showCloseButton={false}
    >
      <div className="flex flex-col gap-5 pt-1 text-center">
        {/* Podium Icon */}
        <div className="mx-auto w-16 h-16 rounded-3xl bg-gradient-to-br from-[#FEF3C7] to-[#FDE68A] text-[#92400E] flex items-center justify-center shadow-md shadow-[#92400E]/15 border border-[#FDE68A]">
          <Trophy className="w-8 h-8 text-[#92400E]" />
        </div>

        {customMessage && (
          <p className="text-xs sm:text-sm text-[#756D82] max-w-sm mx-auto leading-relaxed">
            {customMessage}
          </p>
        )}

        {/* Player Roster Scorecard */}
        <div className="flex flex-col gap-2 p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82] text-left block">
            Final Standings
          </span>
          {playerScores.map((player, idx) => (
            <div
              key={player.id || player.playerId || idx}
              className={`p-3 rounded-xl border flex items-center justify-between transition-all ${
                player.isWinner
                  ? 'border-[#9670E8] bg-white shadow-xs'
                  : 'border-[#EAE3F3] bg-white/70'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-bold text-[#756D82] w-4">
                  #{idx + 1}
                </span>
                <Avatar
                  name={player.name}
                  initials={player.avatarInitials}
                  size="sm"
                  bgColor={player.avatarColor}
                />
                <div className="flex flex-col text-left">
                  <span className="text-xs font-bold text-[#211A2D] flex items-center gap-1">
                    {player.name}
                    {player.isWinner && (
                      <Badge variant="purple" size="sm" className="text-[9px] px-1.5 py-0">
                        Winner
                      </Badge>
                    )}
                  </span>
                  {player.subtext && (
                    <span className="text-[10px] text-[#756D82]">{player.subtext}</span>
                  )}
                </div>
              </div>

              <div className="text-right">
                <span className="text-sm font-extrabold text-[#593B91]">
                  {player.score}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Local Demo Badge */}
        <div className="flex items-center justify-center gap-1.5 text-[11px] text-[#756D82]">
          <Award className="w-3.5 h-3.5 text-[#9670E8]" />
          <span>Local Demo Match Results Recorded to History</span>
        </div>

        {/* Action Buttons */}
        <div className="pt-2 border-t border-[#EAE3F3] flex flex-col sm:flex-row items-center gap-2.5">
          <Button
            variant="secondary"
            size="md"
            onClick={handleRematchClick}
            leftIcon={<RotateCcw className="w-4 h-4" />}
            className="w-full sm:flex-1 justify-center font-bold"
          >
            Play Rematch
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={handleReturnClick}
            rightIcon={<ArrowRight className="w-4 h-4" />}
            className="w-full sm:flex-1 justify-center font-bold"
          >
            Return to Lobby
          </Button>
        </div>
      </div>
    </Modal>
  );
};
