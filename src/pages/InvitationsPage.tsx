
import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import { api } from '../services/api';
import { Mail, Gamepad2, Check, X, Clock, ArrowRight, RefreshCw } from 'lucide-react';

interface RoomInvitationItem {
  id: string;
  fromName: string;
  fromAvatarInitials: string;
  fromAvatarColor: string;
  roomCode: string;
  roomMode: 'couple' | 'friend';
  roomName: string;
  timestamp: string;
}

export const InvitationsPage: React.FC = () => {
  const { user } = useAuth();
  const [invitations, setInvitations] = useState<RoomInvitationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyInvitationId, setBusyInvitationId] = useState<string | null>(null);
  const { addToast } = useToast();
  const navigate = useNavigate();

  const loadInvitations = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await api.roomInvitations.getReceived();
      setInvitations(response.invitations.map((inv: any) => ({
        id: inv.id,
        fromName: inv.sender.displayName || inv.sender.username,
        fromAvatarInitials: inv.sender.avatarInitials || 'PL',
        fromAvatarColor: inv.sender.avatarColor || '#9670E8',
        roomCode: inv.room.code,
        roomMode: inv.room.mode.toLowerCase() as 'couple' | 'friend',
        roomName: inv.room.name,
        timestamp: new Date(inv.createdAt).toLocaleString(),
      })));
    } catch (err) {
      setInvitations([]);
      setError(err instanceof Error ? err.message : 'Invitations could not be loaded.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void loadInvitations();
  }, [user, loadInvitations]);

  const handleAcceptInvite = async (invitation: RoomInvitationItem) => {
    soundService.playSuccess();
    setBusyInvitationId(invitation.id);
    try {
      await api.roomInvitations.accept(invitation.id);
      addToast(`Joined room #${invitation.roomCode}.`, { type: 'success' });
      navigate(`/room/${invitation.roomCode}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not accept this invitation.', { type: 'error' });
    } finally {
      setBusyInvitationId(null);
    }
  };

  const handleDeclineInvite = async (invitation: RoomInvitationItem) => {
    soundService.playClick();
    setBusyInvitationId(invitation.id);
    try {
      await api.roomInvitations.decline(invitation.id);
      addToast(`Declined invitation from ${invitation.fromName}.`, { type: 'info' });
      await loadInvitations();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not decline this invitation.', { type: 'error' });
    } finally {
      setBusyInvitationId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Mail className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">Lobby Invitations</h1>
              <Badge variant="subtle" size="sm">{invitations.length} Pending</Badge>
            </div>
            <p className="text-sm text-[#756D82]">Invitations to rooms that are still available to join.</p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadInvitations()} disabled={isLoading} leftIcon={<RefreshCw className="w-3.5 h-3.5" />}>Refresh</Button>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-[#EAE3F3] bg-white p-10 text-center text-sm text-[#756D82]">Loading invitations…</div>
        ) : error ? (
          <div className="rounded-3xl border border-[#F8D2D9] bg-white p-10 text-center">
            <p className="text-sm text-[#A52E45]">{error}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadInvitations()}>Try again</Button>
          </div>
        ) : invitations.length === 0 ? (
          <div className="bg-white rounded-3xl border border-[#EAE3F3] p-12 text-center shadow-xs">
            <Mail className="w-12 h-12 text-[#D5C7EE] mx-auto mb-3" />
            <h3 className="font-extrabold text-base text-[#211A2D]">No pending invitations</h3>
            <p className="text-xs text-[#756D82] mt-1 max-w-sm mx-auto">New room invitations from your friends will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {invitations.map((invitation) => {
              const isCouple = invitation.roomMode === 'couple';
              const isBusy = busyInvitationId === invitation.id;
              return (
                <article key={invitation.id} className="bg-white rounded-3xl border border-[#EAE3F3] p-5 sm:p-6 shadow-xs">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4 min-w-0">
                      <Avatar name={invitation.fromName} initials={invitation.fromAvatarInitials} size="lg" bgColor={invitation.fromAvatarColor} />
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-base text-[#211A2D]">{invitation.fromName}</span>
                          <span className="text-xs text-[#756D82]">invited you to play</span>
                          <Badge variant={isCouple ? 'pink' : 'purple'} size="sm">{isCouple ? 'Couple Mode · 2 players' : 'Friend Mode · 2–4 players'}</Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-[#756D82] pt-0.5">
                          <span className="font-mono font-bold text-[#593B91] bg-[#F1EAFF] px-2 py-0.5 rounded-lg border border-[#E3D6FA]">#{invitation.roomCode}</span>
                          <span className="flex items-center gap-1"><Gamepad2 className="w-3.5 h-3.5 text-[#9670E8]" />{invitation.roomName}</span>
                          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{invitation.timestamp}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button variant="primary" size="sm" isLoading={isBusy} disabled={busyInvitationId !== null} leftIcon={<Check className="w-4 h-4" />} onClick={() => void handleAcceptInvite(invitation)}>Accept & Join</Button>
                      <Button variant="outline" size="sm" disabled={busyInvitationId !== null} className="text-[#756D82] border-[#EAE3F3] hover:text-[#D94C65]" leftIcon={<X className="w-4 h-4" />} onClick={() => void handleDeclineInvite(invitation)}>Decline</Button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <div className="mt-8 p-6 rounded-3xl bg-gradient-to-br from-[#593B91] to-[#40266B] text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg shadow-[#593B91]/20">
          <div>
            <div className="font-extrabold text-base mb-1">Want to start your own match?</div>
            <p className="text-xs text-[#E3D6FA] max-w-lg">Create a room and share its 6-character code with your friends or partner.</p>
          </div>
          <Button variant="outline" size="md" className="bg-white text-[#593B91] border-none hover:bg-[#F8F4FF] shrink-0 font-bold" rightIcon={<ArrowRight className="w-4 h-4" />} onClick={() => navigate('/dashboard')}>Create Room</Button>
        </div>
      </main>
      <Footer />
    </div>
  );
};
