import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { api } from '../services/api';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import {
  ShieldCheck,
  ShieldAlert,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
  Loader2,
  RefreshCw,
  Search,
} from 'lucide-react';

interface AdminMetrics {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  activeRooms: number;
  activeGameSessions: number;
  totalCompletedMatches: number;
  completedMatchesToday: number;
  enabledGames: number;
  totalQuestions: number;
  serviceHealth: string;
}

interface AdminUserItem {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  accountStatus: string;
  roles: string[];
  matchesPlayed: number;
  roomsHosted: number;
  createdAt: string;
}

interface GameConfigItem {
  id: string;
  gameId: string;
  isEnabled: boolean;
  coupleEnabled: boolean;
  friendEnabled: boolean;
  maintenanceMessage: string | null;
}

interface QuestionItem {
  id: string;
  gameId: string;
  sourceKey: string;
  prompt: string;
  questionType: string | null;
  optionA: string | null;
  optionB: string | null;
  category: string | null;
  intensity: number | null;
  isActive: boolean;
  createdAt: string;
}

interface AuditLogItem {
  id: string;
  actorUserId: string | null;
  action: string;
  targetType: string;
  targetId: string | null;
  metadata: any;
  createdAt: string;
}

export const AdminDashboardPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'users' | 'games' | 'questions' | 'logs'>('users');
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [games, setGames] = useState<GameConfigItem[]>([]);
  const [questions, setQuestions] = useState<QuestionItem[]>([]);
  const [logs, setLogs] = useState<AuditLogItem[]>([]);

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isForbidden, setIsForbidden] = useState<boolean>(false);
  const [userSearch, setUserSearch] = useState<string>('');
  const [userStatusFilter, setUserStatusFilter] = useState<string>('ALL');

  // Question modal state
  const [isAddQuestionOpen, setIsAddQuestionOpen] = useState(false);
  const [questionGameType, setQuestionGameType] = useState<string>('truth-or-dare');
  const [questionCategory, setQuestionCategory] = useState('Romantic & Flirty');
  const [questionIntensity, setQuestionIntensity] = useState<number>(2);
  const [questionPrompt, setQuestionPrompt] = useState('');
  const [questionType, setQuestionType] = useState<'TRUTH' | 'DARE'>('TRUTH');
  const [optionA, setOptionA] = useState('');
  const [optionB, setOptionB] = useState('');

  const { addToast } = useToast();

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setIsForbidden(false);

    try {
      // 1. Load overview metrics
      const overviewRes = await api.admin.getOverview();
      setMetrics(overviewRes.data);

      // 2. Load tab specific data
      if (activeTab === 'users') {
        const usersRes = await api.admin.getUsers({
          search: userSearch || undefined,
          status: userStatusFilter !== 'ALL' ? userStatusFilter : undefined,
          limit: 30,
        });
        setUsers(usersRes.data.users || []);
      } else if (activeTab === 'games') {
        const gamesRes = await api.admin.getGames();
        setGames(gamesRes.data || []);
      } else if (activeTab === 'questions') {
        const questionsRes = await api.admin.getQuestions({ limit: 40 });
        setQuestions(questionsRes.data.questions || []);
      } else if (activeTab === 'logs') {
        const logsRes = await api.admin.getAuditLogs({ limit: 30 });
        setLogs(logsRes.data.logs || []);
      }
    } catch (err: any) {
      if (err?.status === 403 || err?.message?.includes('denied') || err?.message?.includes('privileges')) {
        setIsForbidden(true);
      } else {
        addToast(err?.message || 'Failed to load admin data.', { type: 'error' });
      }
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, userSearch, userStatusFilter, addToast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleToggleUserStatus = async (userItem: AdminUserItem) => {
    soundService.playClick();
    const newStatus = userItem.accountStatus === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    try {
      await api.admin.updateUserStatus(
        userItem.id,
        newStatus,
        `Administrative status change to ${newStatus}`
      );
      addToast(`User ${userItem.displayName} updated to ${newStatus}`, { type: 'success' });
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to update user status.', { type: 'error' });
    }
  };

  const handleToggleGame = async (gameItem: GameConfigItem) => {
    soundService.playClick();
    const nextEnabled = !gameItem.isEnabled;
    try {
      await api.admin.updateGame(gameItem.gameId, {
        isEnabled: nextEnabled,
      });
      addToast(`Game ${gameItem.gameId} is now ${nextEnabled ? 'enabled' : 'disabled'}`, {
        type: 'info',
      });
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to update game availability.', { type: 'error' });
    }
  };

  const handleAddQuestion = async () => {
    if (!questionPrompt.trim()) {
      addToast('Please enter a question prompt', { type: 'error' });
      return;
    }

    if (questionGameType === 'would-you-rather' && (!optionA.trim() || !optionB.trim())) {
      addToast('Would You Rather questions require Option A and Option B', { type: 'error' });
      return;
    }

    soundService.playSuccess();
    try {
      await api.admin.createQuestion({
        gameId: questionGameType,
        prompt: questionPrompt.trim(),
        questionType: questionGameType === 'truth-or-dare' ? questionType : undefined,
        category: questionCategory.trim(),
        intensity: questionIntensity,
        optionA: questionGameType === 'would-you-rather' ? optionA.trim() : undefined,
        optionB: questionGameType === 'would-you-rather' ? optionB.trim() : undefined,
      });

      addToast('Question added to live database library', { type: 'success' });
      setIsAddQuestionOpen(false);
      setQuestionPrompt('');
      setOptionA('');
      setOptionB('');
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to create question.', { type: 'error' });
    }
  };

  const handleDeleteQuestion = async (id: string) => {
    soundService.playBuzzer();
    try {
      await api.admin.deleteQuestion(id);
      addToast('Question disabled in library', { type: 'info' });
      loadData();
    } catch (err: any) {
      addToast(err?.message || 'Failed to disable question.', { type: 'error' });
    }
  };

  if (isForbidden) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
        <Navbar />
        <main className="flex-1 max-w-xl w-full mx-auto px-4 py-20 text-center flex flex-col items-center justify-center">
          <div className="w-16 h-16 rounded-3xl bg-[#FDF0F2] text-[#D94C65] flex items-center justify-center mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-[#211A2D] mb-2">Access Denied</h1>
          <p className="text-sm text-[#756D82] leading-relaxed mb-6">
            Administrator or Moderator privileges are required to view the PlaySpace management center.
            Your account does not possess the requisite RBAC authorization.
          </p>
          <Button variant="primary" onClick={() => window.location.replace('/dashboard')}>
            Return to Dashboard
          </Button>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
                Platform Admin Center
              </h1>
            </div>
            <p className="text-sm text-[#756D82]">
              Real-time user moderation, game availability control, question catalogue, and audit trails.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              leftIcon={<RefreshCw className="w-4 h-4" />}
              onClick={loadData}
            >
              Refresh
            </Button>
            <Badge variant={import.meta.env.PROD ? 'success' : 'purple'} size="md">
              {import.meta.env.PROD ? 'Production Environment' : 'Development Environment'}
            </Badge>
          </div>
        </div>

        {/* Overview Metric Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              Registered Users
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#211A2D]">
              {metrics ? metrics.totalUsers.toLocaleString() : '...'}
            </span>
            <span className="text-[11px] text-[#248A62] block mt-1 font-semibold">
              {metrics ? `${metrics.activeUsers} active (7d)` : ''}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              Active Rooms
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#593B91]">
              {metrics ? metrics.activeRooms : '...'}
            </span>
            <span className="text-[11px] text-[#756D82] block mt-1">
              {metrics ? `${metrics.activeGameSessions} active matches` : ''}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              Matches Today
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#248A62]">
              {metrics ? metrics.completedMatchesToday : '...'}
            </span>
            <span className="text-[11px] text-[#756D82] block mt-1">
              {metrics ? `${metrics.totalCompletedMatches} total matches` : ''}
            </span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
            <span className="text-xs font-bold text-[#756D82] uppercase tracking-wider block mb-1">
              System Health
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#248A62]">
              {metrics ? metrics.serviceHealth : '...'}
            </span>
            <span className="text-[11px] text-[#756D82] block mt-1">
              {metrics ? `${metrics.enabledGames} games enabled` : ''}
            </span>
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
            User Management ({metrics ? metrics.totalUsers : users.length})
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
            Game Catalog Availability ({games.length || 11})
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
            Question Library ({metrics ? metrics.totalQuestions : questions.length})
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
            Audit Logs
          </button>
        </div>

        {/* Loading Spinner for Tabs */}
        {isLoading && (
          <div className="p-12 text-center flex items-center justify-center gap-2 text-sm text-[#756D82]">
            <Loader2 className="w-5 h-5 text-[#9670E8] animate-spin" />
            <span>Loading admin module...</span>
          </div>
        )}

        {/* Tab Content: Users */}
        {!isLoading && activeTab === 'users' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] overflow-hidden shadow-sm">
            <div className="p-5 border-b border-[#EAE3F3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-black text-[#211A2D]">Registered Users & Moderation</h3>
                <p className="text-xs text-[#756D82]">Inspect user profiles, suspend abusive accounts, and assign roles</p>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-[#756D82] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={userSearch}
                    onChange={(e) => setUserSearch(e.target.value)}
                    placeholder="Search users..."
                    className="pl-8 pr-3 py-1.5 rounded-xl border border-[#EAE3F3] text-xs outline-none bg-[#FCFAFF]"
                  />
                </div>
                <select
                  value={userStatusFilter}
                  onChange={(e) => setUserStatusFilter(e.target.value)}
                  className="px-2.5 py-1.5 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] bg-[#FCFAFF] outline-none"
                >
                  <option value="ALL">All Status</option>
                  <option value="ACTIVE">Active</option>
                  <option value="SUSPENDED">Suspended</option>
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#FCFAFF] border-b border-[#EAE3F3] text-[#756D82] uppercase font-bold tracking-wider">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4">Roles</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Matches</th>
                    <th className="py-3 px-4">Rooms Hosted</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EAE3F3]">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-[#FCFAFF]">
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#211A2D] block">{u.displayName}</span>
                        <span className="text-[11px] text-[#756D82]">@{u.username}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1">
                          {u.roles.length === 0 ? (
                            <Badge variant="subtle" size="sm">User</Badge>
                          ) : (
                            u.roles.map((r, idx) => (
                              <Badge key={idx} variant={r === 'ADMIN' ? 'purple' : 'lavender'} size="sm">
                                {r}
                              </Badge>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        <Badge
                          variant={u.accountStatus === 'ACTIVE' ? 'success' : 'pink'}
                          size="sm"
                        >
                          {u.accountStatus}
                        </Badge>
                      </td>
                      <td className="py-3.5 px-4 font-mono">{u.matchesPlayed}</td>
                      <td className="py-3.5 px-4 font-mono">{u.roomsHosted}</td>
                      <td className="py-3.5 px-4 text-right">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-[11px] py-1"
                          onClick={() => handleToggleUserStatus(u)}
                        >
                          {u.accountStatus === 'ACTIVE' ? 'Suspend' : 'Reinstate'}
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
        {!isLoading && activeTab === 'games' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-black text-[#211A2D]">Game Catalog Availability Management</h3>
              <p className="text-xs text-[#756D82]">
                Toggle whether games appear in room creation and multiplayer lobbies.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {games.map((game) => {
                const isCoupleOnly = game.coupleEnabled && !game.friendEnabled;

                return (
                  <div
                    key={game.gameId}
                    className="p-4 rounded-2xl border border-[#EAE3F3] flex items-center justify-between gap-4 bg-[#FCFAFF]"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-[#211A2D]">
                          {game.gameId}
                        </span>
                        <Badge
                          variant={isCoupleOnly ? 'pink' : 'purple'}
                          size="sm"
                        >
                          {isCoupleOnly ? 'Couple 2P' : 'Couple & Friend'}
                        </Badge>
                      </div>
                      <p className="text-xs text-[#756D82] mt-0.5">
                        Status: <strong className={game.isEnabled ? 'text-[#248A62]' : 'text-[#D94C65]'}>
                          {game.isEnabled ? 'Available' : 'Disabled / Maintenance'}
                        </strong>
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleToggleGame(game)}
                      className={`cursor-pointer transition-colors ${
                        !game.isEnabled ? 'text-[#756D82]' : 'text-[#248A62]'
                      }`}
                      title={!game.isEnabled ? 'Game Disabled' : 'Game Active'}
                    >
                      {!game.isEnabled ? (
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
        {!isLoading && activeTab === 'questions' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
              <div>
                <h3 className="text-base font-black text-[#211A2D]">Question Library Management</h3>
                <p className="text-xs text-[#756D82]">
                  Add, edit, or disable prompts for Truth or Dare, Would You Rather, and BETWEEN US.
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
                        {q.gameId.toUpperCase()}
                      </Badge>
                      {q.category && (
                        <Badge variant="lavender" size="sm">
                          {q.category}
                        </Badge>
                      )}
                      {q.intensity && (
                        <Badge variant={q.intensity >= 3 ? 'pink' : 'subtle'} size="sm">
                          Lvl {q.intensity}
                        </Badge>
                      )}
                      {!q.isActive && (
                        <Badge variant="pink" size="sm">Disabled</Badge>
                      )}
                    </div>
                    <p className="font-bold text-[#211A2D] text-sm pt-1">{q.prompt}</p>
                    {q.optionA && q.optionB && (
                      <p className="text-[11px] text-[#756D82]">
                        A: {q.optionA} | B: {q.optionB}
                      </p>
                    )}
                  </div>

                  {q.isActive && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="self-end sm:self-auto text-[#D94C65] hover:bg-[#FDF2F4]"
                      onClick={() => handleDeleteQuestion(q.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tab Content: Logs */}
        {!isLoading && activeTab === 'logs' && (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="mb-5">
              <h3 className="text-base font-black text-[#211A2D]">Immutable System Audit Logs</h3>
              <p className="text-xs text-[#756D82]">Append-only audit trail of moderation and configuration events</p>
            </div>

            <div className="space-y-3">
              {logs.length === 0 ? (
                <p className="text-xs text-[#756D82] py-4 text-center">No audit log records recorded yet.</p>
              ) : (
                logs.map((log) => (
                  <div
                    key={log.id}
                    className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <Badge
                        variant={log.action.includes('SUSPENDED') ? 'pink' : 'purple'}
                        size="sm"
                      >
                        {log.action}
                      </Badge>
                      <div>
                        <span className="font-extrabold text-[#211A2D]">{log.targetType}</span>: {log.targetId || 'N/A'}
                        <span className="block text-[11px] text-[#756D82]">
                          Actor: {log.actorUserId ? `@${log.actorUserId.substring(0, 8)}` : 'SYSTEM'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[11px] text-[#756D82] font-mono shrink-0">
                      {new Date(log.createdAt).toLocaleString()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </main>

      {/* Add Question Modal */}
      <Modal
        isOpen={isAddQuestionOpen}
        onClose={() => setIsAddQuestionOpen(false)}
        title="Add Question to Library"
        description="Expand the official question library with new conversational prompts."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Target Game</label>
            <select
              value={questionGameType}
              onChange={(e) => setQuestionGameType(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] outline-none"
            >
              <option value="truth-or-dare">Truth or Dare</option>
              <option value="would-you-rather">Would You Rather</option>
              <option value="between-us">BETWEEN US</option>
            </select>
          </div>

          {questionGameType === 'truth-or-dare' && (
            <div>
              <label className="text-xs font-bold text-[#211A2D] block mb-1">Type</label>
              <select
                value={questionType}
                onChange={(e) => setQuestionType(e.target.value as 'TRUTH' | 'DARE')}
                className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] outline-none"
              >
                <option value="TRUTH">TRUTH</option>
                <option value="DARE">DARE</option>
              </select>
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Category</label>
            <input
              type="text"
              value={questionCategory}
              onChange={(e) => setQuestionCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs text-[#211A2D] outline-none"
              placeholder="e.g. Romantic & Flirty, Deep Thoughts"
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Intensity Level (1-5)</label>
            <select
              value={questionIntensity}
              onChange={(e) => setQuestionIntensity(parseInt(e.target.value, 10))}
              className="w-full px-3 py-2 rounded-xl border border-[#EAE3F3] text-xs font-semibold text-[#211A2D] outline-none"
            >
              <option value={1}>Level 1: Light</option>
              <option value={2}>Level 2: Playful</option>
              <option value={3}>Level 3: Deep</option>
              <option value={4}>Level 4: Intense</option>
              <option value={5}>Level 5: After Dark (18+)</option>
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
