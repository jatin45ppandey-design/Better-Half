import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { api } from '../services/api';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import {
  Swords,
  Flame,
  Gamepad2,
  TrendingUp,
  Loader2,
  AlertCircle,
  Users,
} from 'lucide-react';

interface RivalItem {
  id: string;
  rival: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarColor: string | null;
    avatarInitials: string | null;
  };
  matchesPlayed: number;
  competitiveMatches: number;
  userWins: number;
  rivalWins: number;
  draws: number;
  cooperativeCompletions: number;
  currentStreakHolder: string | null;
  currentStreakCount: number;
  lastMatchAt: string | null;
}

interface RivalryDetail {
  rival: {
    id: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    avatarColor: string | null;
    avatarInitials: string | null;
  };
  matchesPlayed: number;
  competitiveMatches: number;
  userWins: number;
  rivalWins: number;
  draws: number;
  cooperativeCompletions: number;
  userWinPct: number;
  rivalWinPct: number;
  drawPct: number;
  currentStreakHolder: string | null;
  currentStreakCount: number;
  lastMatchAt: string | null;
  favoriteGames: Array<{ gameId: string; count: number }>;
}

export const RivalryPage: React.FC = () => {
  const [rivalsList, setRivalsList] = useState<RivalItem[]>([]);
  const [selectedRivalId, setSelectedRivalId] = useState<string | null>(null);
  const [rivalryDetail, setRivalryDetail] = useState<RivalryDetail | null>(null);
  const [recentH2H, setRecentH2H] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { user } = useAuth();
  const { createRoom } = useRoom();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const loadRivalries = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.rivalry.getRivalries();
      const list = res.data || [];
      setRivalsList(list);

      if (list.length > 0) {
        const topRivalId = list[0].rival.id;
        setSelectedRivalId(topRivalId);
        const [detailRes, histRes] = await Promise.all([
          api.rivalry.getRivalryWithUser(topRivalId),
          api.rivalry.getRivalryHistory(topRivalId, 5),
        ]);
        setRivalryDetail(detailRes.data);
        setRecentH2H(histRes.data || []);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load rivalry data.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRivalries();
  }, [loadRivalries]);

  const handleSelectRival = async (rivalId: string) => {
    soundService.playClick();
    setSelectedRivalId(rivalId);
    try {
      const [detailRes, histRes] = await Promise.all([
        api.rivalry.getRivalryWithUser(rivalId),
        api.rivalry.getRivalryHistory(rivalId, 5),
      ]);
      setRivalryDetail(detailRes.data);
      setRecentH2H(histRes.data || []);
    } catch (err: any) {
      addToast(err?.message || 'Failed to load rival data', { type: 'error' });
    }
  };

  const handleStartRematch = async () => {
    if (!rivalryDetail) return;
    soundService.playSuccess();
    try {
      const room = await createRoom({
        name: `${user?.name || 'Player'} vs ${rivalryDetail.rival.displayName}`,
        mode: 'couple',
        selectedGameId: 'tic-tac-toe',
      });
      addToast(`Showdown room #${room.code} created!`, { type: 'success' });
      navigate(`/room/${room.code}`);
    } catch (err: any) {
      addToast(err?.message || 'Failed to create room. Please check backend connection.', {
        type: 'error',
      });
    }
  };

  const getGameDisplayName = (gameId: string) => {
    const map: Record<string, string> = {
      'truth-or-dare': 'Truth or Dare',
      'would-you-rather': 'Would You Rather',
      'blind-ranking': 'Blind Ranking',
      'uno-style': 'Original UNO-style Card Game',
      'original-card-game': 'Original Card Game',
      'tic-tac-toe': 'Tic Tac Toe',
      'pen-fight': 'Pen Fight',
      'kabza': 'Kabza',
      'basketball-rivalry': 'Basketball Rivalry',
      'snatch-the-fries': 'Snatch the Fries',
      'aloo-golf': 'Aloo Golf',
      'between-us': 'BETWEEN US',
    };
    return map[gameId] || gameId;
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
              Track your intense head-to-head records, win streaks, and match history with opponents.
            </p>
          </div>

          {rivalryDetail && (
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Gamepad2 className="w-4 h-4" />}
              onClick={handleStartRematch}
            >
              Challenge to Rematch
            </Button>
          )}
        </div>

        {/* Loading / Error States */}
        {isLoading ? (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-16 text-center shadow-xs flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#9670E8] animate-spin" />
            <span className="text-sm font-bold text-[#211A2D]">Analyzing rivalry records...</span>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl border border-[#FAD2DA] p-12 text-center shadow-xs">
            <AlertCircle className="w-10 h-10 text-[#D94C65] mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#211A2D]">Unable to load rivalry</h3>
            <p className="text-xs text-[#756D82] mt-1">{error}</p>
          </div>
        ) : rivalsList.length === 0 || !rivalryDetail ? (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-16 text-center shadow-xs">
            <Swords className="w-12 h-12 text-[#D5C7EE] mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#211A2D]">No rivalries recorded yet</h3>
            <p className="text-xs text-[#756D82] mt-1 max-w-sm mx-auto">
              Play multiplayer games with friends or your partner to unlock head-to-head records and rivalry streaks!
            </p>
            <div className="mt-5">
              <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
                Explore Games
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Rival Selector Pills (if multiple rivals) */}
            {rivalsList.length > 1 && (
              <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2">
                <span className="text-xs font-bold text-[#756D82] mr-1 flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Rivals:
                </span>
                {rivalsList.map((item) => (
                  <button
                    key={item.rival.id}
                    onClick={() => handleSelectRival(item.rival.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all shrink-0 flex items-center gap-1.5 border ${
                      selectedRivalId === item.rival.id
                        ? 'bg-[#9670E8] text-white border-[#9670E8] shadow-xs'
                        : 'bg-white text-[#211A2D] border-[#EAE3F3] hover:border-[#D5C7EE]'
                    }`}
                  >
                    <span>{item.rival.displayName}</span>
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                      selectedRivalId === item.rival.id ? 'bg-white/20 text-white' : 'bg-[#F8F4FF] text-[#593B91]'
                    }`}>
                      {item.matchesPlayed}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Versus Matchup Card */}
            <div className="relative bg-white rounded-3xl border border-[#EAE3F3] p-6 sm:p-8 shadow-sm mb-8 overflow-hidden">
              <div className="absolute top-0 right-0 w-80 h-48 bg-gradient-to-bl from-[#F1EAFF]/60 to-transparent pointer-events-none rounded-bl-full" />

              <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
                {/* Player 1 (You) */}
                <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left flex-1">
                  <Avatar
                    name={user?.name || 'You'}
                    initials={user?.avatarInitials || 'ME'}
                    size="lg"
                    bgColor="#9670E8"
                    isOnline
                  />
                  <div>
                    <span className="text-xs font-bold text-[#9670E8] block uppercase tracking-wider">You</span>
                    <h2 className="text-xl sm:text-2xl font-black text-[#211A2D]">
                      {user?.name || 'You'}
                    </h2>
                    <span className="text-2xl font-black text-[#248A62] block mt-1">
                      {rivalryDetail.userWins} Wins
                    </span>
                    <span className="text-xs text-[#756D82]">{rivalryDetail.userWinPct}% Win Rate</span>
                  </div>
                </div>

                {/* VS Badge & Center Stats */}
                <div className="flex flex-col items-center justify-center shrink-0 px-6 py-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
                  <span className="text-xs font-black text-[#756D82] uppercase tracking-widest mb-1">Total Duels</span>
                  <span className="text-3xl font-black text-[#593B91]">{rivalryDetail.matchesPlayed}</span>

                  <div className="flex items-center gap-1.5 mt-2">
                    <Flame className="w-4 h-4 text-[#F2A33A]" />
                    <span className="text-xs font-extrabold text-[#211A2D]">
                      Streak: {rivalryDetail.currentStreakHolder === user?.id ? 'You' : rivalryDetail.rival.displayName} (+{rivalryDetail.currentStreakCount})
                    </span>
                  </div>
                </div>

                {/* Player 2 (Rival) */}
                <div className="flex flex-col sm:flex-row-reverse items-center gap-4 text-center sm:text-right flex-1">
                  <Avatar
                    name={rivalryDetail.rival.displayName}
                    initials={rivalryDetail.rival.avatarInitials || undefined}
                    src={rivalryDetail.rival.avatarUrl || undefined}
                    size="lg"
                    bgColor={rivalryDetail.rival.avatarColor || '#EC4899'}
                    isOnline
                  />
                  <div>
                    <span className="text-xs font-bold text-[#EC4899] block uppercase tracking-wider">Opponent</span>
                    <h2 className="text-xl sm:text-2xl font-black text-[#211A2D]">
                      {rivalryDetail.rival.displayName}
                    </h2>
                    <span className="text-2xl font-black text-[#593B91] block mt-1">
                      {rivalryDetail.rivalWins} Wins
                    </span>
                    <span className="text-xs text-[#756D82]">{rivalryDetail.rivalWinPct}% Win Rate</span>
                  </div>
                </div>
              </div>

              {/* Visual Win Share Bar */}
              <div className="mt-8 pt-6 border-t border-[#EAE3F3]">
                <div className="flex items-center justify-between text-xs font-bold text-[#756D82] mb-2">
                  <span className="text-[#248A62]">You: {rivalryDetail.userWins}W</span>
                  <span>{rivalryDetail.draws} Draw{rivalryDetail.draws !== 1 ? 's' : ''}</span>
                  <span className="text-[#593B91]">{rivalryDetail.rival.displayName}: {rivalryDetail.rivalWins}W</span>
                </div>

                <div className="w-full h-4 rounded-full bg-[#EAE3F3] overflow-hidden flex">
                  <div
                    style={{ width: `${rivalryDetail.userWinPct}%` }}
                    className="bg-[#248A62] h-full transition-all"
                    title={`Your Wins: ${rivalryDetail.userWinPct}%`}
                  />
                  <div
                    style={{ width: `${Math.max(2, rivalryDetail.drawPct)}%` }}
                    className="bg-[#D5C7EE] h-full transition-all"
                    title="Draws"
                  />
                  <div
                    style={{ width: `${rivalryDetail.rivalWinPct}%` }}
                    className="bg-[#593B91] h-full transition-all"
                    title={`Rival Wins: ${rivalryDetail.rivalWinPct}%`}
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

                {rivalryDetail.favoriteGames.length === 0 ? (
                  <p className="text-xs text-[#756D82] py-4 text-center">No game breakdown recorded yet.</p>
                ) : (
                  <div className="space-y-3">
                    {rivalryDetail.favoriteGames.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-xs font-black text-[#756D82]">#{idx + 1}</span>
                          <span className="font-extrabold text-sm text-[#211A2D]">{getGameDisplayName(item.gameId)}</span>
                        </div>
                        <Badge variant="purple" size="sm">
                          {item.count} Match{item.count > 1 ? 'es' : ''}
                        </Badge>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent H2H Matches */}
              <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-black text-[#211A2D]">Recent Encounters</h3>
                    <p className="text-xs text-[#756D82]">Recent head-to-head outcomes</p>
                  </div>
                  <TrendingUp className="w-5 h-5 text-[#248A62]" />
                </div>

                {recentH2H.length === 0 ? (
                  <p className="text-xs text-[#756D82] py-4 text-center">No recent encounters found.</p>
                ) : (
                  <div className="space-y-2.5">
                    {recentH2H.map((match) => {
                      const userWon = match.userResult?.isWinner;
                      const isDraw = match.resultType === 'DRAW';

                      return (
                        <div
                          key={match.matchId}
                          className="p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between text-xs"
                        >
                          <div>
                            <span className="font-bold text-[#211A2D] block">{getGameDisplayName(match.gameId)}</span>
                            <span className="text-[11px] text-[#756D82]">
                              {new Date(match.completedAt).toLocaleDateString()}
                            </span>
                          </div>

                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-[#211A2D]">
                              {match.userResult?.scoreLabel || '0'} - {match.rivalResult?.scoreLabel || '0'}
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
                )}
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};
