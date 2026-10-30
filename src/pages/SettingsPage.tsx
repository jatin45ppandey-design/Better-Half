
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Button } from '../components/ui/Button';
import { soundService } from '../services/soundService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api, type UserSettingsResponse } from '../services/api';
import {
  Settings,
  Volume2,
  VolumeX,
  Sparkles,
  Shield,
  LogOut,
  RefreshCw,
} from 'lucide-react';

type EditableSetting =
  | 'showOnlineStatus'
  | 'allowDirectInvites'
  | 'publicMatchHistory'
  | 'ghostMode'
  | 'soundMuted'
  | 'volume'
  | 'reducedMotion';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<UserSettingsResponse | null>(null);
  const [volumeDraft, setVolumeDraft] = useState(0.8);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [savingField, setSavingField] = useState<EditableSetting | null>(null);

  const { logout, user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const loadSettings = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const saved = await api.settings.get();
      setSettings(saved);
      setVolumeDraft(saved.volume);
      soundService.setMuted(saved.soundMuted);
      soundService.setVolume(saved.volume);
      if (saved.reducedMotion) {
        document.documentElement.classList.add('reduce-motion');
      } else {
        document.documentElement.classList.remove('reduce-motion');
      }
    } catch (err) {
      setSettings(null);
      setLoadError(err instanceof Error ? err.message : 'Your preferences could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const saveSetting = async (key: EditableSetting, value: boolean | number) => {
    if (!settings || savingField) return;
    setSavingField(key);
    try {
      const updated = await api.settings.update({ [key]: value } as Partial<UserSettingsResponse>);
      setSettings(updated);
      setVolumeDraft(updated.volume);

      if (key === 'soundMuted') soundService.setMuted(updated.soundMuted);
      if (key === 'volume') soundService.setVolume(updated.volume);
      if (key === 'reducedMotion') {
        if (updated.reducedMotion) {
          document.documentElement.classList.add('reduce-motion');
        } else {
          document.documentElement.classList.remove('reduce-motion');
        }
      }

      addToast('Preference saved.', { type: 'success' });
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Preference could not be saved.', { type: 'error' });
    } finally {
      setSavingField(null);
    }
  };

  const handleLogout = async () => {
    await logout();
    addToast('Signed out of PlaySpace.', { type: 'info' });
    navigate('/login');
  };

  const toggleRows: Array<{ key: Exclude<EditableSetting, 'volume'>; title: string; description: string }> = [
    { key: 'showOnlineStatus', title: 'Show online status', description: 'Let friends see when you are available.' },
    { key: 'allowDirectInvites', title: 'Allow direct invitations', description: 'Allow friends to invite you to their rooms.' },
    { key: 'publicMatchHistory', title: 'Public match history', description: 'Allow your recorded match history on your public profile.' },
    { key: 'ghostMode', title: 'Ghost mode', description: 'Hide your presence from friend discovery.' },
    { key: 'reducedMotion', title: 'Reduced motion', description: 'Reduce motion effects and animations throughout PlaySpace.' },
    { key: 'soundMuted', title: 'Mute sound effects', description: 'Turn off synthesized interface and game sound effects.' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Settings className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">Settings & Preferences</h1>
            </div>
            <p className="text-sm text-[#756D82]">Manage the preferences saved to your PlaySpace account.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadSettings()} disabled={isLoading} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>
            Refresh
          </Button>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-[#EAE3F3] bg-white p-10 text-center text-sm text-[#756D82]">Loading your saved preferences…</div>
        ) : loadError || !settings ? (
          <div className="rounded-3xl border border-[#F8D2D9] bg-white p-10 text-center">
            <p className="text-sm text-[#A52E45]">{loadError || 'Your preferences are unavailable.'}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadSettings()}>Try again</Button>
          </div>
        ) : (
          <div className="space-y-6">
            <section className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                {settings.soundMuted ? <VolumeX className="w-5 h-5 text-[#756D82]" /> : <Volume2 className="w-5 h-5 text-[#9670E8]" />}
                <div>
                  <h2 className="text-base font-black text-[#211A2D]">Sound & Audio</h2>
                  <p className="text-xs text-[#756D82]">Synthesized sound effects and master volume.</p>
                </div>
              </div>
              <div className="space-y-4">
                <label className="flex items-center justify-between gap-4 rounded-2xl border border-[#EAE3F3] bg-[#FCFAFF] p-3.5">
                  <span>
                    <span className="block text-xs font-bold text-[#211A2D]">Mute sound effects</span>
                    <span className="block text-[11px] text-[#756D82]">This preference is stored in your account.</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={settings.soundMuted}
                    disabled={savingField !== null}
                    onChange={(event) => void saveSetting('soundMuted', event.target.checked)}
                    className="h-4 w-4 accent-[#593B91]"
                  />
                </label>
                <div className="rounded-2xl border border-[#EAE3F3] bg-[#FCFAFF] p-3.5">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <span className="text-xs font-bold text-[#211A2D]">Master volume</span>
                    <span className="text-xs font-mono font-bold text-[#593B91]">{Math.round(volumeDraft * 100)}%</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={volumeDraft}
                      disabled={settings.soundMuted || savingField !== null}
                      onChange={(event) => setVolumeDraft(Number(event.target.value))}
                      className="w-full accent-[#593B91] disabled:opacity-40"
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={settings.soundMuted || savingField !== null || volumeDraft === settings.volume}
                      isLoading={savingField === 'volume'}
                      onClick={() => void saveSetting('volume', volumeDraft)}
                    >
                      Save
                    </Button>
                  </div>
                </div>
                <div className="rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] p-3.5">
                  <span className="block text-xs font-bold text-[#211A2D] mb-2">Test sound</span>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" disabled={settings.soundMuted || savingField !== null} onClick={() => soundService.playClick()}>Click</Button>
                    <Button variant="outline" size="sm" disabled={settings.soundMuted || savingField !== null} onClick={() => soundService.playCard()}>Card flip</Button>
                    <Button variant="outline" size="sm" disabled={settings.soundMuted || savingField !== null} onClick={() => soundService.playSuccess()}>Success</Button>
                    <Button variant="outline" size="sm" disabled={settings.soundMuted || savingField !== null} onClick={() => soundService.playVictory()}>Victory</Button>
                  </div>
                </div>
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-4">
                <Shield className="w-5 h-5 text-[#9670E8]" />
                <div>
                  <h2 className="text-base font-black text-[#211A2D]">Privacy & Accessibility</h2>
                  <p className="text-xs text-[#756D82]">All controls below map to persisted account settings.</p>
                </div>
              </div>
              <div className="space-y-3">
                {toggleRows.map(({ key, title, description }) => (
                  <label key={key} className="flex items-center justify-between gap-4 rounded-2xl border border-[#EAE3F3] bg-[#FCFAFF] p-3.5">
                    <span>
                      <span className="block text-xs font-bold text-[#211A2D]">{title}</span>
                      <span className="block text-[11px] text-[#756D82]">{description}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={Boolean(settings[key])}
                      disabled={savingField !== null}
                      onChange={(event) => void saveSetting(key, event.target.checked)}
                      className="h-4 w-4 accent-[#593B91]"
                    />
                  </label>
                ))}
              </div>
            </section>

            <section className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
              <h2 className="text-base font-black text-[#211A2D] mb-1">Account</h2>
              <p className="text-xs text-[#756D82] mb-4">Signed in as {user?.email || 'your PlaySpace account'}.</p>
              <Button variant="danger" size="sm" leftIcon={<LogOut className="w-4 h-4" />} onClick={() => void handleLogout()}>
                Sign Out
              </Button>
            </section>
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
};
