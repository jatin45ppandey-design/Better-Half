import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { mockSocialAdapter } from '../services/mockSocialAdapter';
import type {
  FriendItem,
  FriendRequestItem,
} from '../services/mockSocialAdapter';
import { useRoom } from '../context/RoomContext';
import { useToast } from '../context/ToastContext';
import { soundService } from '../services/soundService';
import {
  Users,
  UserPlus,
  Search,
  Gamepad2,
  Trash2,
  Ban,
  Send,
  Check,
  X,
  Info,
  Sparkles,
  Heart,
} from 'lucide-react';

export const FriendsPage: React.FC = () => {
  const [friends, setFriends] = useState<FriendItem[]>(mockSocialAdapter.getFriends());
  const [requests, setRequests] = useState<FriendRequestItem[]>(mockSocialAdapter.getFriendRequests());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<FriendItem | null>(null);

  const { createRoom, currentRoom } = useRoom();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const filteredFriends = friends.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAcceptRequest = (req: FriendRequestItem) => {
    soundService.playSuccess();
    mockSocialAdapter.acceptFriendRequest(req.id);
    setRequests(mockSocialAdapter.getFriendRequests());
    setFriends(mockSocialAdapter.getFriends());
    addToast(`Connected with ${req.name}`, { type: 'success' });
  };

  const handleRejectRequest = (req: FriendRequestItem) => {
    soundService.playClick();
    mockSocialAdapter.rejectFriendRequest(req.id);
    setRequests(mockSocialAdapter.getFriendRequests());
    addToast(`Declined request from ${req.name}`, { type: 'info' });
  };

  const handleConfirmRemoveFriend = () => {
    if (!friendToRemove) return;
    soundService.playBuzzer();
    mockSocialAdapter.removeFriend(friendToRemove.id);
    setFriends(mockSocialAdapter.getFriends());
    addToast(`Removed ${friendToRemove.name} from friends`, { type: 'info' });
    setFriendToRemove(null);
    if (selectedFriend?.id === friendToRemove.id) {
      setSelectedFriend(null);
    }
  };

  const handleBlockUser = (friend: FriendItem) => {
    soundService.playBuzzer();
    mockSocialAdapter.removeFriend(friend.id);
    setFriends(mockSocialAdapter.getFriends());
    addToast(`Blocked ${friend.name} (Simulated)`, { type: 'info' });
    setSelectedFriend(null);
  };

  const handleInviteToRoom = (friend: FriendItem) => {
    soundService.playClick();
    if (currentRoom) {
      addToast(`Invitation sent to ${friend.name} for Room #${currentRoom.code}`, { type: 'success' });
      navigate(`/room/${currentRoom.code}`);
    } else {
      // Create quick demo room in couple mode if couple friend, else friend mode
      const mode = friend.isMutualCouple ? 'couple' : 'friend';
      const room = createRoom({
        name: `${friend.name}'s Showdown`,
        mode,
        selectedGameId: mode === 'couple' ? 'aloo-golf' : 'original-card-game',
      });
      addToast(`Created #${room.code} and invited ${friend.name}`, { type: 'success' });
      navigate(`/room/${room.code}`);
    }
  };

  const getStatusBadge = (status: FriendItem['status'], text: string) => {
    switch (status) {
      case 'online':
        return <Badge variant="success" size="sm">● {text}</Badge>;
      case 'in-game':
        return <Badge variant="purple" size="sm">🎮 {text}</Badge>;
      case 'in-lobby':
        return <Badge variant="lavender" size="sm">⏳ {text}</Badge>;
      case 'offline':
        return <Badge variant="subtle" size="sm">○ {text}</Badge>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Top Disclaimer Notice */}
        <div className="mb-6 p-3.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-center justify-between gap-3 text-xs text-[#756D82]">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-[#9670E8] shrink-0" />
            <span>
              <strong>Local Social Simulation:</strong> Real-time friend presence and invites are simulated locally. No real social network traffic is exchanged.
            </span>
          </div>
          <Badge variant="subtle" size="sm">Simulated</Badge>
        </div>

        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Users className="w-6 h-6 text-[#9670E8]" />
              <h1 className="text-2xl sm:text-3xl font-black text-[#211A2D] tracking-tight">
                Friends & Squad
              </h1>
            </div>
            <p className="text-sm text-[#756D82]">
              Manage your gaming circle, view simulated presence, and invite players to your lobby.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="purple" size="md">
              {friends.length} Friends
            </Badge>
            {requests.length > 0 && (
              <Badge variant="pink" size="md">
                {requests.length} Pending
              </Badge>
            )}
          </div>
        </div>

        {/* Layout: Main Friends List + Side Requests Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main List */}
          <div className="lg:col-span-2 space-y-5">
            {/* Search Input Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#756D82] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search by friend name or handle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#EAE3F3] text-sm text-[#211A2D] placeholder:text-[#756D82] focus:border-[#9670E8] focus:ring-2 focus:ring-[#9670E8]/20 outline-none shadow-xs transition-all"
              />
            </div>

            {/* Friends Cards */}
            {filteredFriends.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#EAE3F3] p-12 text-center">
                <Users className="w-12 h-12 text-[#D5C7EE] mx-auto mb-3" />
                <h3 className="font-extrabold text-base text-[#211A2D]">No friends found</h3>
                <p className="text-xs text-[#756D82] mt-1">Try adjusting your search query.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredFriends.map((friend) => (
                  <div
                    key={friend.id}
                    className="bg-white rounded-2xl border border-[#EAE3F3] p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs hover:border-[#D5C7EE] transition-all"
                  >
                    <div
                      className="flex items-center gap-3.5 cursor-pointer flex-1"
                      onClick={() => {
                        soundService.playClick();
                        setSelectedFriend(friend);
                      }}
                    >
                      <Avatar
                        name={friend.name}
                        initials={friend.avatarInitials}
                        size="md"
                        bgColor={friend.avatarColor}
                        isOnline={friend.status !== 'offline'}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-[#211A2D] hover:text-[#9670E8] transition-colors">
                            {friend.name}
                          </span>
                          {friend.isMutualCouple && (
                            <span title="Couple Partner">
                              <Heart className="w-3.5 h-3.5 text-[#EC4899] fill-[#EC4899]" />
                            </span>
                          )}
                          <span className="text-xs text-[#756D82]">{friend.username}</span>
                        </div>
                        <div className="mt-1">
                          {getStatusBadge(friend.status, friend.statusText)}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="primary"
                        size="sm"
                        leftIcon={<Gamepad2 className="w-3.5 h-3.5" />}
                        onClick={() => handleInviteToRoom(friend)}
                      >
                        Invite to Play
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          soundService.playClick();
                          setSelectedFriend(friend);
                        }}
                      >
                        Profile
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Side Column: Friend Requests & Quick Info */}
          <div className="space-y-6">
            {/* Pending Requests Box */}
            <div className="bg-white rounded-3xl border border-[#EAE3F3] p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-[#9670E8]" />
                  <h2 className="text-sm font-black text-[#211A2D]">Friend Requests</h2>
                </div>
                <Badge variant={requests.length > 0 ? 'pink' : 'subtle'} size="sm">
                  {requests.length}
                </Badge>
              </div>

              {requests.length === 0 ? (
                <p className="text-xs text-[#756D82] text-center py-6">
                  No pending friend requests.
                </p>
              ) : (
                <div className="space-y-3">
                  {requests.map((req) => (
                    <div
                      key={req.id}
                      className="p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] space-y-2.5"
                    >
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          name={req.name}
                          initials={req.avatarInitials}
                          size="sm"
                          bgColor={req.avatarColor}
                        />
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-extrabold text-[#211A2D] block truncate">
                            {req.name}
                          </span>
                          <span className="text-[11px] text-[#756D82] block truncate">
                            {req.mutualFriends} mutual friends • {req.timestamp}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <Button
                          variant="primary"
                          size="sm"
                          className="flex-1 py-1 text-xs"
                          leftIcon={<Check className="w-3.5 h-3.5" />}
                          onClick={() => handleAcceptRequest(req)}
                        >
                          Accept
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 py-1 text-xs text-[#D94C65]"
                          leftIcon={<X className="w-3.5 h-3.5" />}
                          onClick={() => handleRejectRequest(req)}
                        >
                          Decline
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Instant Room Link Share Tip */}
            <div className="bg-gradient-to-br from-[#F8F4FF] to-[#F1EAFF] rounded-3xl border border-[#E3D6FA] p-5">
              <div className="flex items-center gap-2 text-[#593B91] font-black text-sm mb-2">
                <Sparkles className="w-4 h-4" />
                Quick Local Play
              </div>
              <p className="text-xs text-[#756D82] leading-relaxed mb-4">
                Want to play immediately? Start a Couple or Friend lobby and copy the 5-letter room code.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="w-full bg-white"
                leftIcon={<Send className="w-3.5 h-3.5" />}
                onClick={() => {
                  soundService.playClick();
                  navigate('/dashboard');
                }}
              >
                Go to Lobby Creator
              </Button>
            </div>
          </div>
        </div>
      </main>

      {/* Friend Profile Preview Modal */}
      {selectedFriend && (
        <Modal
          isOpen={!!selectedFriend}
          onClose={() => setSelectedFriend(null)}
          title="Friend Profile Preview"
        >
          <div className="space-y-5 pt-2">
            <div className="flex items-center gap-4 p-4 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
              <Avatar
                name={selectedFriend.name}
                initials={selectedFriend.avatarInitials}
                size="lg"
                bgColor={selectedFriend.avatarColor}
                isOnline={selectedFriend.status !== 'offline'}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-extrabold text-base text-[#211A2D] truncate">
                    {selectedFriend.name}
                  </h3>
                  {selectedFriend.isMutualCouple && (
                    <Badge variant="pink" size="sm">Partner</Badge>
                  )}
                </div>
                <p className="text-xs text-[#756D82]">{selectedFriend.username}</p>
                <div className="mt-1.5">
                  {getStatusBadge(selectedFriend.status, selectedFriend.statusText)}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3] text-xs text-[#756D82]">
              <strong>Head-to-Head Status:</strong> Connected in local PlaySpace session. Frequent gaming ally.
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-2.5 pt-3 border-t border-[#EAE3F3]">
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:flex-1"
                leftIcon={<Gamepad2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setSelectedFriend(null);
                  handleInviteToRoom(selectedFriend);
                }}
              >
                Invite to Match
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto text-[#D94C65] border-[#FCE7F3] hover:bg-[#FDF2F4]"
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                onClick={() => {
                  setFriendToRemove(selectedFriend);
                }}
              >
                Remove
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="w-full sm:w-auto text-[#756D82]"
                leftIcon={<Ban className="w-3.5 h-3.5" />}
                onClick={() => handleBlockUser(selectedFriend)}
              >
                Block
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Remove Friend Confirmation Modal */}
      {friendToRemove && (
        <Modal
          isOpen={!!friendToRemove}
          onClose={() => setFriendToRemove(null)}
          title="Remove Friend?"
          description={`Are you sure you want to remove ${friendToRemove.name} from your local friends list?`}
        >
          <div className="flex items-center justify-end gap-2.5 pt-4">
            <Button variant="ghost" size="sm" onClick={() => setFriendToRemove(null)}>
              Cancel
            </Button>
            <Button variant="danger" size="sm" onClick={handleConfirmRemoveFriend}>
              Yes, Remove Friend
            </Button>
          </div>
        </Modal>
      )}

      <Footer />
    </div>
  );
};
