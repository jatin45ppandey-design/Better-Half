import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import {
  Copy,
  Check,
  Heart,
  Users,
  Play,
  ArrowLeft,
  MessageSquare,
  Send,
  CheckCircle2,
  XCircle,
  AlertCircle,
  Vote,
  Crown,
} from 'lucide-react';
import { Navbar } from '../components/navigation/Navbar';
import { Footer } from '../components/navigation/Footer';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { GameIcon } from '../components/ui/GameIcon';
import { Modal } from '../components/ui/Modal';
import { soundService } from '../services/soundService';
import { socketService } from '../services/socket';
import { api } from '../services/api';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  getGamesForMode,
  getGameById,
} from '../data/games/registry';
import type { GameItem, RoomParticipant, ChatMessage } from '../types/game';

export const RoomLobbyPage: React.FC = () => {
  const { roomCode } = useParams<{ roomCode: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();

  const {
    currentRoom,
    allRooms,
    joinRoom,
    toggleReady,
    setRoomGame,
    voteForGame,
    sendChatMessage,
    sendEmojiReaction,
    canStartGame,
  } = useRoom();

  const [copied, setCopied] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [validationError, setValidationError] = useState<string | null>(null);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  // If URL has roomCode but currentRoom does not match, attempt to join on server
  useEffect(() => {
    if (roomCode) {
      const code = roomCode.toUpperCase();
      if (!currentRoom || currentRoom.code !== code) {
        setIsConnecting(true);
        joinRoom(code)
          .then((res) => {
            if (!res.success) {
              setValidationError(res.error || `Could not connect to room ${code}`);
            }
          })
          .catch((err) => {
            setValidationError(err?.message || `Could not join room ${code}`);
          })
          .finally(() => {
            setIsConnecting(false);
          });
      }
    }
  }, [roomCode, currentRoom, joinRoom]);

  // Listen for real-time game session start broadcast
  useEffect(() => {
    const unsubSession = socketService.on(
      'game:session:started',
      ({ sessionId, gameId, roomCode: startedRoomCode }: any) => {
        navigate(`/game/${gameId}?room=${startedRoomCode || roomCode}&session=${sessionId}`);
      }
    );
    return () => unsubSession();
  }, [navigate, roomCode]);

  // Loading state
  if (isConnecting) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-[#EAE3F3] shadow-md flex flex-col items-center gap-4">
            <div className="w-12 h-12 rounded-full border-4 border-[#9670E8] border-t-transparent animate-spin" />
            <h2 className="text-xl font-bold text-[#211A2D]">Connecting to Lobby...</h2>
            <p className="text-xs text-[#756D82]">
              Connecting to room <strong>#{roomCode}</strong> via real-time multiplayer server.
            </p>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  // If room is invalid / not found
  if (!roomCode || !allRooms[roomCode.toUpperCase()]) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
        <Navbar />
        <main className="flex-1 flex flex-col items-center justify-center p-4 text-center">
          <div className="max-w-md w-full p-8 rounded-3xl bg-white border border-[#EAE3F3] shadow-md flex flex-col items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#FDF0F2] text-[#D94C65] flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
            <h1 className="text-2xl font-bold text-[#211A2D]">Room Not Found</h1>
            <p className="text-sm text-[#756D82] leading-relaxed">
              We couldn't connect to an active room with code <strong>{roomCode || 'UNKNOWN'}</strong>.
              The room may have expired, reached maximum capacity, or been closed by the host.
            </p>
            <div className="flex flex-col gap-2 w-full pt-2">
              <Button
                variant="primary"
                onClick={() => navigate('/dashboard')}
                className="w-full justify-center"
              >
                Create a New Room
              </Button>
              <Link to="/dashboard" className="w-full">
                <Button variant="outline" className="w-full justify-center">
                  Back to Dashboard
                </Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const room = allRooms[roomCode.toUpperCase()];
  const isCouple = room.mode === 'couple';
  const eligibleGames = getGamesForMode(room.mode);
  const selectedGame = getGameById(room.selectedGameId) || eligibleGames[0];

  const currentUserParticipant = room.participants.find(
    (participant: RoomParticipant) => participant.id === user?.id
  );

  if (!currentUserParticipant) {
    return (
      <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
        <Navbar />
        <main className="flex-1 flex items-center justify-center px-4 py-16 text-center">
          <div className="max-w-md rounded-3xl border border-[#EAE3F3] bg-white p-8">
            <h1 className="text-xl font-black text-[#211A2D]">Room access unavailable</h1>
            <p className="mt-2 text-sm text-[#756D82]">
              Your account is not an active participant in this room. Join with a valid room invitation or code.
            </p>
            <Button variant="primary" className="mt-5" onClick={() => navigate('/dashboard')}>
              Back to Dashboard
            </Button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const isHost = currentUserParticipant.isHost;

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(room.code);
    setCopied(true);
    addToast('Room Code Copied!', {
      type: 'info',
      message: `Share code ${room.code} with your ${isCouple ? 'partner' : 'friends'}!`,
    });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;
    sendChatMessage(chatInput.trim());
    setChatInput('');
  };

  const handleStartGame = async () => {
    const check = canStartGame();
    if (!check.canStart) {
      setValidationError(check.reason || 'Cannot start match.');
      addToast('Cannot start match yet', {
        type: 'error',
        message: check.reason,
      });
      return;
    }

    setValidationError(null);
    const rId = room.id || room.code;
    try {
      socketService.emit('room:start:prepare', { roomId: rId }, (res: any) => {
        if (!res?.success) {
          api.games
            .start(rId, selectedGame.id)
            .then((startRes: any) => {
              navigate(
                `/game/${selectedGame.id}?room=${room.code}&session=${startRes.sessionId}`
              );
            })
            .catch((err: any) => {
              addToast(err.message || 'Failed to start game session', { type: 'error' });
            });
        }
      });
    } catch (err: any) {
      addToast(err.message || 'Failed to start match', { type: 'error' });
    }
  };

  const handleGameSelect = async (gameId: string) => {
    const res = await setRoomGame(gameId);
    if (!res.success) {
      addToast(res.error || 'Failed to select game', { type: 'error' });
    } else {
      addToast(`Game set to ${getGameById(gameId)?.name}`, { type: 'info' });
    }
  };

  // Tally votes for Friend Mode
  const totalVotesCast = Object.values(room.gameVotes).reduce(
    (acc: number, voters) => acc + ((voters as string[])?.length || 0),
    0
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#FCFAFF]">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Room Header Strip */}
        <div className="p-4 sm:p-6 rounded-3xl bg-white border border-[#EAE3F3] shadow-sm mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3">
            <button
              type="button"
              onClick={() => {
                soundService.playClick();
                setShowExitConfirm(true);
              }}
              className="p-2 rounded-xl text-[#756D82] hover:text-[#D94C65] hover:bg-[#FDF2F4] transition-colors cursor-pointer"
              title="Exit Room"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            <div>
              <div className="flex flex-wrap items-center gap-2 mb-0.5">
                <span className="text-xs font-mono font-extrabold tracking-wider px-2.5 py-0.5 rounded-lg bg-[#F8F4FF] border border-[#EAE3F3] text-[#593B91]">
                  ROOM: {room.code}
                </span>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="p-1 rounded-md text-[#756D82] hover:text-[#593B91] hover:bg-[#F1EAFF] transition-colors cursor-pointer text-xs flex items-center gap-1 font-semibold"
                >
                  {copied ? (
                    <>
                      <Check className="w-3.5 h-3.5 text-[#248A62]" />
                      <span className="text-[#248A62]">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3.5 h-3.5" />
                      <span>Copy Code</span>
                    </>
                  )}
                </button>
                <Badge variant={isCouple ? 'pink' : 'lavender'} size="sm">
                  {isCouple ? (
                    <span className="flex items-center gap-1">
                      <Heart className="w-3 h-3 fill-current" />
                      Couple Mode (2P)
                    </span>
                  ) : (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      Friend Mode (Up to 4P)
                    </span>
                  )}
                </Badge>
              </div>

              <h1 className="text-xl sm:text-2xl font-extrabold text-[#211A2D]">
                {room.name}
              </h1>
            </div>
          </div>

          {/* Right Action: Ready Toggle & Start Game */}
          <div className="flex flex-wrap items-center gap-2.5">
            <Button
              variant={currentUserParticipant?.isReady ? 'secondary' : 'outline'}
              size="md"
              onClick={() => toggleReady(currentUserParticipant?.id)}
              leftIcon={
                currentUserParticipant?.isReady ? (
                  <CheckCircle2 className="w-4 h-4 text-[#248A62]" />
                ) : (
                  <XCircle className="w-4 h-4 text-[#756D82]" />
                )
              }
              className="font-bold text-xs"
            >
              {currentUserParticipant?.isReady ? 'Ready' : 'Set Ready'}
            </Button>

            <Button
              variant="primary"
              size="md"
              onClick={handleStartGame}
              leftIcon={<Play className="w-4 h-4 fill-current" />}
              className="font-bold shadow-md shadow-[#593B91]/15 text-sm"
            >
              Start Game ({selectedGame.name})
            </Button>
          </div>
        </div>

        {/* Validation Error Banner */}
        {validationError && (
          <div className="mb-6 p-4 rounded-2xl bg-[#FDF0F2] border border-[#F8D2D9] flex items-center gap-3 text-xs sm:text-sm text-[#D94C65]">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span className="font-semibold">{validationError}</span>
          </div>
        )}

        {/* Main 2-Column Grid: Players & Game Selection on Left, Chat & Voting on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column (8 cols): Player Roster & Game Picker */}
          <div className="lg:col-span-8 flex flex-col gap-6">
            {/* Player Roster Section */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#EAE3F3] shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#211A2D] flex items-center gap-2">
                    <Users className="w-4 h-4 text-[#593B91]" />
                    Lobby Participants ({room.participants.length} / {room.maxPlayers})
                  </h2>
                  <p className="text-xs text-[#756D82]">
                    {isCouple
                      ? 'Couple Mode requires exactly 2 active players to launch.'
                      : 'Friend Mode supports up to 4 players. All players must toggle Ready.'}
                  </p>
                </div>
              </div>

              {/* Player Slots Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                {room.participants.map((participant: RoomParticipant) => (
                  <div
                    key={participant.id}
                    className={`p-3.5 rounded-2xl border transition-all flex flex-col justify-between relative ${
                      participant.isReady
                        ? 'border-[#C6ECD9] bg-[#F7FCF9]'
                        : 'border-[#EAE3F3] bg-[#FCFAFF]'
                    }`}
                  >
                    {/* Host crown badge */}
                    {participant.isHost && (
                      <div className="absolute top-2.5 right-2.5 text-[#F59E0B]" title="Room Host">
                        <Crown className="w-3.5 h-3.5 fill-current" />
                      </div>
                    )}

                    <div className="flex items-center gap-2.5 mb-3">
                      <Avatar
                        name={participant.name}
                        initials={participant.avatarInitials}
                        bgColor={participant.avatarColor}
                        size="md"
                      />
                      <div className="flex flex-col min-w-0">
                        <span className="text-xs font-bold text-[#211A2D] truncate">
                          {participant.name}
                        </span>
                        <span className="text-[10px] text-[#756D82]">
                          {participant.isHost ? 'Host' : 'Player'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-[#F4EFFB] text-xs">
                      <span
                        className={`inline-flex items-center gap-1 font-bold text-[11px] ${
                          participant.isReady ? 'text-[#248A62]' : 'text-[#756D82]'
                        }`}
                      >
                        {participant.isReady ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Ready
                          </>
                        ) : (
                          <>
                            <XCircle className="w-3.5 h-3.5" />
                            Not Ready
                          </>
                        )}
                      </span>
                    </div>
                  </div>
                ))}

                {/* Empty Slots */}
                {Array.from({ length: Math.max(0, room.maxPlayers - room.participants.length) }).map(
                  (_, idx) => (
                    <div
                      key={idx}
                      className="p-3.5 rounded-2xl border border-dashed border-[#D5C7EE] bg-[#FAF8FE] flex flex-col items-center justify-center text-center gap-1.5 min-h-[105px]"
                    >
                      <div className="w-8 h-8 rounded-full border border-dashed border-[#D5C7EE] flex items-center justify-center text-xs text-[#756D82] font-bold">
                        +
                      </div>
                      <span className="text-xs font-semibold text-[#756D82]">
                        Open Slot {room.participants.length + idx + 1}
                      </span>
                      <span className="text-[10px] text-[#9D96A8]">Waiting for code</span>
                    </div>
                  )
                )}
              </div>
            </div>

            {/* Selected Game & Eligible Games Section */}
            <div className="p-5 sm:p-6 rounded-3xl bg-white border border-[#EAE3F3] shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                <div>
                  <h2 className="text-base font-bold text-[#211A2D] flex items-center gap-2">
                    <GameIcon name={selectedGame.iconName} className="w-4 h-4 text-[#9670E8]" />
                    Active Selected Game: {selectedGame.name}
                  </h2>
                  <p className="text-xs text-[#756D82]">
                    {isCouple
                      ? 'Exclusive access to Couple Mode games. Host can change game pick.'
                      : 'Friend Mode allows all players to cast votes to decide the match!'}
                  </p>
                </div>
                <Badge variant={isCouple ? 'pink' : 'purple'} size="sm">
                  {selectedGame.category}
                </Badge>
              </div>

              {/* Active Game Feature Card */}
              <div className="p-4 rounded-2xl bg-gradient-to-r from-[#F8F4FF] via-white to-[#F1EAFF] border border-[#EAE3F3] mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center border ${selectedGame.accentColor.bg} ${selectedGame.accentColor.border} ${selectedGame.accentColor.text}`}
                  >
                    <GameIcon name={selectedGame.iconName} className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-[#211A2D]">
                      {selectedGame.name}
                    </h3>
                    <p className="text-xs text-[#756D82] max-w-md">
                      {selectedGame.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-semibold text-[#593B91]">
                    {selectedGame.estimatedMinutes}
                  </span>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleStartGame}
                    disabled={!isHost}
                    title={isHost ? 'Launch Match' : 'Only the room host can launch the match'}
                    leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                    className="font-bold text-xs"
                  >
                    {isHost ? 'Launch Match' : 'Host Launches'}
                  </Button>
                </div>
              </div>

              {/* Eligible Games Catalog for this Mode */}
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-[#593B91] block mb-3">
                  Available Games ({eligibleGames.length} for {isCouple ? 'Couple Mode' : 'Friend Mode'})
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {eligibleGames.map((game: GameItem) => {
                    const isSelected = room.selectedGameId === game.id;
                    const votes = room.gameVotes[game.id]?.length || 0;

                    return (
                      <div
                        key={game.id}
                        onClick={() => handleGameSelect(game.id)}
                        className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                          isSelected
                            ? 'border-[#9670E8] bg-[#F1EAFF]/60 shadow-xs'
                            : 'border-[#EAE3F3] bg-white hover:border-[#D5C7EE]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={`w-8 h-8 rounded-xl flex items-center justify-center border shrink-0 ${game.accentColor.bg} ${game.accentColor.border} ${game.accentColor.text}`}
                          >
                            <GameIcon name={game.iconName} className="w-4 h-4" />
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-bold text-[#211A2D] truncate">
                              {game.name}
                            </span>
                            <span className="text-[10px] text-[#756D82] truncate">
                              {game.category} • {game.estimatedMinutes}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {!isCouple && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                voteForGame(game.id);
                              }}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-colors ${
                                votes > 0
                                  ? 'bg-[#593B91] text-white border-[#593B91]'
                                  : 'bg-[#F8F4FF] text-[#756D82] border-[#EAE3F3] hover:text-[#593B91]'
                              }`}
                              title="Vote for this game"
                            >
                              Vote {votes > 0 ? `(${votes})` : ''}
                            </button>
                          )}
                          {isSelected && (
                            <Badge variant="purple" size="sm" className="text-[10px]">
                              Active
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (4 cols): Voting Status, Live Room Chat & Emoji Reactions */}
          <div className="lg:col-span-4 flex flex-col gap-6">
            {/* Friend Mode Voting Panel (if Friend Mode) */}
            {!isCouple && (
              <div className="p-5 rounded-3xl bg-white border border-[#EAE3F3] shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[#593B91] flex items-center gap-1.5">
                    <Vote className="w-3.5 h-3.5" />
                    Lobby Voting
                  </h3>
                  <span className="text-[11px] text-[#756D82]">
                    {totalVotesCast} votes recorded
                  </span>
                </div>

                <div className="flex flex-col gap-2 mt-3">
                  {eligibleGames.map((game: GameItem) => {
                    const count = (room.gameVotes[game.id] as string[] | undefined)?.length || 0;
                    const percent =
                      room.participants.length > 0
                        ? Math.round((count / room.participants.length) * 100)
                        : 0;

                    return (
                      <div key={game.id} className="flex flex-col gap-1 text-xs">
                        <div className="flex items-center justify-between font-semibold">
                          <span className="text-[#211A2D] truncate">{game.name}</span>
                          <span className="text-[#593B91] font-mono">{count} votes</span>
                        </div>
                        <div className="h-1.5 w-full bg-[#F8F4FF] rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#9670E8] rounded-full transition-all duration-300"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Room Chat & Emoji Reactions */}
            <div className="p-5 rounded-3xl bg-white border border-[#EAE3F3] shadow-xs flex flex-col h-[400px]">
              <div className="flex items-center justify-between pb-3 border-b border-[#F4EFFB] mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-[#593B91] flex items-center gap-1.5">
                  <MessageSquare className="w-3.5 h-3.5" />
                  Room Chat
                </span>
                <Badge variant="subtle" size="sm">
                  Simulated
                </Badge>
              </div>

              {/* Chat Message Scroll */}
              <div className="flex-1 overflow-y-auto flex flex-col gap-2 pr-1 mb-3">
                {room.chatMessages.map((msg: ChatMessage) => (
                  <div
                    key={msg.id}
                    className={`text-xs p-2 rounded-xl leading-relaxed ${
                      msg.isSystem
                        ? 'bg-[#F8F4FF] text-[#593B91] italic font-medium'
                        : 'bg-[#FCFAFF] border border-[#EAE3F3] text-[#211A2D]'
                    }`}
                  >
                    {!msg.isSystem && (
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="font-bold text-[#593B91]">{msg.senderName}</span>
                        <span className="text-[10px] text-[#9D96A8]">{msg.timestamp}</span>
                      </div>
                    )}
                    <span>{msg.text}</span>
                  </div>
                ))}
              </div>

              {/* Quick Emojis */}
              <div className="flex items-center gap-1 mb-2 pt-1 border-t border-[#F4EFFB] overflow-x-auto">
                {['🎉', '🔥', '😂', '👀', '💜', '🏆', '🃏'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => sendEmojiReaction(emoji)}
                    className="p-1.5 text-base hover:bg-[#F1EAFF] rounded-lg transition-transform active:scale-125 cursor-pointer"
                  >
                    {emoji}
                  </button>
                ))}
              </div>

              {/* Chat Input */}
              <form onSubmit={handleSendChat} className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="Type a message..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  className="flex-1 rounded-xl border border-[#EAE3F3] bg-[#FCFAFF] px-3 py-1.5 text-xs text-[#211A2D] placeholder-[#9D96A8] focus:border-[#9670E8] focus:bg-white focus:outline-none"
                />
                <Button type="submit" variant="secondary" size="sm" className="p-2 shrink-0">
                  <Send className="w-3.5 h-3.5 text-[#593B91]" />
                </Button>
              </form>
            </div>
          </div>
        </div>

        {/* Exit Room Confirmation Modal */}
        <Modal
          isOpen={showExitConfirm}
          onClose={() => setShowExitConfirm(false)}
          title={`Exit Room #${room.code}?`}
          description="Are you sure you want to leave this active multiplayer lobby?"
          maxWidth="sm"
        >
          <div className="flex flex-col gap-4 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#FDF0F2] border border-[#F8D2D9] flex items-center gap-2.5 text-xs text-[#D94C65]">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>You will return to the dashboard. You can rejoin using room code <strong>{room.code}</strong>.</span>
            </div>
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <Button variant="outline" size="sm" onClick={() => setShowExitConfirm(false)}>
                Stay in Lobby
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={() => {
                  soundService.playClick();
                  setShowExitConfirm(false);
                  navigate('/dashboard');
                }}
              >
                Confirm Exit
              </Button>
            </div>
          </div>
        </Modal>
      </main>

      <Footer />
    </div>
  );
};
