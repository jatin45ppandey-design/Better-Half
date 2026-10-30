import React, { useState } from 'react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { mockSocialAdapter } from '../services/mockSocialAdapter';
import type { PlayerProfileData } from '../services/mockSocialAdapter';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import {
  Trophy,
  Swords,
  HeartHandshake,
  Percent,
  Edit3,
  Lock,
  Gamepad2,
  Calendar,
  Sparkles,
  Info,
  CheckCircle2,
} from 'lucide-react';

export const ProfilePage: React.FC = () => {
  const [profile, setProfile] = useState<PlayerProfileData>(mockSocialAdapter.getProfile());
  const [isEditing, setIsEditing] = useState(false);
  const [bioInput, setBioInput] = useState(profile.bio);
  const [nameInput, setNameInput] = useState(profile.name);
  const { addToast } = useToast();

  const winRate = Math.round((profile.wins / (profile.totalMatches || 1)) * 100);

  const handleSaveProfile = () => {
    soundService.playSuccess();
    const updated = mockSocialAdapter.updateProfile({
      name: nameInput.trim() || profile.name,
      bio: bioInput.trim() || profile.bio,
    });
    setProfile(updated);
    setIsEditing(false);
    addToast('Profile updated locally', { type: 'success' });
  };

  const handleTogglePrivacy = (key: keyof PlayerProfileData['privacy']) => {
    soundService.playClick();
    const nextPrivacy = {
      ...profile.privacy,
      [key]: !profile.privacy[key],
    };
    const updated = mockSocialAdapter.updateProfile({ privacy: nextPrivacy });
    setProfile(updated);
    addToast('Privacy preference saved', { type: 'info' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Sample Data Disclaimer Banner */}
        <div className="mb-6 p-3.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-center justify-between gap-3 text-xs text-[#756D82]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Local Prototype Notice:</strong> Career statistics, friend history, and records are sample data stored in local browser memory.
            </span>
          </div>
          <Badge variant="subtle" size="sm">Local Demo</Badge>
        </div>

        {/* Profile Header Card */}
        <div className="relative bg-white rounded-3xl border border-[#EAE3F3] shadow-sm overflow-hidden p-6 sm:p-8 mb-8">
          <div className="absolute top-0 right-0 w-96 h-48 bg-gradient-to-bl from-[#E3D6FA]/40 to-transparent rounded-bl-full pointer-events-none" />

          <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-6">
            <div className="relative">
              <Avatar
                name={profile.name}
                initials={profile.avatarInitials}
                size="lg"
                bgColor={profile.avatarColor}
                isOnline={profile.privacy.showOnlineStatus}
              />
              <div className="absolute -bottom-1 -right-1 bg-white p-1 rounded-full shadow-xs border border-[#EAE3F3]">
                <Sparkles className="w-4 h-4 text-[#9670E8]" />
              </div>
            </div>

            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
                  {profile.name}
                </h1>
                <Badge variant="purple" size="sm">Pro PlaySpacian</Badge>
                <span className="text-sm font-semibold text-[#756D82]">{profile.username}</span>
              </div>

              <p className="text-sm text-[#756D82] max-w-2xl leading-relaxed">
                {profile.bio}
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-[#756D82]">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#9670E8]" />
                  {profile.joinedDate}
                </span>
                <span className="flex items-center gap-1.5">
                  <Gamepad2 className="w-3.5 h-3.5 text-[#9670E8]" />
                  Favorite: {profile.favouriteGames.join(', ')}
                </span>
              </div>
            </div>

            <div className="shrink-0">
              <Button
                variant="outline"
                size="sm"
                leftIcon={<Edit3 className="w-4 h-4" />}
                onClick={() => {
                  soundService.playClick();
                  setNameInput(profile.name);
                  setBioInput(profile.bio);
                  setIsEditing(true);
                }}
              >
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {/* Career Statistics Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#756D82] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Matches</span>
              <Gamepad2 className="w-4 h-4 text-[#9670E8]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#211A2D]">{profile.totalMatches}</div>
            <span className="text-[11px] text-[#756D82] mt-1">Across all 11 games</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#756D82] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Victories</span>
              <Trophy className="w-4 h-4 text-[#F2A33A]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#248A62]">{profile.wins}</div>
            <span className="text-[11px] text-[#248A62] font-semibold mt-1">{profile.losses} Losses • {profile.draws} Draws</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#756D82] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Win Rate</span>
              <Percent className="w-4 h-4 text-[#9670E8]" />
            </div>
            <div className="text-2xl sm:text-3xl font-black text-[#593B91]">{winRate}%</div>
            <span className="text-[11px] text-[#756D82] mt-1">Competitive matches</span>
          </div>

          <div className="bg-white p-5 rounded-2xl border border-[#EAE3F3] shadow-xs flex flex-col justify-between">
            <div className="flex items-center justify-between text-[#756D82] mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Top Rival</span>
              <Swords className="w-4 h-4 text-[#EC4899]" />
            </div>
            <div className="text-xl sm:text-2xl font-black text-[#211A2D] truncate">Jordan T.</div>
            <span className="text-[11px] text-[#756D82] mt-1">18 Head-to-Head</span>
          </div>
        </div>

        {/* Detailed Tabs / Section split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Game-Specific Breakdown */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#EAE3F3] shadow-sm">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-black text-[#211A2D]">Game Mastery</h2>
                  <p className="text-xs text-[#756D82]">Sample local records across tested game modes</p>
                </div>
                <Badge variant="lavender" size="sm">4 Recorded</Badge>
              </div>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#E3D6FA] flex items-center justify-center text-[#593B91] font-black">
                      ⛳
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#211A2D]">Aloo Golf</h3>
                      <p className="text-xs text-[#756D82]">10 matches • 70% win rate</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#248A62] block">Best Score: -2</span>
                    <Badge variant="success" size="sm">Course Ace</Badge>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FDE68A] flex items-center justify-center text-[#92400E] font-black">
                      🃏
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#211A2D]">Original Card Game</h3>
                      <p className="text-xs text-[#756D82]">8 matches • 5 wins</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#593B91] block">62.5% WR</span>
                    <Badge variant="purple" size="sm">Card Shark</Badge>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#FECDD3] flex items-center justify-center text-[#9D174D] font-black">
                      🏀
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#211A2D]">Basketball Rivalry</h3>
                      <p className="text-xs text-[#756D82]">2 matches • Highscore: 32 pts</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#211A2D] block">Sharpshooter</span>
                    <Badge variant="pink" size="sm">Arcade</Badge>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#C6ECD9] flex items-center justify-center text-[#248A62] font-black">
                      ⭕
                    </div>
                    <div>
                      <h3 className="font-extrabold text-sm text-[#211A2D]">Tic Tac Toe</h3>
                      <p className="text-xs text-[#756D82]">4 matches • 2 wins • 1 draw</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#211A2D] block">Classic Duel</span>
                    <Badge variant="outline" size="sm">Strategist</Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Recent Highlights Feed */}
            <div className="bg-white p-6 rounded-3xl border border-[#EAE3F3] shadow-sm">
              <h2 className="text-lg font-black text-[#211A2D] mb-4">Recent Highlights</h2>
              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
                  <CheckCircle2 className="w-4 h-4 text-[#248A62] mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-[#211A2D]">Won Aloo Golf match</span> against Jordan Taylor (Score: -2).
                    <span className="block text-[11px] text-[#756D82] mt-0.5">Today at 2:15 PM</span>
                  </div>
                </div>
                <div className="flex items-start gap-3 p-3 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
                  <HeartHandshake className="w-4 h-4 text-[#9670E8] mt-0.5 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-[#211A2D]">Tied Blind Ranking with Jordan</span> on Top Vacation Destinations.
                    <span className="block text-[11px] text-[#756D82] mt-0.5">Oct 25, 2026</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Privacy & Account Settings Widget */}
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-3xl border border-[#EAE3F3] shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Lock className="w-4 h-4 text-[#9670E8]" />
                <h2 className="text-base font-black text-[#211A2D]">Privacy Preferences</h2>
              </div>
              <p className="text-xs text-[#756D82] mb-5">
                Control your visibility in lobbies and public search.
              </p>

              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
                  <div>
                    <span className="text-xs font-bold text-[#211A2D] block">Show Online Status</span>
                    <span className="text-[11px] text-[#756D82]">Let friends see when you are in game</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.privacy.showOnlineStatus}
                    onChange={() => handleTogglePrivacy('showOnlineStatus')}
                    className="w-4 h-4 accent-[#593B91] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
                  <div>
                    <span className="text-xs font-bold text-[#211A2D] block">Allow Direct Room Invites</span>
                    <span className="text-[11px] text-[#756D82]">Receive lobby popups from friends</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.privacy.allowDirectInvites}
                    onChange={() => handleTogglePrivacy('allowDirectInvites')}
                    className="w-4 h-4 accent-[#593B91] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between gap-3 p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
                  <div>
                    <span className="text-xs font-bold text-[#211A2D] block">Public Match History</span>
                    <span className="text-[11px] text-[#756D82]">Display recent game results on profile</span>
                  </div>
                  <input
                    type="checkbox"
                    checked={profile.privacy.publicMatchHistory}
                    onChange={() => handleTogglePrivacy('publicMatchHistory')}
                    className="w-4 h-4 accent-[#593B91] cursor-pointer"
                  />
                </div>
              </div>

              <div className="mt-5 p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] text-[11px] text-[#756D82]">
                <strong>Between Us Privacy Shield:</strong> Responses in BETWEEN US are never saved in profile history or localStorage.
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditing}
        onClose={() => setIsEditing(false)}
        title="Edit Local Profile"
        description="Update your display name and bio for this browser session."
      >
        <div className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Display Name</label>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE3F3] focus:border-[#9670E8] focus:ring-2 focus:ring-[#9670E8]/20 outline-none text-sm text-[#211A2D]"
              maxLength={30}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-[#211A2D] block mb-1">Bio / About</label>
            <textarea
              value={bioInput}
              onChange={(e) => setBioInput(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-[#EAE3F3] focus:border-[#9670E8] focus:ring-2 focus:ring-[#9670E8]/20 outline-none text-sm text-[#211A2D] resize-none h-24"
              maxLength={150}
            />
            <span className="text-[11px] text-[#756D82] text-right block mt-1">
              {bioInput.length} / 150 characters
            </span>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#EAE3F3]">
            <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" onClick={handleSaveProfile}>
              Save Profile
            </Button>
          </div>
        </div>
      </Modal>

      <Footer />
    </div>
  );
};
