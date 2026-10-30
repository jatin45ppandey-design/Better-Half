import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { api } from '../services/api';
import { soundService } from '../services/soundService';
import {
  History,
  Trophy,
  Filter,
  Clock,
  ChevronRight,
  Calendar,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface MatchItem {
  id: string;
  gameSessionId: string;
  gameId: string;
  mode: string;
  resultType: string;
  winnerUserId: string | null;
  startedAt: string;
  completedAt: string;
  durationSeconds: number;
  roundsPlayed: number;
  userOutcome: string;
  userPlacement: number | null;
  userScore: number | null;
  userScoreLabel: string | null;
  isWinner: boolean;
  participants: Array<{
    id: string;
    userId: string;
    playerNameSnapshot: string;
    usernameSnapshot: string;
    avatarUrlSnapshot: string | null;
    scoreValue: number | null;
    scoreLabel: string | null;
    placement: number | null;
    outcome: string;
    isWinner: boolean;
  }>;
  resultSummary?: any;
}

export const MatchHistoryPage: React.FC = () => {
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');
  const [activeModalMatch, setActiveModalMatch] = useState<MatchItem | null>(null);

  const loadHistory = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.matches.getHistory({
        gameId: selectedGameFilter,
        mode: selectedModeFilter,
        limit: 30,
      });
      setMatches(res.data.matches || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load match history.');
    } finally {
      setIsLoading(false);
    }
  }, [selectedGameFilter, selectedModeFilter]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

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
              <History className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
                Match History
              </h1>
            </div>
            <p className="text-sm text-[#756D82]">
              Verified permanent match records, outcomes, and round breakdowns.
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#756D82]">
            <Trophy className="w-4 h-4 text-[#F2A33A]" />
            <span>Total Logged: <strong>{matches.length} matches</strong></span>
          </div>
        </div>

        {/* Filters Row */}
        <div className="bg-white rounded-2xl border border-[#EAE3F3] p-4 mb-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-[#9670E8]" />
            <span className="text-xs font-bold text-[#211A2D]">Filters:</span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Mode Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#756D82]">Mode:</span>
              <select
                value={selectedModeFilter}
                onChange={(e) => {
                  soundService.playClick();
                  setSelectedModeFilter(e.target.value);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] bg-[#FCFAFF] outline-none focus:border-[#9670E8]"
              >
                <option value="all">All Modes</option>
                <option value="couple">Couple Mode (2P)</option>
                <option value="friend">Friend Mode (4P)</option>
              </select>
            </div>

            {/* Game Filter */}
            <div className="flex items-center gap-1.5 text-xs">
              <span className="text-[#756D82]">Game:</span>
              <select
                value={selectedGameFilter}
                onChange={(e) => {
                  soundService.playClick();
                  setSelectedGameFilter(e.target.value);
                }}
                className="px-2.5 py-1.5 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] bg-[#FCFAFF] outline-none focus:border-[#9670E8]"
              >
                <option value="all">All Games</option>
                <option value="truth-or-dare">Truth or Dare</option>
                <option value="would-you-rather">Would You Rather</option>
                <option value="blind-ranking">Blind Ranking</option>
                <option value="original-card-game">Original Card Game</option>
                <option value="tic-tac-toe">Tic Tac Toe</option>
                <option value="pen-fight">Pen Fight</option>
                <option value="kabza">Kabza</option>
                <option value="basketball-rivalry">Basketball Rivalry</option>
                <option value="snatch-the-fries">Snatch the Fries</option>
                <option value="aloo-golf">Aloo Golf</option>
                <option value="between-us">BETWEEN US</option>
              </select>
            </div>
          </div>
        </div>

        {/* Content Area */}
        {isLoading ? (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-16 text-center shadow-xs flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-[#9670E8] animate-spin" />
            <span className="text-sm font-bold text-[#211A2D]">Loading match records...</span>
          </div>
        ) : error ? (
          <div className="bg-white rounded-3xl border border-[#FAD2DA] p-12 text-center shadow-xs">
            <AlertCircle className="w-10 h-10 text-[#D94C65] mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#211A2D]">Unable to load matches</h3>
            <p className="text-xs text-[#756D82] mt-1">{error}</p>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-16 text-center shadow-xs">
            <History className="w-12 h-12 text-[#D5C7EE] mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#211A2D]">No matches found</h3>
            <p className="text-xs text-[#756D82] mt-1">
              Complete games with friends or in couple mode to log permanent match records.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {matches.map((match) => {
              const isCouple = match.mode.toLowerCase() === 'couple';
              const isWin = match.isWinner;
              const isCoop = match.resultType === 'COOPERATIVE';
              const isDraw = match.resultType === 'DRAW';

              const winner = match.participants.find((p) => p.isWinner);
              const winnerLabel = isCoop
                ? 'Cooperative Completion'
                : isDraw
                ? 'Draw / Tie'
                : winner
                ? winner.playerNameSnapshot
                : 'Completed';

              const dateStr = new Date(match.completedAt).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              });

              const minutes = Math.floor(match.durationSeconds / 60);
              const seconds = match.durationSeconds % 60;
              const durationStr = `${minutes}m ${seconds}s`;

              return (
                <div
                  key={match.id}
                  onClick={() => {
                    soundService.playClick();
                    setActiveModalMatch(match);
                  }}
                  className="bg-white rounded-2xl border border-[#EAE3F3] p-4 sm:p-5 shadow-xs hover:border-[#D5C7EE] transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-4 group"
                >
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-lg shrink-0 ${
                        isWin
                          ? 'bg-[#EBF7F2] text-[#248A62] border border-[#C6ECD9]'
                          : isCoop
                          ? 'bg-[#F1EAFF] text-[#593B91] border border-[#E3D6FA]'
                          : 'bg-[#F8F4FF] text-[#593B91] border border-[#EAE3F3]'
                      }`}
                    >
                      {isWin ? '🏆' : isCoop ? '🤝' : '🎮'}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-base text-[#211A2D] group-hover:text-[#9670E8] transition-colors">
                          {getGameDisplayName(match.gameId)}
                        </h3>
                        <Badge
                          variant={isCouple ? 'pink' : 'purple'}
                          size="sm"
                        >
                          {isCouple ? 'Couple' : 'Friend'}
                        </Badge>
                        <Badge
                          variant={isWin ? 'success' : isCoop ? 'purple' : isDraw ? 'subtle' : 'subtle'}
                          size="sm"
                        >
                          {match.userOutcome}
                        </Badge>
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#756D82]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {dateStr}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {durationStr}
                        </span>
                        <span>
                          Result: <strong className="text-[#211A2D]">{winnerLabel}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Participants Avatars & Action */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F8F4FF]">
                    <div className="flex items-center -space-x-2">
                      {match.participants.map((p, idx) => (
                        <div key={idx} title={`${p.playerNameSnapshot}: ${p.scoreLabel || '0 pts'}`}>
                          <Avatar
                            name={p.playerNameSnapshot}
                            size="sm"
                            src={p.avatarUrlSnapshot || undefined}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-bold text-[#593B91] flex items-center gap-1 group-hover:translate-x-0.5 transition-transform">
                        Details <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Match Details Modal */}
      {activeModalMatch && (
        <Modal
          isOpen={!!activeModalMatch}
          onClose={() => setActiveModalMatch(null)}
          title={`Match Breakdown: ${getGameDisplayName(activeModalMatch.gameId)}`}
          description={`${activeModalMatch.mode === 'COUPLE' ? 'Couple Mode' : 'Friend Mode'} • Played ${new Date(activeModalMatch.completedAt).toLocaleDateString()}`}
        >
          <div className="space-y-4 pt-2">
            {/* Winner Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F1EAFF] to-[#FCFAFF] border border-[#E3D6FA] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-[#F2A33A]" />
                <div>
                  <span className="text-[11px] font-bold text-[#756D82] uppercase tracking-wider block">
                    {activeModalMatch.resultType === 'COOPERATIVE' ? 'Match Type' : 'Outcome'}
                  </span>
                  <span className="text-base font-black text-[#593B91]">
                    {activeModalMatch.resultType === 'COOPERATIVE'
                      ? 'Cooperative Completion'
                      : activeModalMatch.resultType === 'DRAW'
                      ? 'Draw / Tie'
                      : activeModalMatch.participants.find((p) => p.isWinner)?.playerNameSnapshot || 'Concluded'}
                  </span>
                </div>
              </div>
              <Badge variant="purple" size="sm">
                {activeModalMatch.roundsPlayed} Round{activeModalMatch.roundsPlayed > 1 ? 's' : ''}
              </Badge>
            </div>

            {/* Standings Table */}
            <div>
              <h4 className="text-xs font-black text-[#211A2D] uppercase tracking-wider mb-2">Participant Standings</h4>
              <div className="space-y-2">
                {activeModalMatch.participants.map((p, i) => (
                  <div
                    key={i}
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                      p.isWinner
                        ? 'bg-[#EBF7F2] border-[#C6ECD9]'
                        : 'bg-white border-[#EAE3F3]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 font-bold text-[#756D82]">#{p.placement || i + 1}</span>
                      <Avatar
                        name={p.playerNameSnapshot}
                        size="sm"
                        src={p.avatarUrlSnapshot || undefined}
                      />
                      <div>
                        <span className="font-extrabold text-[#211A2D] block">{p.playerNameSnapshot}</span>
                        <span className="text-[10px] text-[#756D82]">@{p.usernameSnapshot}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-black text-sm text-[#211A2D]">
                        {p.scoreLabel || `${p.scoreValue ?? 0} pts`}
                      </span>
                      {p.isWinner && (
                        <Badge variant="success" size="sm">Winner</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
};
