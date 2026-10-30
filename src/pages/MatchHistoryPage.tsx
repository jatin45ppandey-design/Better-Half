import React, { useState } from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { mockSocialAdapter } from '../services/mockSocialAdapter';
import type { MatchHistoryItem } from '../services/mockSocialAdapter';
import { soundService } from '../services/soundService';
import {
  History,
  Trophy,
  Filter,
  Info,
  Clock,
  ChevronRight,
  Calendar,
} from 'lucide-react';

export const MatchHistoryPage: React.FC = () => {
  const [matches] = useState<MatchHistoryItem[]>(
    mockSocialAdapter.getMatchHistory()
  );
  const [selectedGameFilter, setSelectedGameFilter] = useState<string>('all');
  const [selectedModeFilter, setSelectedModeFilter] = useState<string>('all');
  const [activeModalMatch, setActiveModalMatch] = useState<MatchHistoryItem | null>(null);

  const filteredMatches = matches.filter((m) => {
    const matchesGame = selectedGameFilter === 'all' || m.gameId === selectedGameFilter;
    const matchesMode = selectedModeFilter === 'all' || m.mode === selectedModeFilter;
    return matchesGame && matchesMode;
  });

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Sample Data Disclaimer */}
        <div className="mb-6 p-3.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-center justify-between gap-3 text-xs text-[#756D82]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Match History Log:</strong> Past matches display local demo telemetry and your recent in-browser gameplay results.
            </span>
          </div>
          <Badge variant="subtle" size="sm">Local Data</Badge>
        </div>

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
              Review past game outcomes, scores, and round details.
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
                <option value="aloo-golf">Aloo Golf</option>
                <option value="original-card-game">Original Card Game</option>
                <option value="tic-tac-toe">Tic Tac Toe</option>
                <option value="basketball-rivalry">Basketball Rivalry</option>
                <option value="blind-ranking">Blind Ranking</option>
                <option value="pen-fight">Pen Fight</option>
                <option value="kabza">Kabza</option>
                <option value="snatch-the-fries">Snatch the Fries</option>
                <option value="truth-or-dare">Truth or Dare</option>
                <option value="would-you-rather">Would You Rather</option>
                <option value="between-us">BETWEEN US</option>
              </select>
            </div>
          </div>
        </div>

        {/* Matches Feed */}
        {filteredMatches.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-12 text-center shadow-xs">
            <History className="w-12 h-12 text-[#D5C7EE] mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#211A2D]">No matches found</h3>
            <p className="text-xs text-[#756D82] mt-1">
              Try changing the game or mode filters to view your other match logs.
            </p>
          </div>
        ) : (
          <div className="space-y-3.5">
            {filteredMatches.map((match) => {
              const isCouple = match.mode === 'couple';
              const currentUserWon = match.participants.some(
                (p) => p.isCurrentUser && p.isWinner
              );

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
                        currentUserWon
                          ? 'bg-[#EBF7F2] text-[#248A62] border border-[#C6ECD9]'
                          : 'bg-[#F8F4FF] text-[#593B91] border border-[#EAE3F3]'
                      }`}
                    >
                      {currentUserWon ? '🏆' : '🎮'}
                    </div>

                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-extrabold text-base text-[#211A2D] group-hover:text-[#9670E8] transition-colors">
                          {match.gameName}
                        </h3>
                        <Badge
                          variant={isCouple ? 'pink' : 'purple'}
                          size="sm"
                        >
                          {isCouple ? 'Couple' : 'Friend'}
                        </Badge>
                        {match.isDemoRecord ? (
                          <span className="text-[10px] text-[#756D82] bg-[#F8F4FF] px-1.5 py-0.5 rounded border border-[#EAE3F3]">
                            Sample
                          </span>
                        ) : (
                          <Badge variant="success" size="sm">Live Session</Badge>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-3 text-xs text-[#756D82]">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {match.date}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {match.duration}
                        </span>
                        <span>Winner: <strong className="text-[#211A2D]">{match.winnerName}</strong></span>
                      </div>
                    </div>
                  </div>

                  {/* Participants Avatars & Scores */}
                  <div className="flex items-center justify-between sm:justify-end gap-3 self-stretch sm:self-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-[#F8F4FF]">
                    <div className="flex items-center -space-x-2">
                      {match.participants.map((p, idx) => (
                        <div key={idx} title={`${p.name}: ${p.score} pts`}>
                          <Avatar
                            name={p.name}
                            initials={p.avatarInitials}
                            size="sm"
                            bgColor={p.avatarColor}
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
          title={`Match Breakdown: ${activeModalMatch.gameName}`}
          description={`${activeModalMatch.mode === 'couple' ? 'Couple Mode' : 'Friend Mode'} • Played ${activeModalMatch.date}`}
        >
          <div className="space-y-4 pt-2">
            {/* Winner Banner */}
            <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F1EAFF] to-[#FCFAFF] border border-[#E3D6FA] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-[#F2A33A]" />
                <div>
                  <span className="text-[11px] font-bold text-[#756D82] uppercase tracking-wider block">Winner</span>
                  <span className="text-base font-black text-[#593B91]">{activeModalMatch.winnerName}</span>
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
                    className={`p-3 rounded-xl border flex items-center justify-between ${
                      p.isWinner
                        ? 'bg-[#EBF7F2] border-[#C6ECD9]'
                        : 'bg-[#FCFAFF] border-[#EAE3F3]'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="text-xs font-black text-[#756D82]">#{i + 1}</span>
                      <Avatar
                        name={p.name}
                        initials={p.avatarInitials}
                        size="sm"
                        bgColor={p.avatarColor}
                      />
                      <span className="text-xs font-bold text-[#211A2D]">
                        {p.name} {p.isCurrentUser && '(You)'}
                      </span>
                    </div>

                    <div className="text-right">
                      <span className="text-xs font-black text-[#211A2D]">{p.score} pts</span>
                      {p.isWinner && (
                        <span className="block text-[10px] text-[#248A62] font-semibold">Victory</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Match Notes */}
            {activeModalMatch.details && (
              <div className="p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] text-xs text-[#756D82]">
                <strong className="text-[#211A2D]">Match Note:</strong> {activeModalMatch.details}
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-[#EAE3F3]">
              <Button
                variant="primary"
                size="sm"
                onClick={() => setActiveModalMatch(null)}
              >
                Close Summary
              </Button>
            </div>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
};
