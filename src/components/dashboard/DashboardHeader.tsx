import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Users,
  Mail,
  History,
  Swords,
  Settings,
  ShieldAlert,
  LogOut,
  ChevronDown,
  User as UserIcon,
  Sparkles,
} from 'lucide-react';
import { Avatar } from '../ui/Avatar';
import { BetterHalfLogo } from '../ui/BetterHalfLogo';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { soundService } from '../../services/soundService';

export const DashboardHeader: React.FC = () => {
  const { user, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();
  const { addToast } = useToast();

  useEffect(() => {
    let active = true;
    setCanAccessAdmin(false);
    if (!user) return () => { active = false; };

    void api.admin.getOverview()
      .then((response) => {
        if (active) setCanAccessAdmin(response.success === true);
      })
      .catch(() => {
        if (active) setCanAccessAdmin(false);
      });

    void api.roomInvitations.getReceived()
      .then((response) => {
        if (active) setPendingInvitesCount(response.invitations.length);
      })
      .catch(() => {
        if (active) setPendingInvitesCount(0);
      });

    return () => { active = false; };
  }, [user?.id, location.pathname]);

  const isCurrent = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    soundService.playClick();
    await logout();
    setProfileDropdownOpen(false);
    addToast('Signed out of Better-Half.', { type: 'info' });
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#130B24]/95 backdrop-blur-md border-b border-[#2C1A48] text-white transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <div className="flex items-center gap-6">
          <Link
            to="/dashboard"
            onClick={() => soundService.playClick()}
            className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded-xl p-1"
          >
            <BetterHalfLogo size="md" variant="dark" />
          </Link>

          {/* Quick Nav Links */}
          <nav className="hidden md:flex items-center gap-1 pl-4 border-l border-[#2C1A48]">
            <Link
              to="/dashboard"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                isCurrent('/dashboard')
                  ? 'bg-[#29174A] text-[#C084FC]'
                  : 'text-[#A79BBF] hover:text-white hover:bg-[#201239]'
              }`}
            >
              Games
            </Link>
            <Link
              to="/friends"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                isCurrent('/friends')
                  ? 'bg-[#29174A] text-[#C084FC]'
                  : 'text-[#A79BBF] hover:text-white hover:bg-[#201239]'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              Friends
            </Link>
            <Link
              to="/invitations"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                isCurrent('/invitations')
                  ? 'bg-[#29174A] text-[#C084FC]'
                  : 'text-[#A79BBF] hover:text-white hover:bg-[#201239]'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Invites
              {pendingInvitesCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#9333EA] text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingInvitesCount}
                </span>
              )}
            </Link>
            <Link
              to="/history"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                isCurrent('/history')
                  ? 'bg-[#29174A] text-[#C084FC]'
                  : 'text-[#A79BBF] hover:text-white hover:bg-[#201239]'
              }`}
            >
              <History className="w-3.5 h-3.5" />
              History
            </Link>
            <Link
              to="/rivalry"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                isCurrent('/rivalry')
                  ? 'bg-[#29174A] text-[#C084FC]'
                  : 'text-[#A79BBF] hover:text-white hover:bg-[#201239]'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              Rivalry
            </Link>
          </nav>
        </div>

        {/* Right User Avatar & Profile Dropdown */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-full hover:bg-[#23143D] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] cursor-pointer"
            aria-expanded={profileDropdownOpen}
          >
            <Avatar name={user?.name || user?.username || 'Player'} initials={user?.avatarInitials} bgColor={user?.avatarColor} size="sm" />
            <span className="hidden sm:inline text-xs font-bold text-[#E9D5FF] max-w-[120px] truncate">
              {user?.name || user?.username || 'Player'}
            </span>
            <ChevronDown className="w-3.5 h-3.5 text-[#A79BBF]" />
          </button>

          {profileDropdownOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-[#1B1130] border border-[#3A245C] shadow-2xl py-2 z-50 text-white animate-in fade-in slide-in-from-top-2 duration-150">
              <div className="px-4 py-2.5 border-b border-[#2C1A48]">
                <p className="text-xs font-bold text-white truncate">
                  {user?.name || user?.username || 'Player'}
                </p>
                <p className="text-[11px] text-[#A79BBF] truncate">
                  @{user?.username || 'player'}
                </p>
              </div>

              <div className="py-1">
                <Link
                  to="/dashboard"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full px-4 py-2 text-xs font-semibold text-[#E9D5FF] hover:bg-[#261543] flex items-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#C084FC]" />
                  Game Hub
                </Link>
                <Link
                  to="/profile"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full px-4 py-2 text-xs font-semibold text-[#E9D5FF] hover:bg-[#261543] flex items-center gap-2"
                >
                  <UserIcon className="w-3.5 h-3.5 text-[#A79BBF]" />
                  My Profile
                </Link>
                <Link
                  to="/settings"
                  onClick={() => setProfileDropdownOpen(false)}
                  className="w-full px-4 py-2 text-xs font-semibold text-[#E9D5FF] hover:bg-[#261543] flex items-center gap-2"
                >
                  <Settings className="w-3.5 h-3.5 text-[#A79BBF]" />
                  Preferences
                </Link>
                {canAccessAdmin && (
                  <Link
                    to="/admin"
                    onClick={() => setProfileDropdownOpen(false)}
                    className="w-full px-4 py-2 text-xs font-semibold text-[#C084FC] hover:bg-[#261543] flex items-center gap-2"
                  >
                    <ShieldAlert className="w-3.5 h-3.5 text-[#C084FC]" />
                    Admin Console
                  </Link>
                )}
              </div>

              <div className="pt-1 border-t border-[#2C1A48]">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full px-4 py-2 text-xs font-semibold text-[#F87171] hover:bg-[#341825] flex items-center gap-2 text-left cursor-pointer"
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
