import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Button } from '../components/ui/Button';
import { soundService } from '../services/soundService';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { api } from '../services/api';
import {
  Settings,
  Volume2,
  VolumeX,
  Sparkles,
  Shield,
  Bell,
  LogOut,
  RotateCcw,
} from 'lucide-react';

export const SettingsPage: React.FC = () => {
  const [soundMuted, setSoundMuted] = useState<boolean>(soundService.isMuted());
  const [volume, setVolume] = useState<number>(soundService.getVolume());
  const [reducedMotion, setReducedMotion] = useState<boolean>(() => {
    try {
      return localStorage.getItem('playspace_reduced_motion') === 'true';
    } catch {
      return false;
    }
  });
  const [notifications, setNotifications] = useState({
    invitations: true,
    turnAlerts: true,
    chatPings: false,
  });
  const [privacy, setPrivacy] = useState({
    ghostMode: false,
    readReceipts: true,
    showStats: true,
  });

  const { logout, user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Load persisted settings from backend
  useEffect(() => {
    async function loadSettings() {
      try {
        const s = await api.settings.get();
        if (s) {
          setPrivacy((prev) => ({
            ...prev,
            ghostMode: s.ghostMode,
            showStats: s.publicMatchHistory,
          }));
          if (s.soundMuted !== undefined) {
            setSoundMuted(s.soundMuted);
            soundService.setMuted(s.soundMuted);
          }
          if (s.volume !== undefined) {
            setVolume(s.volume);
            soundService.setVolume(s.volume);
          }
          if (s.reducedMotion !== undefined) {
            setReducedMotion(s.reducedMotion);
          }
        }
      } catch (err) {
        console.warn('Could not fetch backend settings:', err);
      }
    }
    loadSettings();
  }, []);

  const handleToggleSound = async (enabled: boolean) => {
    const isMuted = !enabled;
    soundService.setMuted(isMuted);
    setSoundMuted(isMuted);
    addToast(enabled ? 'Sound effects enabled' : 'Sound effects muted', {
      type: 'info',
    });

    try {
      await api.settings.update({ soundMuted: isMuted });
    } catch {
      // ignore
    }
  };

  const handleVolumeChange = async (newVal: number) => {
    soundService.setVolume(newVal);
    setVolume(newVal);
    if (!soundMuted) {
      soundService.playClick();
    }
    try {
      await api.settings.update({ volume: newVal });
    } catch {
      // ignore
    }
  };

  const handleToggleMotion = async (reduced: boolean) => {
    setReducedMotion(reduced);
    try {
      localStorage.setItem('playspace_reduced_motion', String(reduced));
      if (reduced) {
        document.documentElement.classList.add('reduce-motion');
      } else {
        document.documentElement.classList.remove('reduce-motion');
      }
      await api.settings.update({ reducedMotion: reduced });
    } catch {
      // ignore
    }
    soundService.playClick();
    addToast(reduced ? 'Reduced motion enabled' : 'Smooth animations enabled', {
      type: 'info',
    });
  };

  const handleResetDemo = () => {
    soundService.playBuzzer();
    try {
      localStorage.removeItem('playspace_profile');
      localStorage.removeItem('playspace_friends');
      localStorage.removeItem('playspace_friend_requests');
      localStorage.removeItem('playspace_invitations');
      localStorage.removeItem('playspace_match_history');
      localStorage.removeItem('playspace_rivalry');
      localStorage.removeItem('playspace_admin_users');
      localStorage.removeItem('playspace_admin_questions');
      localStorage.removeItem('playspace_admin_logs');
    } catch {
      // ignore
    }
    addToast('Local storage cache cleared', { type: 'success' });
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  const handleLogout = async () => {
    soundService.playClick();
    await logout();
    addToast('Signed out of PlaySpace', { type: 'info' });
    navigate('/login');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Page Header */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-6 h-6 text-[#9670E8]" />
            <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
              Settings & Preferences
            </h1>
          </div>
          <p className="text-sm text-[#756D82]">
            Customize your audio feedback, motion, notifications, and authenticated session preferences.
          </p>
        </div>

        <div className="space-y-6">
          {/* Sound & Audio Effects */}
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                {soundMuted ? (
                  <VolumeX className="w-5 h-5 text-[#756D82]" />
                ) : (
                  <Volume2 className="w-5 h-5 text-[#9670E8]" />
                )}
                <div>
                  <h2 className="text-base font-black text-[#211A2D]">Sound & Audio Effects</h2>
                  <p className="text-xs text-[#756D82]">Synthesized Web Audio SFX (Zero external audio files)</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  variant={soundMuted ? 'outline' : 'primary'}
                  size="sm"
                  onClick={() => handleToggleSound(soundMuted)}
                >
                  {soundMuted ? 'Turn Sound ON' : 'Mute All SFX'}
                </Button>
              </div>
            </div>

            <div className="space-y-4 pt-2">
              <div className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#211A2D] block">SFX Master Volume</span>
                  <span className="text-[11px] text-[#756D82]">Controls synthesized chime and click amplitude</span>
                </div>
                <div className="flex items-center gap-3 w-full sm:w-48">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    disabled={soundMuted}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    className="w-full accent-[#593B91] cursor-pointer disabled:opacity-40"
                  />
                  <span className="text-xs font-mono font-bold text-[#593B91] w-8">
                    {Math.round(volume * 100)}%
                  </span>
                </div>
              </div>

              {/* Sound Test Buttons */}
              <div className="p-3.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
                <span className="text-xs font-bold text-[#211A2D] block mb-2">Test Sound Profiles:</span>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-1"
                    onClick={() => soundService.playClick()}
                  >
                    Click
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-1"
                    onClick={() => soundService.playCard()}
                  >
                    Card Flip
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-1"
                    onClick={() => soundService.playSuccess()}
                  >
                    Success Chime
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-1"
                    onClick={() => soundService.playVictory()}
                  >
                    Victory Fanfare
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-1"
                    onClick={() => soundService.playBuzzer()}
                  >
                    Buzzer
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Animation & Accessibility */}
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <Sparkles className="w-5 h-5 text-[#9670E8]" />
              <div>
                <h2 className="text-base font-black text-[#211A2D]">Animation & Accessibility</h2>
                <p className="text-xs text-[#756D82]">Respect system motion constraints</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#211A2D] block">Reduced Motion Mode</span>
                  <span className="text-[11px] text-[#756D82]">
                    Disables fast transforms, bounces, and pulsing effects
                  </span>
                </div>
                <input
                  type="checkbox"
                  checked={reducedMotion}
                  onChange={(e) => handleToggleMotion(e.target.checked)}
                  className="w-4 h-4 accent-[#593B91] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Privacy & Social Controls */}
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <Shield className="w-5 h-5 text-[#9670E8]" />
              <div>
                <h2 className="text-base font-black text-[#211A2D]">Privacy Preferences</h2>
                <p className="text-xs text-[#756D82]">Control your profile visibility and lobby privacy</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#211A2D] block">Ghost Mode</span>
                  <span className="text-[11px] text-[#756D82]">Appear offline in friend lists and lobby search</span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.ghostMode}
                  onChange={async (e) => {
                    soundService.playClick();
                    const val = e.target.checked;
                    setPrivacy({ ...privacy, ghostMode: val });
                    try {
                      await api.settings.update({ ghostMode: val });
                    } catch {
                      // ignore
                    }
                  }}
                  className="w-4 h-4 accent-[#593B91] cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#211A2D] block">Read Receipts for Room Chat</span>
                  <span className="text-[11px] text-[#756D82]">Show checkmarks when you see lobby chat</span>
                </div>
                <input
                  type="checkbox"
                  checked={privacy.readReceipts}
                  onChange={(e) => {
                    soundService.playClick();
                    setPrivacy({ ...privacy, readReceipts: e.target.checked });
                  }}
                  className="w-4 h-4 accent-[#593B91] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <div className="flex items-center gap-2.5 mb-4">
              <Bell className="w-5 h-5 text-[#9670E8]" />
              <div>
                <h2 className="text-base font-black text-[#211A2D]">Notifications</h2>
                <p className="text-xs text-[#756D82]">In-app notification preferences</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#211A2D] block">Lobby Invitations</span>
                  <span className="text-[11px] text-[#756D82]">Display toast notifications when friend invites arrive</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.invitations}
                  onChange={(e) => setNotifications({ ...notifications, invitations: e.target.checked })}
                  className="w-4 h-4 accent-[#593B91] cursor-pointer"
                />
              </div>

              <div className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-4">
                <div>
                  <span className="text-xs font-bold text-[#211A2D] block">Turn Alerts</span>
                  <span className="text-[11px] text-[#756D82]">Alert when it is your turn in local multiplayer games</span>
                </div>
                <input
                  type="checkbox"
                  checked={notifications.turnAlerts}
                  onChange={(e) => setNotifications({ ...notifications, turnAlerts: e.target.checked })}
                  className="w-4 h-4 accent-[#593B91] cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Account & Session Actions */}
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-6 shadow-sm">
            <h2 className="text-base font-black text-[#211A2D] mb-1">Session & Account</h2>
            <p className="text-xs text-[#756D82] mb-4">Manage your authenticated PlaySpace session</p>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<RotateCcw className="w-4 h-4" />}
                onClick={handleResetDemo}
              >
                Clear Local Cache
              </Button>
              <Button
                variant="danger"
                size="sm"
                leftIcon={<LogOut className="w-4 h-4" />}
                onClick={handleLogout}
              >
                Sign Out {user?.name ? `(${user.name})` : ''}
              </Button>
            </div>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};
