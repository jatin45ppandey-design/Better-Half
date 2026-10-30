import React, { useState } from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { mockSocialAdapter } from '../services/mockSocialAdapter';
import type {
  AdminUserData,
  AdminQuestionItem,
  AdminAuditLog,
} from '../services/mockSocialAdapter';
import { GAMES_DATA } from '../data/games/registry';
import type { GameItem } from '../types/game';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import {
  ShieldAlert,
  Activity,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'games' | 'questions' | 'logs'>('users');
  const [users, setUsers] = useState<AdminUserData[]>(mockSocialAdapter.getAdminUsers());
  const [questions, setQuestions] = useState<AdminQuestionItem[]>(mockSocialAdapter.getAdminQuestions());
  const [logs] = useState<AdminAuditLog[]>(mockSocialAdapter.getAdminLogs());
  const [disabledGames, setDisabledGames] = useState<Record<string, boolean>>({});

  // Question modal state
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [questionGameType, setQuestionGameType] = useState<AdminQuestionItem['gameType']>('truth-or-dare');
  const [questionCategory, setQuestionCategory] = useState('Romantic & Flirty');
  const [questionIntensity, setQuestionIntensity] = useState<AdminQuestionItem['intensity']>('medium');
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');

  const { addToast } = useToast();

  const handleToggleUserStatus = (userId: string) => {
    soundService.playClick();
    const updated = mockSocialAdapter.toggleUserStatus(userId);
    setUsers([...updated]);
    addToast('User account status updated', { type: 'info' });
  };

  const handleToggleGame = (gameId: string) => {
    soundService.playClick();
    setDisabledGames((prev) => ({
      ...prev,
      [gameId]: !prev[gameId],
    }));
    addToast(`Game availability updated for ${gameId}`, { type: 'info' });
  };

  const handleAddQuestion = () => {
    if (!questionPrompt.trim()) {
      addToast('Please enter a question prompt', { type: 'error' });
      return;
    }
    soundService.playSuccess();
    const updated = mockSocialAdapter.addAdminQuestion({
      gameType: questionGameType,
      type: questionGameType === 'truth-or-dare' ? 'truth' : undefined,
      category: questionCategory,
      intensity: questionIntensity,
      prompt: questionPrompt.trim(),
      optionA: questionGameType === 'would-you-rather' ? optionA.trim() : undefined,
      optionB: questionGameType === 'would-you-rather' ? optionB.trim() : undefined,
    });
    setQuestions([...updated]);
    setIsAddQuestionOpen(false);
    setQuestionPrompt('');
    setOptionA('');
    setOptionB('');
    addToast('Question added to local library', { type: 'success' });
  };

  const handleDeleteQuestion = (id: string) => {
    soundService.playBuzzer();
    const updated = mockSocialAdapter.deleteAdminQuestion(id);
    setQuestions([...updated]);
    addToast('Question removed from library', { type: 'info' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Strict Honesty / Admin Warning Banner */}
        <div className="mb-6 p-4 rounded-3xl bg-[#FEF3C7] border border-[#FDE68A] text-[#92400E] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-3">
            <ShieldAlert className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5 sm:mt-0" />
            <div className="text-xs">
              <strong className="font-extrabold uppercase tracking-wide block sm:inline">
                Admin Preview — Frontend Prototype Only:{' '}
              </strong>
              <span>
                This screen demonstrates administrative UI controls using local sample data. Admin access is NOT production-authenticated or secure.
              </span>
            </div>
          </div>
          <Badge variant="warning" size="sm" className="self-start sm:self-auto shrink-0">
            Preview Mode
          </Badge>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
                Platform Admin Preview
              </h1>
            </div>
            <p className="text-sm text-[#756D82]">
              Manage sample users, game availability switches, question libraries, and audit logs.
            </p>
          </div>

          <Badge variant="purple" size="md">
            v1.0.0-phase3
          </Badge>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              Sample Users
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#211A2D]">2,410</span>
            <span className="text-[11px] text-[#248A62] block mt-1 font-semibold">+48 today</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              Active Rooms
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#593B91]">18</span>
            <span className="text-[11px] text-[#756D82] block mt-1">11 Couple • 7 Squad</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              Matches Today
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#248A62]">342</span>
            <span className="text-[11px] text-[#756D82] block mt-1">Across 11 game types</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              Platform Uptime
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#211A2D]">99.9%</span>
            <span className="text-[11px] text-[#248A62] block mt-1 font-semibold">Local Dev Server</span>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-[#F8F4FF] p-1.5 rounded-2xl border border-[#EAE3F3] mb-6 overflow-x-auto">
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('users');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'users'
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            User Management ({users.length})
          </button>
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('games');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'games'
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            Game Catalog Availability ({GAMES_DATA.length})
          </button>
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('questions');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'questions'
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            Question Library ({questions.length})
          </button>
          <button
            onClick={() => {
              soundService.playClick();
              setActiveTab('logs');
            }}
            className={`px-4 py-2 text-xs font-bold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'logs'
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            Audit Logs ({logs.length})
          </button>
        </div>

        {/* Tab Content: Users */}
        {activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[#EAE3F3] flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-[#211A2D]">Sample Registered Users</h3>
                <p className="text-xs text-[#756D82]">Preview user suspension & role capabilities</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FCFAFF] border-b border-[#EAE3F3] text-[#756D82] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Matches</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE3F3]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#FCFAFF]">
                      <td className="py-3.5 px-4 font-bold text-[#211A2D]">{u.name}</td>
                      <td className="py-3.5 px-4 text-[#756D82]">{u.email}</td>
                      <td className="py-3.5 px-4">
                        <Badge variant={u.role === 'admin' ? 'purple' : 'subtle'} size="sm">
                          {u.role}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={u.status === 'active' ? 'success' : 'pink'}
                          size="sm"
                        >
                          {u.status}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{u.matchesPlayed}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px] py-1"
                          onClick={() => handleToggleUserStatus(u.id)}
                        >
                          {u.status === 'active' ? 'Suspend' : 'Activate'}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab Content: Games Availability */}
        {activeTab === 'games' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-black text-[#211A2D]">Game Catalog Availability</h3>
              <p className="text-xs text-[#756D82]">
                Toggle whether games appear in Room Lobby selection and Dashboard.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {GAMES_DATA.map((game: GameItem) => {
                const isDisabled = !!disabledGames[game.id];
                const isCoupleOnly = game.modes.includes('couple') && !game.modes.includes('friend');

                return (
                  <div
                    key={game.id}
                    className="p-4 rounded-2xl border border-[#EAE3F3] flex items-center justify-between gap-4 bg-[#FCFAFF]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#211A2D]">
                          {game.name}
                        </span>
                        <Badge
                          variant={isCoupleOnly ? 'pink' : 'purple'}
                          size="sm"
                        >
                          {isCoupleOnly ? 'Couple 2P' : 'Couple & Friend'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#756D82] mt-0.5 line-clamp-1">
                        {game.description}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleGame(game.id)}
                      className={`cursor-pointer transition-colors ${
                        isDisabled ? 'text-[#756D82]' : 'text-[#248A62]'
                      }`}
                      title={isDisabled ? 'Game Disabled' : 'Game Active'}
                    >
                      {isDisabled ? (
                        <ToggleLeft className="w-7 h-7 text-[#756D82]" />
                      ) : (
                        <ToggleRight className="w-7 h-7 text-[#248A62]" />
                      )}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Tab Content: Question Library */}
        {activeTab === 'questions' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-black text-[#211A2D]">Question Library Management</h3>
                <p className="text-xs text-[#756D82]">
                  Add and review prompt questions for conversational & party games.
                </p>
              </div>

              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-4 h-4" />}
                onClick={() => {
                  soundService.playClick();
                  setIsAddQuestionOpen(true);
                }}
              >
                Add Question
              </Button>
            </div>

            <div className="space-y-3">
              {questions.map((q) => (
                <div
                  key={q.id}
                  className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="purple" size="sm">
                        {q.gameType.toUpperCase()}
                      </Badge>
                      <Badge variant="lavender" size="sm">
                        {q.category}
                      </Badge>
                      <Badge
                        variant={q.intensity === 'deep' ? 'pink' : 'subtle'}
                        size="sm"
                      >
                        {q.intensity}
                      </Badge>
                    </div>
                    <p className="font-bold text-[#211A2D] text-sm pt-1">{q.prompt}</p>
                    {q.optionA && q.optionB && (
                      <p className="text-[11px] text-[#756D82]">
                        A: {q.optionA} | B: {q.optionB}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    className="self-end sm:self-auto text-[#D94C65] hover:bg-[#FDF2F4]"
                    onClick={() => handleDeleteQuestion(q.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Logs */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-black text-[#211A2D]">System Audit Log Preview</h3>
              <p className="text-xs text-[#756D82]">Simulated audit trails of admin and moderation events</p>
            </div>

            <div className="space-y-3">
              {logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3">
                    <Badge
                      variant={log.severity === 'warning' ? 'warning' : 'subtle'}
                      size="sm"
                    >
                      {log.severity.toUpperCase()}
                    </Badge>
                    <div>
                      <span className="font-extrabold text-[#211A2D]">{log.action}</span>: {log.target}
                      <span className="block text-[11px] text-[#756D82]">By: {log.actor}</span>
                    </div>
                  </div>

                  <span className="text-[11px] text-[#756D82] font-mono shrink-0">
                    {log.timestamp}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Add Question Modal */}
      <Modal
        isOpen={isAddQuestionOpen}
        onClose={() => setIsAddQuestionOpen(false)}
        title="Add Question to Library"
        description="Expand the prompt catalogue for couple & party game modules."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Target Game</label>
            <select
              value={questionGameType}
              onChange={(e) => setQuestionGameType(e.target.value as AdminQuestionItem['gameType'])}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] outline-none"
            >
              <option value="truth-or-dare">Truth or Dare</option>
              <option value="would-you-rather">Would You Rather</option>
              <option value="between-us">BETWEEN US</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Category</label>
            <input
              type="text"
              value={questionCategory}
              onChange={(e) => setQuestionCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs text-[#211A2D] outline-none"
              placeholder="e.g. Romantic & Flirty, Daily Life, Deep Thoughts"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Intensity Level</label>
            <select
              value={questionIntensity}
              onChange={(e) => setQuestionIntensity(e.target.value as AdminQuestionItem['intensity'])}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] outline-none"
            >
              <option value="light">Light</option>
              <option value="medium">Medium</option>
              <option value="deep">Deep</option>
              <option value="wild">Wild (18+)</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Question Prompt</label>
            <textarea
              value={questionPrompt}
              onChange={(e) => setQuestionPrompt(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs text-[#211A2D] outline-none h-20 resize-none"
              placeholder="Write the question or prompt here..."
            />
          </div>

          {questionGameType === 'would-you-rather' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-[#211A2D] block mb-1">Option A</label>
                <input
                  type="text"
                  value={optionA}
                  onChange={(e) => setOptionA(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs text-[#211A2D] outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-[#211A2D] block mb-1">Option B</label>
                <input
                  type="text"
                  value={optionB}
                  onChange={(e) => setOptionB(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs text-[#211A2D] outline-none"
                />
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EAE3F3]">
            <Button variant="ghost" size="sm" onClick={() => setIsAddQuestionOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleAddQuestion}>
              Save Question
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
};
