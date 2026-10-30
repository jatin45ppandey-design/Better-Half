import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { mockSocialAdapter } from '../services/mockSocialAdapter';
import type { RoomInvitationItem } from '../services/mockSocialAdapter';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import { api } from '../services/api';
import {
  Mail,
  Gamepad2,
  Check,
  X,
  Info,
  Clock,
  Sparkles,
  ArrowRight,
} from 'lucide-react';

export const InvitationsPage: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<RoomInvitationItem[]>(
    mockSocialAdapter.getInvitations()
  );
  const [filter, setFilter] = useState<'pending' | 'expired'>('pending');

  const { joinRoom } = useRoom();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Load real backend invitations if user is authenticated
  useEffect(() => {
    if (!user) return;
    api.roomInvitations
      .getReceived()
      .then((res) => {
        if (res?.invitations && res.invitations.length > 0) {
          const mapped: RoomInvitationItem[] = res.invitations.map((inv: any) => ({
            id: inv.id,
            fromUserId: inv.sender.id,
            fromName: inv.sender.displayName || inv.sender.username,
            fromAvatarInitials: inv.sender.avatarInitials || (inv.sender.displayName ? inv.sender.displayName.substring(0, 2).toUpperCase() : 'IN'),
            fromAvatarColor: inv.sender.avatarColor || 'bg-[#9670E8]',
            roomCode: inv.room.code,
            roomMode: inv.room.mode.toLowerCase() as 'couple' | 'friend',
            suggestedGameId: 'uno-style',
            suggestedGameName: inv.room.name || 'Room Lobby',
            timestamp: new Date(inv.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            status: (inv.status === 'PENDING' ? 'pending' : inv.status === 'DECLINED' ? 'declined' : 'expired') as 'pending' | 'expired' | 'declined',
            isDemoInvitation: false,
          }));

          setInvitations((prev) => {
            // Keep simulated invites plus real invites
            const realIds = new Set(mapped.map((m) => m.id));
            const filteredSimulated = prev.filter((p) => !realIds.has(p.id));
            return [...mapped, ...filteredSimulated];
          });
        }
      })
      .catch((err) => {
        console.warn('Could not fetch real invitations from server:', err);
      });
  }, [user]);

  const displayedInvitations = invitations.filter((inv) =>
    filter === 'pending' ? inv.status === 'pending' : inv.status !== 'pending'
  );

  const handleAcceptInvite = async (inv: RoomInvitationItem) => {
    soundService.playSuccess();
    const res = await joinRoom(inv.roomCode);
    if (res.success) {
      addToast(`Joined room #${inv.roomCode} hosted by ${inv.fromName}`, {
        type: 'success',
      });
      navigate(`/room/${inv.roomCode}`);
    } else {
      addToast(`Room #${inv.roomCode}: ${res.error || 'Could not join'}`, { type: 'error' });
    }
  };

  const handleDeclineInvite = (inv: RoomInvitationItem) => {
    soundService.playClick();
    mockSocialAdapter.declineInvitation(inv.id);
    setInvitations(mockSocialAdapter.getInvitations());
    addToast(`Declined invite from ${inv.fromName}`, { type: 'info' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Sample Disclaimer Banner */}
        <div className="mb-6 p-3.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-center justify-between gap-3 text-xs text-[#756D82]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Simulated Demo Invites:</strong> Invitations are simulated local room invites to test seamless lobby joining. No real remote invitations were sent.
            </span>
          </div>
          <Badge variant="subtle" size="sm">Local Demo</Badge>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
                Lobby Invitations
              </h1>
            </div>
            <p className="text-sm text-[#756D82]">
              Accept game invitations from friends to join their active local lobby.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-1 bg-[#F8F4FF] p-1 rounded-2xl border border-[#EAE3F3]">
            <button
              onClick={() => {
                soundService.playClick();
                setFilter('pending');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filter === 'pending'
                  ? 'bg-white text-[#593B91] shadow-xs'
                  : 'text-[#756D82] hover:text-[#211A2D]'
              }`}
            >
              Active ({invitations.filter((i) => i.status === 'pending').length})
            </button>
            <button
              onClick={() => {
                soundService.playClick();
                setFilter('expired');
              }}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-xl transition-all cursor-pointer ${
                filter === 'expired'
                  ? 'bg-white text-[#593B91] shadow-xs'
                  : 'text-[#756D82] hover:text-[#211A2D]'
              }`}
            >
              Expired / Declined
            </button>
          </div>
        </div>

        {/* Invitations List */}
        {displayedInvitations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-12 text-center shadow-xs">
            <Mail className="w-12 h-12 text-[#D5C7EE] mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#211A2D]">No invitations here</h3>
            <p className="text-xs text-[#756D82] mt-1 max-w-sm mx-auto">
              {filter === 'pending'
                ? 'You have responded to all active invites. Check back later or create your own room!'
                : 'No expired or declined invitations.'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {displayedInvitations.map((inv) => {
              const isCouple = inv.roomMode === 'couple';

              return (
                <div
                  key={inv.id}
                  className={`bg-white rounded-3xl border p-5 sm:p-6 shadow-xs transition-all ${
                    inv.status === 'pending'
                      ? 'border-[#EAE3F3] hover:border-[#D5C7EE]'
                      : 'border-[#F0ECF5] opacity-75'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <Avatar
                        name={inv.fromName}
                        initials={inv.fromAvatarInitials}
                        size="lg"
                        bgColor={inv.fromAvatarColor}
                      />

                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-base text-[#211A2D]">
                            {inv.fromName}
                          </span>
                          <span className="text-xs text-[#756D82]">invited you to play</span>
                          <Badge
                            variant={isCouple ? 'pink' : 'purple'}
                            size="sm"
                          >
                            {isCouple ? 'Couple Mode (2P)' : 'Friend Mode (4P)'}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#756D82] pt-0.5">
                          <span className="font-mono font-bold text-[#593B91] bg-[#F1EAFF] px-2 py-0.5 rounded-lg border border-[#E3D6FA]">
                            #{inv.roomCode}
                          </span>
                          <span className="flex items-center gap-1">
                            <Gamepad2 className="w-3.5 h-3.5 text-[#9670E8]" />
                            Suggested: <strong>{inv.suggestedGameName}</strong>
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5" />
                            {inv.timestamp}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end sm:self-auto pt-2 sm:pt-0">
                      {inv.status === 'pending' ? (
                        <>
                          <Button
                            variant="primary"
                            size="sm"
                            leftIcon={<Check className="w-4 h-4" />}
                            onClick={() => handleAcceptInvite(inv)}
                          >
                            Accept & Join
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-[#756D82] border-[#EAE3F3] hover:text-[#D94C65]"
                            leftIcon={<X className="w-4 h-4" />}
                            onClick={() => handleDeclineInvite(inv)}
                          >
                            Decline
                          </Button>
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="subtle" size="md">
                            {inv.status === 'declined' ? 'Declined' : 'Expired'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleAcceptInvite(inv)}
                          >
                            Try Join
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Quick Launch CTA */}
        <div className="mt-8 p-6 rounded-3xl bg-gradient-to-br from-[#593B91] to-[#40266B] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-[#593B91]/20">
          <div>
            <div className="flex items-center gap-2 font-extrabold text-base mb-1">
              <Sparkles className="w-5 h-5 text-[#F2A33A]" />
              Want to start your own match?
            </div>
            <p className="text-xs text-[#E3D6FA] max-w-lg">
              Create a custom room lobby in seconds and share your 5-letter room code with your friends or partner.
            </p>
          </div>
          <Button
            variant="outline"
            size="md"
            className="bg-white text-[#593B91] border-none hover:bg-[#F8F4FF] shrink-0 font-bold"
            rightIcon={<ArrowRight className="w-4 h-4" />}
            onClick={() => {
              soundService.playClick();
              navigate('/dashboard');
            }}
          >
            Create Room
          </Button>
        </div>
      </main>

      <Footer />
    </div>
  );
};
