import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { mockSocialAdapter } from '../services/mockSocialAdapter';
import type { RivalrySummary } from '../services/mockSocialAdapter';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import {
  Swords,
  Flame,
  Gamepad2,
  Info,
  TrendingUp,
} from 'lucide-react';

export const RivalryPage: React.FC = () => {
  const [rivalry] = useState<RivalrySummary>(mockSocialAdapter.getRivalry());
  const { user } = useAuth();
  const { createRoom } = useRoom();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const userWinPct = Math.round((rivalry.userWins / (rivalry.totalMatches || 1)) * 100);
  const rivalWinPct = Math.round((rivalry.rivalWins / (rivalry.totalMatches || 1)) * 100);

  const handleStartRematch = async () => {
    soundService.playSuccess();
    try {
      const room = await createRoom({
        name: `${rivalry.rivalName} vs ${user?.name || 'You'} Showdown`,
        mode: 'couple',
        selectedGameId: 'aloo-golf',
      });
      addToast(`Couple showdown room #${room.code} created for you and ${rivalry.rivalName}!`, {
        type: 'success',
      });
      navigate(`/room/${room.code}`);
    } catch (err: any) {
      addToast(err?.message || 'Failed to create room. Please check backend connection.', {
        type: 'error',
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Sample Disclaimer Banner */}
        <div className="mb-6 p-3.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-center justify-between gap-3 text-xs text-[#756D82]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Sample Head-to-Head Statistics:</strong> This screen previews the rivalry metrics engine using local sample data.
            </span>
          </div>
          <Badge variant="subtle" size="sm">Local Demo</Badge>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Swords className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
                Rivalry Arena
              </h1>
            </div>
            <p className="text-sm text-[#756D82]">
              Track your intense head-to-head record, streaks, and match history with your top rival.
            </p>
          </div>

          <Button
            variant="primary"
            size="sm"
            leftIcon={<Gamepad2 className="w-4 h-4" />}
            onClick={handleStartRematch}
          >
            Challenge to Rematch
          </Button>
        </div>

        {/* Versus Matchup Card */}
        <div className="relative bg-white rounded-3xl border border-[#EAE3F3] p-6 sm:p-8 shadow-sm mb-8 overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-48 bg-gradient-to-bl from-[#F1EAFF]/60 to-transparent pointer-events-none rounded-bl-full" />

          <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
            {/* Player 1 (You) */}
            <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left flex-1">
              <Avatar
                name={user?.name || 'Alex Rivera'}
                initials={user?.avatarInitials || 'AR'}
                size="lg"
                bgColor="#9670E8"
                isOnline
              />
              <div>
                <span className="text-xs font-bold text-[#9670E8] block uppercase tracking-wider">You</span>
                <h2 className="text-xl sm:text-2xl font-black text-[#211A2D]">
                  {user?.name || 'Alex Rivera'}
                </h2>
                <span className="text-2xl font-black text-[#248A62] block mt-1">
                  {rivalry.userWins} Wins
                </span>
                <span className="text-xs text-[#756D82]">{userWinPct}% Win Rate</span>
              </div>
            </div>

            {/* VS Badge & Center Stats */}
            <div className="flex flex-col items-center justify-center shrink-0 px-6 py-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
              <span className="text-xs font-black text-[#756D82] uppercase tracking-widest mb-1">Total Duels</span>
              <span className="text-3xl font-black text-[#593B91]">{rivalry.totalMatches}</span>
              <div className="flex items-center gap-1.5 mt-2">
                <Flame className="w-4 h-4 text-[#F2A33A]" />
                <span className="text-xs font-extrabold text-[#211A2D]">
                  Streak: {rivalry.currentStreak.holder === 'user' ? 'You' : rivalry.rivalName} (+{rivalry.currentStreak.count})
                </span>
              </div>
            </div>

            {/* Player 2 (Rival) */}
            <div className="flex flex-col sm:flex-row-reverse items-center gap-4 text-center sm:text-right flex-1">
              <Avatar
                name={rivalry.rivalName}
                initials={rivalry.rivalAvatarInitials}
                size="lg"
                bgColor={rivalry.rivalAvatarColor}
                isOnline
              />
              <div>
                <span className="text-xs font-bold text-[#EC4899] block uppercase tracking-wider">Top Rival</span>
                <h2 className="text-xl sm:text-2xl font-black text-[#211A2D]">
                  {rivalry.rivalName}
                </h2>
                <span className="text-2xl font-black text-[#593B91] block mt-1">
                  {rivalry.rivalWins} Wins
                </span>
                <span className="text-xs text-[#756D82]">{rivalWinPct}% Win Rate</span>
              </div>
            </div>
          </div>

          {/* Visual Win Share Bar */}
          <div className="mt-8 pt-6 border-t border-[#EAE3F3]">
            <div className="flex items-center justify-between text-xs font-bold text-[#756D82] mb-2">
              <span className="text-[#248A62]">Alex: {rivalry.userWins}W</span>
              <span>{rivalry.draws} Draw{rivalry.draws > 1 ? 's' : ''}</span>
              <span className="text-[#593B91]">{rivalry.rivalName}: {rivalry.rivalWins}W</span>
            </div>

            <div className="w-full h-4 rounded-full bg-[#EAE3F3] overflow-hidden flex">
              <div
                style={{ width: `${userWinPct}%` }}
                className="bg-[#248A62] h-full transition-all"
                title={`Your Wins: ${userWinPct}%`}
              />
              <div
                style={{ width: `${Math.max(4, 100 - userWinPct - rivalWinPct)}%` }}
                className="bg-[#D5C7EE] h-full transition-all"
                title="Draws"
              />
              <div
                style={{ width: `${rivalWinPct}%` }}
                className="bg-[#593B91] h-full transition-all"
                title={`Rival Wins: ${rivalWinPct}%`}
              />
            </div>
          </div>
        </div>

        {/* Breakdown Split: Favorite Duels & Recent H2H */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Favorite Games Together */}
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-[#211A2D]">Most Played Together</h3>
                <p className="text-xs text-[#756D82]">Duels by game category</p>
              </div>
              <Gamepad2 className="w-5 h-5 text-[#9670E8]" />
            </div>

            <div className="space-y-3">
              {rivalry.favouriteGamesTogether.map((item, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-[#756D82]">#{idx + 1}</span>
                    <span className="font-extrabold text-sm text-[#211A2D]">{item.name}</span>
                  </div>
                  <Badge variant="purple" size="sm">
                    {item.count} Matches
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Recent H2H Matches */}
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-black text-[#211A2D]">Recent Encounters</h3>
                <p className="text-xs text-[#756D82]">Last 5 head-to-head outcomes</p>
              </div>
              <TrendingUp className="w-5 h-5 text-[#248A62]" />
            </div>

            <div className="space-y-2.5">
              {rivalry.recentH2H.map((match) => {
                const userWon = match.winner === 'user';
                const isDraw = match.winner === 'draw';

                return (
                  <div
                    key={match.id}
                    className="p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between text-xs"
                  >
                    <div>
                      <span className="font-bold text-[#211A2D] block">{match.gameName}</span>
                      <span className="text-[11px] text-[#756D82]">{match.date}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="font-mono font-bold text-[#211A2D]">
                        {match.userScore} - {match.rivalScore}
                      </span>
                      <Badge
                        variant={userWon ? 'success' : isDraw ? 'subtle' : 'pink'}
                        size="sm"
                      >
                        {userWon ? 'Victory' : isDraw ? 'Draw' : 'Defeat'}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
