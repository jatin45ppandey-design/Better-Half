import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Avatar } from '../components/ui/Avatar';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
interface FriendItem {
  id: string; name: string; username: string; avatarInitials: string; avatarColor: string;
  status: 'offline'; statusText: string; isMutualCouple?: boolean;
}
interface FriendRequestItem {
  id: string; name: string; username: string; avatarInitials: string; avatarColor: string;
  timestamp: string; mutualFriends: number;
}
import { api, type UserProfileResponse } from '../services/api';
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
  Sparkles,
  Heart,
  UserCheck,
} from 'lucide-react';

export const FriendsPage: React.FC = () => {
  const [friends, setFriends] = useState<FriendItem[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);
  const [isLoadingSocial, setIsLoadingSocial] = useState(true);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [invitingFriendId, setInvitingFriendId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFriend, setSelectedFriend] = useState<FriendItem | null>(null);
  const [friendToRemove, setFriendToRemove] = useState<FriendItem | null>(null);

  // User search & Add friend state
  const [showAddModal, setShowAddModal] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');
  const [isSearchingPlayers, setIsSearchingPlayers] = useState(false);
  const [searchResults, setSearchResults] = useState<UserProfileResponse[]>([]);
  const [sendingRequestId, setSendingRequestId] = useState<string | null>(null);

  const { createRoom, currentRoom } = useRoom();
  const { addToast } = useToast();
  const navigate = useNavigate();

  // Load real friends & requests from backend API
  const loadSocialData = async () => {
    setIsLoadingSocial(true);
    setSocialError(null);
    try {
      const [friendsRes, requestsRes] = await Promise.all([api.friends.list(), api.friends.listRequests()]);
      setFriends(friendsRes.friends.map((f) => ({
        id: f.id, name: f.displayName, username: `@${f.username}`,
        avatarInitials: f.avatarInitials || 'PL', avatarColor: f.avatarColor || '#9670E8',
        status: 'offline', statusText: 'Presence unavailable',
      })));
      setRequests(requestsRes.incoming.map((r) => ({
        id: r.id, name: r.user.displayName, username: `@${r.user.username}`,
        avatarInitials: r.user.avatarInitials || 'PL', avatarColor: r.user.avatarColor || '#9670E8',
        timestamp: new Date(r.createdAt).toLocaleDateString(), mutualFriends: 0,
      })));
    } catch (err) {
      setFriends([]);
      setRequests([]);
      setSocialError(err instanceof Error ? err.message : 'Friends and requests could not be loaded.');
    } finally {
      setIsLoadingSocial(false);
    }
  };

  useEffect(() => {
    loadSocialData();
  }, []);

  const filteredFriends = friends.filter(
    (f) =>
      f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      f.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSearchGlobalPlayers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerSearchQuery.trim()) return;

    setIsSearchingPlayers(true);
    try {
      const res = await api.profiles.search(playerSearchQuery.trim());
      setSearchResults(res.results || []);
    } catch (err: any) {
      addToast(err.message || 'Player search failed', { type: 'error' });
    } finally {
      setIsSearchingPlayers(false);
    }
  };

  const handleSendFriendRequest = async (targetUser: UserProfileResponse) => {
    setSendingRequestId(targetUser.id);
    soundService.playClick();
    try {
      await api.friends.sendRequest({ receiverId: targetUser.id });
      addToast(`Friend request sent to ${targetUser.displayName}!`, { type: 'success' });
      setSearchResults((prev) => prev.filter((p) => p.id !== targetUser.id));
      await loadSocialData();
    } catch (err: any) {
      addToast(err.message || 'Could not send friend request', { type: 'error' });
    } finally {
      setSendingRequestId(null);
    }
  };

  const handleAcceptRequest = async (req: FriendRequestItem) => {
    soundService.playSuccess();
    try {
      await api.friends.acceptRequest(req.id);
      addToast(`Connected with ${req.name}`, { type: 'success' });
      await loadSocialData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not accept friend request.', { type: 'error' });
    }
  };

  const handleRejectRequest = async (req: FriendRequestItem) => {
    soundService.playClick();
    try {
      await api.friends.rejectRequest(req.id);
      addToast(`Declined request from ${req.name}`, { type: 'info' });
      await loadSocialData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not decline friend request.', { type: 'error' });
    }
  };

  const handleConfirmRemoveFriend = async () => {
    if (!friendToRemove) return;
    soundService.playBuzzer();
    try {
      await api.friends.remove(friendToRemove.id);
      addToast(`Removed ${friendToRemove.name} from friends`, { type: 'info' });
      await loadSocialData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not remove friend.', { type: 'error' });
    } finally {
      setFriendToRemove(null);
      if (selectedFriend?.id === friendToRemove.id) {
        setSelectedFriend(null);
      }
    }
  };

  const handleBlockUser = async (friend: FriendItem) => {
    soundService.playBuzzer();
    try {
      await api.blocks.block(friend.id);
      addToast(`Blocked ${friend.name}`, { type: 'info' });
      await loadSocialData();
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not block this player.', { type: 'error' });
    } finally {
      setSelectedFriend(null);
    }
  };

  const handleInviteToRoom = async (friend: FriendItem) => {
    soundService.playClick();
    setInvitingFriendId(friend.id);
    try {
      let roomCode = currentRoom?.code;
      if (!roomCode) {
        const created = await createRoom({ name: `${friend.name}'s Game Room`, mode: 'friend', selectedGameId: 'uno-style' });
        roomCode = created.code;
      }
      const room = await api.rooms.getByCode(roomCode);
      if (room.isJoinPreview || !room.id) throw new Error('You must be an active room participant to invite a friend.');
      await api.roomInvitations.send(room.id, friend.id);
      addToast(`Room invitation sent to ${friend.name}.`, { type: 'success' });
      navigate(`/room/${roomCode}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : 'Could not send room invitation.', { type: 'error' });
    } finally {
      setInvitingFriendId(null);
    }
  };

  const getStatusBadge = () => <Badge variant="subtle" size="sm">Friend</Badge>;

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
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
              Manage your gaming circle, search players, and invite friends to your game lobby.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <Button
              variant="primary"
              size="sm"
              leftIcon={<UserPlus className="w-4 h-4" />}
              onClick={() => {
                soundService.playClick();
                setShowAddModal(true);
              }}
            >
              Add Friend
            </Button>
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
                placeholder="Search your friends by name or handle..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-2xl bg-white border border-[#EAE3F3] text-sm text-[#211A2D] placeholder:text-[#756D82] focus:border-[#9670E8] focus:ring-2 focus:ring-[#9670E8]/20 outline-none shadow-xs transition-all"
              />
            </div>

            {/* Friends Cards */}
            {isLoadingSocial ? (
              <div className="bg-white rounded-3xl border border-[#EAE3F3] p-8 text-center text-sm text-[#756D82]">Loading your friends…</div>
            ) : socialError ? (
              <div className="bg-white rounded-3xl border border-[#F8D2D9] p-8 text-center">
                <p className="text-sm text-[#A52E45]">{socialError}</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => void loadSocialData()}>Try again</Button>
              </div>
            ) : filteredFriends.length === 0 ? (
              <div className="bg-white rounded-3xl border border-[#EAE3F3] p-12 text-center">
                <Users className="w-12 h-12 text-[#D5C7EE] mx-auto mb-3" />
                <h3 className="font-extrabold text-base text-[#211A2D]">No friends found</h3>
                <p className="text-xs text-[#756D82] mt-1 mb-4">
                  Add friends by username or share a game lobby room code!
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  leftIcon={<UserPlus className="w-3.5 h-3.5" />}
                  onClick={() => setShowAddModal(true)}
                >
                  Find Players
                </Button>
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
                          {getStatusBadge()}
                        </div>
                      </div>
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={invitingFriendId === friend.id}
                        disabled={invitingFriendId !== null}
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
                            {req.username} • {req.timestamp}
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
                Quick Game Room
              </div>
              <p className="text-xs text-[#756D82] leading-relaxed mb-4">
                Want to play immediately? Start a Couple or Friend lobby and share your 6-character room code.
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

      {/* Add Friend Modal */}
      <Modal
        isOpen={showAddModal}
        onClose={() => {
          setShowAddModal(false);
          setSearchResults([]);
          setPlayerSearchQuery('');
        }}
        title="Find & Add Friends"
        description="Search for players by their PlaySpace username or display name."
        maxWidth="md"
      >
        <div className="space-y-4 pt-2">
          <form onSubmit={handleSearchGlobalPlayers} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-[#756D82] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Enter handle or name (e.g. jordan or alex)..."
                value={playerSearchQuery}
                onChange={(e) => setPlayerSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-[#EAE3F3] focus:border-[#9670E8] focus:ring-2 focus:ring-[#9670E8]/20 outline-none text-sm text-[#211A2D]"
              />
            </div>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSearchingPlayers}
            >
              Search
            </Button>
          </form>

          {/* Search Results */}
          <div className="max-h-64 overflow-y-auto space-y-2 pt-2">
            {searchResults.length > 0 ? (
              searchResults.map((player) => (
                <div
                  key={player.id}
                  className="flex items-center justify-between p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]"
                >
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={player.displayName}
                      initials={player.avatarInitials || 'PL'}
                      size="sm"
                      bgColor={player.avatarColor || '#9670E8'}
                    />
                    <div>
                      <span className="text-xs font-bold text-[#211A2D] block">
                        {player.displayName}
                      </span>
                      <span className="text-[11px] text-[#756D82]">
                        @{player.username}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs py-1"
                    isLoading={sendingRequestId === player.id}
                    leftIcon={<UserCheck className="w-3.5 h-3.5 text-[#593B91]" />}
                    onClick={() => handleSendFriendRequest(player)}
                  >
                    Add
                  </Button>
                </div>
              ))
            ) : playerSearchQuery && !isSearchingPlayers ? (
              <p className="text-xs text-[#756D82] text-center py-4">
                No players found matching &quot;{playerSearchQuery}&quot;.
              </p>
            ) : (
              <p className="text-xs text-[#756D82] text-center py-4">
                Enter a username above to find other players on PlaySpace.
              </p>
            )}
          </div>
        </div>
      </Modal>

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
          description={`Are you sure you want to remove ${friendToRemove.name} from your friends list?`}
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
