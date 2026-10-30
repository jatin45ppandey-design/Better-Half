import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Gamepad2,
  Menu,
  X,
  LogOut,
  ChevronDown,
  User as UserIcon,
  PlusCircle,
  LogIn,
  Users,
  Mail,
  History,
  Swords,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { mockSocialAdapter } from '../../services/mockSocialAdapter';
import { soundService } from '../../services/soundService';

export const Navbar: React.FC = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);

  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, logout } = useAuth();
  const { addToast } = useToast();

  useEffect(() => {
    try {
      const invites = mockSocialAdapter.getInvitations();
      const pending = invites.filter((i) => i.status === 'pending').length;
      setPendingInvitesCount(pending);
    } catch {
      setPendingInvitesCount(0);
    }
  }, [location.pathname]);

  const isCurrent = (path: string) => location.pathname === path;

  const handleLogout = () => {
    soundService.playClick();
    logout();
    setProfileDropdownOpen(false);
    setMobileMenuOpen(false);
    addToast('Signed out of mock session', {
      type: 'info',
    });
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 w-full bg-white/95 backdrop-blur-md border-b border-[#EAE3F3] transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand Logo */}
        <Link
          to="/"
          onClick={() => soundService.playClick()}
          className="flex items-center gap-2.5 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9670E8] rounded-xl p-1"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#9670E8] to-[#593B91] flex items-center justify-center text-white shadow-sm shadow-[#593B91]/20 group-hover:scale-105 transition-transform">
            <Gamepad2 className="w-5 h-5" />
          </div>
          <div className="flex flex-col">
            <span className="font-extrabold text-lg tracking-tight text-[#211A2D]">
              Play<span className="text-[#9670E8]">Space</span>
            </span>
          </div>
        </Link>

        {/* Desktop Product Navigation Links */}
        <nav
          className="hidden lg:flex items-center gap-1 bg-[#F8F4FF] p-1 rounded-full border border-[#EAE3F3]"
          aria-label="Main Navigation"
        >
          <Link
            to="/"
            onClick={() => soundService.playClick()}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
              isCurrent('/')
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            Home
          </Link>
          <Link
            to="/dashboard"
            onClick={() => soundService.playClick()}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
              isCurrent('/dashboard')
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            Play & Rooms
          </Link>
          <Link
            to="/friends"
            onClick={() => soundService.playClick()}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
              isCurrent('/friends')
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            Friends
          </Link>
          <Link
            to="/invitations"
            onClick={() => soundService.playClick()}
            className={`relative px-3 py-1 text-xs font-bold rounded-full transition-colors flex items-center gap-1.5 ${
              isCurrent('/invitations')
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            <span>Invites</span>
            {pendingInvitesCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-[#EC4899] text-white text-[10px] font-black flex items-center justify-center">
                {pendingInvitesCount}
              </span>
            )}
          </Link>
          <Link
            to="/history"
            onClick={() => soundService.playClick()}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
              isCurrent('/history')
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            History
          </Link>
          <Link
            to="/rivalry"
            onClick={() => soundService.playClick()}
            className={`px-3 py-1 text-xs font-bold rounded-full transition-colors ${
              isCurrent('/rivalry')
                ? 'bg-white text-[#593B91] shadow-xs'
                : 'text-[#756D82] hover:text-[#211A2D]'
            }`}
          >
            Rivalry
          </Link>
        </nav>

        {/* Right Section: Profile / Settings / Auth state */}
        <div className="hidden md:flex items-center gap-2.5">
          {isAuthenticated && user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  soundService.playClick();
                  setProfileDropdownOpen(!profileDropdownOpen);
                }}
                className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-full hover:bg-[#F8F4FF] border border-transparent hover:border-[#EAE3F3] transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9670E8]"
              >
                <Avatar
                  name={user.name}
                  initials={user.avatarInitials}
                  size="sm"
                  bgColor={user.avatarColor}
                  isOnline
                />
                <span className="text-xs font-bold text-[#211A2D] max-w-[120px] truncate">
                  {user.name}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-[#756D82]" />
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-60 bg-white rounded-2xl shadow-xl shadow-[#593B91]/10 border border-[#EAE3F3] p-2.5 z-50 animate-in fade-in zoom-in-95 duration-150">
                  <div className="p-2.5 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] mb-2 text-xs">
                    <span className="font-extrabold text-[#211A2D] block truncate">{user.name}</span>
                    <span className="text-[11px] text-[#756D82] block truncate">{user.email}</span>
                  </div>

                  <div className="space-y-1">
                    <Link
                      to="/profile"
                      onClick={() => {
                        soundService.playClick();
                        setProfileDropdownOpen(false);
                      }}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-[#211A2D] hover:bg-[#F8F4FF] transition-colors"
                    >
                      <UserIcon className="w-4 h-4 text-[#9670E8]" />
                      My Player Profile
                    </Link>

                    <Link
                      to="/rivalry"
                      onClick={() => {
                        soundService.playClick();
                        setProfileDropdownOpen(false);
                      }}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-[#211A2D] hover:bg-[#F8F4FF] transition-colors"
                    >
                      <Swords className="w-4 h-4 text-[#EC4899]" />
                      Rivalry Arena
                    </Link>

                    <Link
                      to="/settings"
                      onClick={() => {
                        soundService.playClick();
                        setProfileDropdownOpen(false);
                      }}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-[#211A2D] hover:bg-[#F8F4FF] transition-colors"
                    >
                      <Settings className="w-4 h-4 text-[#756D82]" />
                      Settings & Sound
                    </Link>

                    <Link
                      to="/admin"
                      onClick={() => {
                        soundService.playClick();
                        setProfileDropdownOpen(false);
                      }}
                      className="flex items-center gap-2.5 p-2 rounded-xl text-xs font-bold text-[#D97706] hover:bg-[#FEF3C7]/40 transition-colors"
                    >
                      <ShieldAlert className="w-4 h-4 text-[#D97706]" />
                      Admin Preview
                    </Link>
                  </div>

                  <div className="pt-2 mt-2 border-t border-[#EAE3F3]">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 p-2 rounded-xl text-xs font-bold text-[#D94C65] hover:bg-[#FDF2F4] transition-colors cursor-pointer"
                    >
                      <LogOut className="w-4 h-4" />
                      Sign Out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link to="/login" onClick={() => soundService.playClick()}>
                <Button variant="ghost" size="sm" leftIcon={<LogIn className="w-4 h-4" />}>
                  Sign In
                </Button>
              </Link>
              <Link to="/signup" onClick={() => soundService.playClick()}>
                <Button variant="primary" size="sm" leftIcon={<PlusCircle className="w-4 h-4" />}>
                  Join / Play
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Hamburger Toggle */}
        <div className="flex lg:hidden items-center gap-2">
          {isAuthenticated && (
            <Link to="/dashboard" onClick={() => soundService.playClick()}>
              <Button variant="secondary" size="sm">
                Play
              </Button>
            </Link>
          )}
          <button
            type="button"
            onClick={() => {
              soundService.playClick();
              setMobileMenuOpen(!mobileMenuOpen);
            }}
            aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            className="p-2 rounded-xl text-[#593B91] hover:bg-[#F1EAFF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9670E8]"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Collapsible Navigation Menu */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-b border-[#EAE3F3] bg-white px-4 pt-3 pb-6 flex flex-col gap-2 shadow-lg animate-in slide-in-from-top-2 duration-150">
          <nav className="flex flex-col gap-1 text-sm font-bold text-[#211A2D]">
            <Link
              to="/"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors"
            >
              Home
            </Link>
            <Link
              to="/dashboard"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors"
            >
              Play & Rooms
            </Link>
            <Link
              to="/friends"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors flex items-center justify-between"
            >
              <span>Friends & Squad</span>
              <Users className="w-4 h-4 text-[#9670E8]" />
            </Link>
            <Link
              to="/invitations"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors flex items-center justify-between"
            >
              <span>Lobby Invitations</span>
              {pendingInvitesCount > 0 ? (
                <Badge variant="pink" size="sm">{pendingInvitesCount}</Badge>
              ) : (
                <Mail className="w-4 h-4 text-[#756D82]" />
              )}
            </Link>
            <Link
              to="/history"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors flex items-center justify-between"
            >
              <span>Match History</span>
              <History className="w-4 h-4 text-[#756D82]" />
            </Link>
            <Link
              to="/rivalry"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors flex items-center justify-between"
            >
              <span>Rivalry Arena</span>
              <Swords className="w-4 h-4 text-[#EC4899]" />
            </Link>
            <Link
              to="/profile"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors flex items-center justify-between"
            >
              <span>My Player Profile</span>
              <UserIcon className="w-4 h-4 text-[#9670E8]" />
            </Link>
            <Link
              to="/settings"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#F8F4FF] transition-colors flex items-center justify-between"
            >
              <span>Settings & Sound</span>
              <Settings className="w-4 h-4 text-[#756D82]" />
            </Link>
            <Link
              to="/admin"
              onClick={() => {
                soundService.playClick();
                setMobileMenuOpen(false);
              }}
              className="px-3.5 py-2.5 rounded-xl hover:bg-[#FEF3C7]/50 text-[#D97706] transition-colors flex items-center justify-between"
            >
              <span>Admin Preview</span>
              <ShieldAlert className="w-4 h-4 text-[#D97706]" />
            </Link>
          </nav>

          <div className="pt-3 border-t border-[#EAE3F3] flex flex-col gap-2">
            {isAuthenticated && user ? (
              <>
                <div className="flex items-center gap-2.5 px-3 py-2 bg-[#F8F4FF] rounded-xl text-xs">
                  <Avatar name={user.name} initials={user.avatarInitials} size="sm" bgColor={user.avatarColor} />
                  <div className="flex flex-col truncate">
                    <span className="font-bold text-[#211A2D]">{user.name}</span>
                    <span className="text-[#756D82] text-[11px] truncate">{user.email}</span>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-center text-[#D94C65] border-[#FCE7F3]"
                  onClick={handleLogout}
                  leftIcon={<LogOut className="w-4 h-4" />}
                >
                  Sign Out
                </Button>
              </>
            ) : (
              <div className="flex flex-col gap-2">
                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="ghost" size="sm" className="w-full justify-center">
                    Sign In
                  </Button>
                </Link>
                <Link to="/signup" onClick={() => setMobileMenuOpen(false)}>
                  <Button variant="primary" size="sm" className="w-full justify-center">
                    Join / Play
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
