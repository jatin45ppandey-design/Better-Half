import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  LogOut,
  ChevronDown,
  User as UserIcon,
  PlusCircle,
    Users,
  Mail,
  History,
  Swords,
  Settings,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { BetterHalfLogo } from '../ui/BetterHalfLogo';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { api } from '../../services/api';
import { soundService } from '../../services/soundService';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [canAccessAdmin, setCanAccessAdmin] = useState(false);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { addToast } = useToast();

  const isLandingPage = location.pathname === '/';

  useEffect(() => {
    let active = true;
    if (!isAuthenticated || !user) {
      setPendingInvitesCount(0);
      return () => { active = false; };
    }

    void api.roomInvitations.getReceived()
      .then((response) => {
        if (active) setPendingInvitesCount(response.invitations.length);
      })
      .catch(() => {
        if (active) setPendingInvitesCount(0);
      });

    return () => { active = false; };
  }, [location.pathname, isAuthenticated, user?.id]);

  useEffect(() => {
    let active = true;
    setCanAccessAdmin(false);
    if (!isAuthenticated || !user) {
      return () => { active = false; };
    }

    void api.admin.getOverview()
      .then((response) => {
        if (active) setCanAccessAdmin(response.success === true);
      })
      .catch(() => {
        if (active) setCanAccessAdmin(false);
      });

    return () => { active = false; };
  }, [isAuthenticated, user?.id]);

  const isCurrent = (path: string) => location.pathname === path;

  const handleLogout = async () => {
    soundService.playClick();
    await logout();
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    addToast('Signed out of Better-Half.', { type: 'info' });
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-[#FAF6FD]/90 backdrop-blur-md border-b border-[#E8DEF8] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to={isAuthenticated ? '/dashboard' : '/'}
          onClick={() => soundService.playClick()}
          className="flex items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] rounded-xl p-1"
        >
          <BetterHalfLogo size="md" variant="light" />
        </Link>

        {/* Desktop Navigation for Authenticated Users */}
        {isAuthenticated && !isLandingPage && (
          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/dashboard"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors ${
                isCurrent('/dashboard')
                  ? 'bg-[#F3ECFB] text-[#7C3AED]'
                  : 'text-[#6B5E82] hover:text-[#1E1035] hover:bg-[#F3ECFB]/60'
              }`}
            >
              Games
            </Link>
            <Link
              to="/friends"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                isCurrent('/friends')
                  ? 'bg-[#F3ECFB] text-[#7C3AED]'
                  : 'text-[#6B5E82] hover:text-[#1E1035] hover:bg-[#F3ECFB]/60'
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
                  ? 'bg-[#F3ECFB] text-[#7C3AED]'
                  : 'text-[#6B5E82] hover:text-[#1E1035] hover:bg-[#F3ECFB]/60'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              Invites
              {pendingInvitesCount > 0 && (
                <span className="w-4 h-4 rounded-full bg-[#7C3AED] text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingInvitesCount}
                </span>
              )}
            </Link>
            <Link
              to="/history"
              onClick={() => soundService.playClick()}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-colors flex items-center gap-1.5 ${
                isCurrent('/history')
                  ? 'bg-[#F3ECFB] text-[#7C3AED]'
                  : 'text-[#6B5E82] hover:text-[#1E1035] hover:bg-[#F3ECFB]/60'
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
                  ? 'bg-[#F3ECFB] text-[#7C3AED]'
                  : 'text-[#6B5E82] hover:text-[#1E1035] hover:bg-[#F3ECFB]/60'
              }`}
            >
              <Swords className="w-3.5 h-3.5" />
              Rivalry
            </Link>
          </nav>
        )}

        {/* Right CTA / Account controls */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <>
              {!isLandingPage && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    soundService.playClick();
                    setCreateModalOpen(true);
                  }}
                  leftIcon={<PlusCircle className="w-4 h-4" />}
                  className="hidden sm:inline-flex rounded-full text-xs font-bold"
                >
                  Create Room
                </Button>
              )}

              {isLandingPage && (
                <Link to="/dashboard">
                  <Button
                    variant="primary"
                    size="sm"
                    className="rounded-full text-xs font-bold"
                  >
                    Open Dashboard
                  </Button>
                </Link>
              )}

              {/* Profile Dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                  className="flex items-center gap-2 p-1.5 rounded-full hover:bg-[#F3ECFB] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6]"
                  aria-expanded={profileDropdownOpen}
                >
                  <Avatar name={user?.name || user?.username || 'Player'} initials={user?.avatarInitials} bgColor={user?.avatarColor} size="sm" />
                  <ChevronDown className="w-3.5 h-3.5 text-[#6B5E82]" />
                </button>

                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-56 rounded-2xl bg-white border border-[#E8DEF8] shadow-xl py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-4 py-2.5 border-b border-[#F2EBF9]">
                      <p className="text-xs font-bold text-[#1E1035] truncate">
                        {user?.name || user?.username || 'Player'}
                      </p>
                      <p className="text-[11px] text-[#6B5E82] truncate">
                        @{user?.username || 'player'}
                      </p>
                    </div>

                    <div className="py-1">
                      <Link
                        to="/dashboard"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="w-full px-4 py-2 text-xs font-semibold text-[#1E1035] hover:bg-[#F3ECFB] flex items-center gap-2"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-[#7C3AED]" />
                        Game Hub
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="w-full px-4 py-2 text-xs font-semibold text-[#1E1035] hover:bg-[#F3ECFB] flex items-center gap-2"
                      >
                        <UserIcon className="w-3.5 h-3.5 text-[#6B5E82]" />
                        My Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setProfileDropdownOpen(false)}
                        className="w-full px-4 py-2 text-xs font-semibold text-[#1E1035] hover:bg-[#F3ECFB] flex items-center gap-2"
                      >
                        <Settings className="w-3.5 h-3.5 text-[#6B5E82]" />
                        Preferences
                      </Link>
                      {canAccessAdmin && (
                        <Link
                          to="/admin"
                          onClick={() => setProfileDropdownOpen(false)}
                          className="w-full px-4 py-2 text-xs font-semibold text-[#7C3AED] hover:bg-[#F3ECFB] flex items-center gap-2"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-[#7C3AED]" />
                          Admin Console
                        </Link>
                      )}
                    </div>

                    <div className="pt-1 border-t border-[#F2EBF9]">
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="w-full px-4 py-2 text-xs font-semibold text-[#DC2626] hover:bg-[#FEF2F2] flex items-center gap-2 text-left cursor-pointer"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 sm:gap-3">
              <Link
                to="/login"
                className="px-3.5 py-1.5 text-xs font-bold text-[#581C87] hover:text-[#7C3AED] transition-colors"
              >
                Sign In
              </Link>
              <Link to="/signup">
                <Button
                  variant="primary"
                  size="sm"
                  className="rounded-full text-xs font-bold shadow-md shadow-purple-900/15"
                >
                  Get Started
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile hamburger menu toggle for authenticated routes */}
          {isAuthenticated && (
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-xl text-[#6B5E82] hover:bg-[#F3ECFB] focus-visible:outline-none"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          )}
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && isAuthenticated && (
        <div className="md:hidden border-t border-[#E8DEF8] bg-white px-4 pt-3 pb-6 flex flex-col gap-2">
          <Link
            to="/dashboard"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-sm font-semibold text-[#1E1035] rounded-xl hover:bg-[#F3ECFB]"
          >
            Games Hub
          </Link>
          <Link
            to="/friends"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-sm font-semibold text-[#1E1035] rounded-xl hover:bg-[#F3ECFB] flex items-center justify-between"
          >
            <span>Friends</span>
            <Users className="w-4 h-4 text-[#6B5E82]" />
          </Link>
          <Link
            to="/invitations"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-sm font-semibold text-[#1E1035] rounded-xl hover:bg-[#F3ECFB] flex items-center justify-between"
          >
            <span>Invitations</span>
            {pendingInvitesCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-[#7C3AED] text-white text-xs font-bold">
                {pendingInvitesCount}
              </span>
            )}
          </Link>
          <Link
            to="/history"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-sm font-semibold text-[#1E1035] rounded-xl hover:bg-[#F3ECFB]"
          >
            Match History
          </Link>
          <Link
            to="/rivalry"
            onClick={() => setMobileMenuOpen(false)}
            className="px-3 py-2 text-sm font-semibold text-[#1E1035] rounded-xl hover:bg-[#F3ECFB]"
          >
            Rivalry Arena
          </Link>
          <div className="pt-2 border-t border-[#F2EBF9] flex flex-col gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setMobileMenuOpen(false);
                setCreateModalOpen(true);
              }}
              leftIcon={<PlusCircle className="w-4 h-4" />}
              className="w-full justify-center"
            >
              Create Room
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              leftIcon={<LogOut className="w-4 h-4 text-[#DC2626]" />}
              className="w-full justify-center text-[#DC2626]"
            >
              Sign Out
            </Button>
          </div>
        </div>
      )}

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
    </header>
  );
};
