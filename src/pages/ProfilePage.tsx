import React, { useCallback, useEffect, useState } from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { api, type UserProfileResponse, type UserSettingsResponse } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { GAMES_DATA } from '../data/games';
import { Trophy, Gamepad2, Percent, Calendar, Lock, Edit3, RefreshCw } from 'lucide-react';

type PrivacySettingKey = 'showOnlineStatus' | 'allowDirectInvites' | 'publicMatchHistory' | 'ghostMode';
interface ProfileStats {
  totalMatches: number; wins: number; losses: number; draws: number;
  winRate: number; currentStreak: number;
}
interface GameStat {
  gameId: string; matchesPlayed: number; wins?: number; losses?: number; draws?: number;
}
interface RecentMatch {
  matchId: string; gameId: string; mode: string; outcome: string;
  scoreLabel?: string | null; completedAt?: string | null;
}

export const ProfilePage: React.FC = () => {
  const { refreshProfile } = useAuth();
  const { addToast } = useToast();
  const [profile, setProfile] = useState<UserProfileResponse | null>(null);
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [gameStats, setGameStats] = useState<GameStat[]>([]);
  const [recentMatches, setRecentMatches] = useState<RecentMatch[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [nameInput, setNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [bioInput, setBioInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [savingSetting, setSavingSetting] = useState<PrivacySettingKey | null>(null);

  const loadProfileData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [profileResponse, settingsResponse, statsResponse, gamesResponse, recentResponse] = await Promise.all([
        api.profiles.getMe(), api.settings.get(), api.stats.getMyStats(),
        api.stats.getMyGames(), api.stats.getMyRecent(),
      ]);
      setProfile(profileResponse);
      setSettings(settingsResponse);
      setStats(statsResponse.data);
      setGameStats(gamesResponse.data);
      setRecentMatches(recentResponse.data);
      setNameInput(profileResponse.displayName || '');
      setUsernameInput(profileResponse.username || '');
      setBioInput(profileResponse.bio || '');
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Your profile data could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void loadProfileData(); }, [loadProfileData]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setIsSaving(true);
    try {
      const updated = await api.profiles.updateMe({
        displayName: nameInput.trim(),
        username: usernameInput.trim().replace(/^@/, ''),
        bio: bioInput.trim(),
      });
      setProfile(updated);
      await refreshProfile();
      setIsEditing(false);
      addToast('Profile saved.', { type: 'success' });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Profile could not be saved.', { type: 'error' });
    } finally { setIsSaving(false); }
  };

  const handleTogglePrivacy = async (key: PrivacySettingKey) => {
    if (!settings || savingSetting) return;
    setSavingSetting(key);
    try {
      const updated = await api.settings.update({ [key]: !settings[key] });
      setSettings(updated);
      addToast('Privacy setting saved.', { type: 'success' });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Privacy setting could not be saved.', { type: 'error' });
    } finally { setSavingSetting(null); }
  };

  const formatOutcome = (outcome: string) => {
    switch (outcome) {
      case 'WIN': return 'Won';
      case 'LOSS': return 'Lost';
      case 'DRAW': return 'Draw';
      case 'COMPLETED': return 'Completed';
      case 'ABANDONED': return 'Abandoned';
      default: return outcome.replace(/_/g, ' ').toLowerCase();
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-7">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">Your Profile</h1>
            <p className="text-sm text-[#756D82] mt-1">Your Better-Half account and recorded game activity.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadProfileData()} disabled={isLoading} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-[#EAE3F3] bg-white p-10 text-center text-sm text-[#756D82]">Loading your profile…</div>
        ) : loadError || !profile || !settings || !stats ? (
          <div className="rounded-3xl border border-[#F8D2D9] bg-white p-10 text-center">
            <p className="text-sm text-[#A52E45]">{loadError || 'Profile data is unavailable.'}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadProfileData()}>Try again</Button>
          </div>
        ) : (
          <>
            <section className="relative bg-white rounded-3xl border border-[#EAE3F3] shadow-sm overflow-hidden p-6 sm:p-8 mb-7">
              <div className="absolute top-0 right-0 w-80 h-40 bg-gradient-to-bl from-[#E3D6FA]/40 to-transparent rounded-bl-full pointer-events-none" />
              <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
                <Avatar name={profile.displayName} initials={profile.avatarInitials || undefined} src={profile.avatarUrl || undefined} size="lg" bgColor={profile.avatarColor || '#9670E8'} />
                <div className="flex-1 text-center sm:text-left min-w-0">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h2 className="text-2xl font-black text-[#211A2D]">{profile.displayName}</h2>
                    <Badge variant="purple" size="sm">Better-Half Player</Badge>
                  </div>
                  <p className="text-sm text-[#756D82] mt-1">@{profile.username}</p>
                  {profile.bio && <p className="text-sm text-[#756D82] mt-3 max-w-2xl">{profile.bio}</p>}
                  <p className="text-xs text-[#9D96A8] mt-3 flex items-center justify-center sm:justify-start gap-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    Member since {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                  </p>
                </div>
                <Button variant="outline" size="sm" leftIcon={<Edit3 className="w-4 h-4" />} onClick={() => setIsEditing(true)}>Edit Profile</Button>
              </div>
            </section>

            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-7">
              {[
                { label: 'Matches', value: stats.totalMatches ?? 0, icon: <Gamepad2 className="w-4 h-4 text-[#9670E8]" /> },
                { label: 'Wins', value: stats.wins ?? 0, icon: <Trophy className="w-4 h-4 text-[#F2A33A]" /> },
                { label: 'Win rate', value: `${Math.round(stats.winRate ?? 0)}%`, icon: <Percent className="w-4 h-4 text-[#9670E8]" /> },
                { label: 'Current streak', value: stats.currentStreak ?? 0, icon: <Trophy className="w-4 h-4 text-[#593B91]" /> },
              ].map((metric) => (
                <div key={metric.label} className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs">
                  <div className="flex items-center justify-between text-[#756D82] mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider">{metric.label}</span>{metric.icon}
                  </div>
                  <div className="text-2xl sm:text-3xl font-black text-[#211A2D]">{metric.value}</div>
                </div>
              ))}
            </section>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-7">
              <section className="lg:col-span-2 bg-white p-6 rounded-3xl border border-[#EAE3F3] shadow-sm">
                <h2 className="text-lg font-black text-[#211A2D] mb-5">Game breakdown</h2>
                {gameStats.length > 0 ? (
                  <div className="space-y-3">
                    {gameStats.map((item) => {
                      const game = GAMES_DATA.find((entry) => entry.id === item.gameId);
                      return (
                        <div key={item.gameId} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#211A2D]">{game?.name || item.gameId}</p>
                            <p className="text-xs text-[#756D82]">{item.matchesPlayed} recorded matches</p>
                          </div>
                          <div className="text-right text-xs text-[#756D82]">
                            <p>{item.wins ?? 0} wins</p><p>{item.losses ?? 0} losses</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-[#D5C7EE] p-7 text-center text-sm text-[#756D82]">No per-game stats recorded yet.</div>
                )}
              </section>

              <section className="bg-white p-6 rounded-3xl border border-[#EAE3F3] shadow-sm">
                <div className="flex items-center gap-2 mb-4"><Lock className="w-4 h-4 text-[#9670E8]" /><h2 className="text-base font-black text-[#211A2D]">Privacy</h2></div>
                <div className="space-y-3">
                  {([
                    ['showOnlineStatus', 'Show online status', 'Let friends see your availability.'],
                    ['allowDirectInvites', 'Allow direct invites', 'Allow friends to invite you to rooms.'],
                    ['publicMatchHistory', 'Public match history', 'Allow match history on your public profile.'],
                    ['ghostMode', 'Ghost mode', 'Hide your presence from friend discovery.'],
                  ] as Array<[PrivacySettingKey, string, string]>).map(([key, title, description]) => (
                    <label key={key} className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
                      <span><span className="text-xs font-bold text-[#211A2D] block">{title}</span><span className="text-[11px] text-[#756D82]">{description}</span></span>
                      <input type="checkbox" checked={Boolean(settings[key])} disabled={savingSetting !== null} onChange={() => void handleTogglePrivacy(key)} className="w-4 h-4 accent-[#593B91] cursor-pointer" />
                    </label>
                  ))}
                </div>
              </section>
            </div>

            <section className="bg-white p-6 rounded-3xl border border-[#EAE3F3] shadow-sm mt-7">
              <h2 className="text-lg font-black text-[#211A2D] mb-4">Recent match history</h2>
              {recentMatches.length > 0 ? (
                <div className="divide-y divide-[#F4EFFB]">
                  {recentMatches.slice(0, 6).map((match) => {
                    const game = GAMES_DATA.find((entry) => entry.id === match.gameId);
                    return (
                      <div key={match.matchId} className="py-3 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-bold text-[#211A2D]">{game?.name || match.gameId}</p>
                          <p className="text-xs text-[#756D82]">{match.mode} · {match.completedAt ? new Date(match.completedAt).toLocaleString() : 'Date unavailable'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-[#593B91]">{formatOutcome(match.outcome)}</p>
                          {match.scoreLabel && <p className="text-xs text-[#756D82]">{match.scoreLabel}</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-[#D5C7EE] p-7 text-center text-sm text-[#756D82]">No completed matches have been recorded yet.</div>
              )}
            </section>
          </>
        )}
      </main>

      <Modal isOpen={isEditing} onClose={() => setIsEditing(false)} title="Edit Profile" description="Update your account details.">
        <div className="space-y-4 pt-2">
          <div><label className="text-xs font-bold text-[#211A2D] block mb-1">Display name</label><input value={nameInput} onChange={(event) => setNameInput(event.target.value)} maxLength={50} className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE3F3] text-sm" /></div>
          <div><label className="text-xs font-bold text-[#211A2D] block mb-1">Username</label><input value={usernameInput} onChange={(event) => setUsernameInput(event.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))} maxLength={24} minLength={3} className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE3F3] text-sm" /></div>
          <div><label className="text-xs font-bold text-[#211A2D] block mb-1">Bio</label><textarea value={bioInput} onChange={(event) => setBioInput(event.target.value)} maxLength={250} rows={3} className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE3F3] text-sm resize-none" /></div>
          <div className="flex justify-end gap-2 border-t border-[#EAE3F3] pt-3">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>Cancel</Button>
            <Button variant="primary" size="sm" isLoading={isSaving} disabled={isSaving} onClick={() => void handleSaveProfile()}>Save Profile</Button>
          </div>
        </div>
      </Modal>
      <Footer />
    </div>
  );
};
