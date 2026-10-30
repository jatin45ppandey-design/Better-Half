import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Heart,
  Users,
  LogOut,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

interface DashboardHeaderProps {
  activeMode: 'couple' | 'friend';
  onModeChange: (mode: 'couple' | 'friend') => void;
}

export const DashboardHeader: React.FC<DashboardHeaderProps> = ({
  activeMode,
  onModeChange,
}) => {
  const { user, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const navigate = useNavigate();
  const { addToast } = useToast();

  const handleLogout = () => {
    logout();
    addToast('Signed out of mock session', {
      type: 'info',
      message: 'You can sign back in anytime from the login page.',
    });
    navigate('/login');
  };

  const handleSwitchMode = (mode: 'couple' | 'friend') => {
    onModeChange(mode);
    setProfileDropdownOpen(false);
    addToast(`Switched to ${mode === 'couple' ? 'Couple Mode' : 'Friend Mode'}`, {
      type: 'success',
    });
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#EAE3F3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-18 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9670E8] rounded-xl p-1"
          >
            <div className="w-9 h-9 rounded-xl bg-[#593B91] flex items-center justify-center text-white shadow-xs">
              <Gamepad2 className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-lg tracking-tight text-[#211A2D]">
                Play<span className="text-[#9670E8]">Space</span>
              </span>
              <span className="text-[9px] font-semibold tracking-wider text-[#756D82] uppercase -mt-1">
                Dashboard
              </span>
            </div>
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-[#EAE3F3]">
            <Link
              to="/"
              className="px-3 py-1.5 text-xs font-semibold text-[#756D82] hover:text-[#593B91] rounded-lg transition-colors flex items-center gap-1"
            >
              Landing Page
              <ExternalLink className="w-3 h-3 text-[#9D96A8]" />
            </Link>
            <a
              href="#game-library"
              className="px-3 py-1.5 text-xs font-semibold text-[#756D82] hover:text-[#593B91] rounded-lg transition-colors"
            >
              11 Games
            </a>
          </nav>
        </div>

        {/* Center: Active Mode Pill */}
        <div className="hidden sm:flex items-center gap-1.5 bg-[#F8F4FF] p-1 rounded-full border border-[#EAE3F3]">
          <button
            type="button"
            onClick={() => handleSwitchMode('couple')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeMode === 'couple'
                ? 'bg-[#FDF2F8] text-[#9D174D] border border-[#FCE7F3] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            <Heart className="w-3.5 h-3.5 fill-current" />
            Couple (2P)
          </button>
          <button
            type="button"
            onClick={() => handleSwitchMode('friend')}
            className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-full transition-all cursor-pointer ${
              activeMode === 'friend'
                ? 'bg-[#F1EAFF] text-[#593B91] border border-[#E2D5F8] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Friends (Up to 4P)
          </button>
        </div>

        {/* Right: User Profile & Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2 p-1.5 pr-2.5 rounded-full hover:bg-[#F8F4FF] border border-transparent hover:border-[#EAE3F3] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9670E8]"
          >
            <Avatar
              name={user?.name || 'Player'}
              initials={user?.avatarInitials || 'PL'}
              size="sm"
              bgColor={user?.avatarColor || 'bg-[#9670E8]'}
              isOnline
            />
            <div className="hidden sm:flex flex-col text-left">
              <span className="text-xs font-bold text-[#211A2D] leading-tight">
                {user?.name || 'Guest Player'}
              </span>
              <span className="text-[10px] text-[#756D82]">
                {activeMode === 'couple' ? 'Couple Mode' : 'Friend Mode'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-[#756D82]" />
          </button>

          {/* Profile Dropdown Menu */}
          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-xl shadow-[#593B91]/10 border border-[#EAE3F3] p-3 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="p-2.5 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] mb-2">
                <p className="text-xs font-bold text-[#211A2D]">{user?.name || 'Player'}</p>
                <p className="text-[11px] text-[#756D82] truncate">{user?.email || 'player@playspace.local'}</p>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <Badge variant="warning" size="sm">
                    Dev Mock Session
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col gap-1 py-1 text-xs">
                <button
                  type="button"
                  onClick={() => handleSwitchMode('couple')}
                  className={`flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activeMode === 'couple' ? 'bg-[#FDF2F8] text-[#9D174D] font-bold' : 'text-[#756D82] hover:bg-[#F8F4FF]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    Couple Mode (2P)
                  </span>
                  {activeMode === 'couple' && <span className="text-[10px]">Active</span>}
                </button>

                <button
                  type="button"
                  onClick={() => handleSwitchMode('friend')}
                  className={`flex items-center justify-between p-2 rounded-xl text-left transition-colors cursor-pointer ${
                    activeMode === 'friend' ? 'bg-[#F1EAFF] text-[#593B91] font-bold' : 'text-[#756D82] hover:bg-[#F8F4FF]'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Users className="w-3.5 h-3.5" />
                    Friend Mode (4P)
                  </span>
                  {activeMode === 'friend' && <span className="text-[10px]">Active</span>}
                </button>
              </div>

              <div className="pt-2 mt-1 border-t border-[#EAE3F3] flex flex-col gap-1">
                <Link
                  to="/profile"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#211A2D] font-bold hover:bg-[#F8F4FF] transition-colors"
                >
                  My Player Profile
                </Link>

                <Link
                  to="/friends"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#756D82] hover:bg-[#F8F4FF] hover:text-[#211A2D] transition-colors"
                >
                  Friends & Squad
                </Link>

                <Link
                  to="/invitations"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#756D82] hover:bg-[#F8F4FF] hover:text-[#211A2D] transition-colors"
                >
                  Lobby Invitations
                </Link>

                <Link
                  to="/history"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#756D82] hover:bg-[#F8F4FF] hover:text-[#211A2D] transition-colors"
                >
                  Match History
                </Link>

                <Link
                  to="/rivalry"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#756D82] hover:bg-[#F8F4FF] hover:text-[#211A2D] transition-colors"
                >
                  Rivalry Arena
                </Link>

                <Link
                  to="/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#756D82] hover:bg-[#F8F4FF] hover:text-[#211A2D] transition-colors"
                >
                  Settings & Audio
                </Link>

                <Link
                  to="/admin"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#D97706] hover:bg-[#FEF3C7]/40 font-semibold transition-colors"
                >
                  Admin Preview
                </Link>

                <Link
                  to="/"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#756D82] hover:bg-[#F8F4FF] hover:text-[#211A2D] transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  View Landing Page
                </Link>

                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex items-center gap-2 p-2 rounded-xl text-xs text-[#D94C65] hover:bg-[#FDF2F4] transition-colors cursor-pointer font-bold"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
