import React, { useState } from 'react';
import {
  Gamepad2,
  Users,
  Heart,
  PlusCircle,
  LogIn,
  Copy,
  Check,
  Sparkles,
  Layers,
  ChevronRight,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Avatar } from '../ui/Avatar';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { JoinRoomModal } from '../modals/JoinRoomModal';
import { useToast } from '../../context/ToastContext';

export const ProductHeroSection: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinInputCode, setJoinInputCode] = useState('');
  const [activePreviewMode, setActivePreviewMode] = useState<'couple' | 'friend'>('couple');
  const [copiedCode, setCopiedCode] = useState(false);

  const { addToast } = useToast();

  const handleInlineJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinInputCode.trim()) return;
    setJoinModalOpen(true);
  };

  const handleCopyPreviewCode = () => {
    const code = activePreviewMode === 'couple' ? 'LOVE24' : 'PLAY88';
    navigator.clipboard?.writeText(code);
    setCopiedCode(true);
    addToast('Preview Room Code Copied!', {
      type: 'info',
      message: `Code: ${code} (Sample Room)`,
    });
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <section className="relative pt-8 pb-16 md:pt-14 md:pb-20 overflow-hidden bg-gradient-to-b from-[#FCFAFF] via-[#F8F4FF]/50 to-[#FCFAFF]">
      {/* Subtle background glow */}
      <div
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-tr from-[#F1EAFF]/50 to-[#E8DCFF]/30 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          {/* Left Column: Product Positioning & Primary Room Actions */}
          <div className="lg:col-span-6 flex flex-col items-start gap-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F1EAFF] border border-[#E3D6FA] text-[#593B91] text-xs font-bold">
              <Gamepad2 className="w-4 h-4 text-[#9670E8]" />
              <span>Multiplayer Social Gaming Platform</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#211A2D] leading-[1.08]">
              Your people.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#593B91] via-[#9670E8] to-[#6C42B3]">
                Your games.
              </span>{' '}
              Your moment.
            </h1>

            <p className="text-base sm:text-lg text-[#756D82] max-w-lg leading-relaxed">
              Create a multiplayer room in seconds or join with a 6-character code.
              Handcrafted social games for couples and groups of friends.
            </p>

            {/* Primary Action Box: Create Room & Inline Join */}
            <div className="w-full max-w-md p-4 rounded-3xl bg-white border border-[#EAE3F3] shadow-md shadow-[#593B91]/5 flex flex-col gap-3">
              {/* Primary Action: Create Room */}
              <Button
                variant="primary"
                size="lg"
                onClick={() => setCreateModalOpen(true)}
                leftIcon={<PlusCircle className="w-5 h-5" />}
                className="w-full justify-center shadow-md shadow-[#593B91]/15 text-base font-bold"
              >
                Create Room
              </Button>

              {/* Inline Join Room with Code Input */}
              <form onSubmit={handleInlineJoin} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="ENTER 6-CHAR CODE"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="flex-1 rounded-xl border border-[#EAE3F3] bg-[#FCFAFF] px-3.5 py-2.5 text-xs font-mono font-bold tracking-widest text-[#211A2D] placeholder-[#9D96A8] uppercase focus:border-[#9670E8] focus:bg-white focus:outline-none"
                  maxLength={6}
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  onClick={() => setJoinModalOpen(true)}
                  leftIcon={<LogIn className="w-4 h-4" />}
                  className="font-bold shrink-0"
                >
                  Join Room
                </Button>
              </form>
            </div>

            {/* Honest Product Meta */}
            <div className="flex items-center gap-4 text-xs text-[#756D82] pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Heart className="w-3.5 h-3.5 text-[#D94C65] fill-[#D94C65]" />
                Couple Mode (2P)
              </span>
              <span>•</span>
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-[#593B91]" />
                Friend Mode (Up to 4P)
              </span>
              <span>•</span>
              <span>11 Games</span>
            </div>
          </div>

          {/* Right Column: Realistic Multiplayer Room Product UI Composition */}
          <div className="lg:col-span-6 w-full">
            <div className="relative rounded-3xl bg-white border border-[#EAE3F3] shadow-xl shadow-[#593B91]/8 p-5 sm:p-6 flex flex-col gap-4">
              {/* Composition Header: Room Info & Mode Switcher */}
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-[#F4EFFB]">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-extrabold tracking-wider px-2.5 py-1 rounded-lg bg-[#F8F4FF] border border-[#EAE3F3] text-[#593B91]">
                    ROOM: {activePreviewMode === 'couple' ? 'LOVE24' : 'PLAY88'}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyPreviewCode}
                    title="Copy sample room code"
                    className="p-1 rounded-md text-[#756D82] hover:text-[#593B91] hover:bg-[#F1EAFF] transition-colors cursor-pointer"
                  >
                    {copiedCode ? (
                      <Check className="w-3.5 h-3.5 text-[#248A62]" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {/* Mode Selector in Room Preview */}
                <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F8F4FF] border border-[#EAE3F3]">
                  <button
                    type="button"
                    onClick={() => setActivePreviewMode('couple')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      activePreviewMode === 'couple'
                        ? 'bg-white text-[#9D174D] shadow-xs'
                        : 'text-[#756D82] hover:text-[#211A2D]'
                    }`}
                  >
                    <Heart className="w-3 h-3 fill-current" />
                    Couple
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePreviewMode('friend')}
                    className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                      activePreviewMode === 'friend'
                        ? 'bg-white text-[#593B91] shadow-xs'
                        : 'text-[#756D82] hover:text-[#211A2D]'
                    }`}
                  >
                    <Users className="w-3 h-3" />
                    Friends
                  </button>
                </div>
              </div>

              {/* Room Title & Host */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-bold text-[#211A2D]">
                    {activePreviewMode === 'couple'
                      ? "Alex & Sam's Private Lounge"
                      : "Weekend Game Night Arena"}
                  </h3>
                  <span className="text-xs text-[#756D82]">
                    Host: <strong>Alex Rivera</strong> •{' '}
                    {activePreviewMode === 'couple' ? '2 Player Limit' : '4 Player Limit'}
                  </span>
                </div>
                <Badge variant={activePreviewMode === 'couple' ? 'pink' : 'lavender'} size="sm">
                  {activePreviewMode === 'couple' ? 'Couple Mode' : 'Friend Mode'}
                </Badge>
              </div>

              {/* Realistic Player Slot Roster */}
              <div className="p-3.5 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3]">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82] block mb-2.5">
                  Lobby Players
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {/* Host Slot */}
                  <div className="p-2.5 rounded-xl bg-white border border-[#EAE3F3] flex flex-col items-center text-center">
                    <Avatar name="Alex Rivera" initials="AR" size="sm" bgColor="bg-[#9670E8]" />
                    <span className="text-xs font-bold text-[#211A2D] mt-1 truncate w-full">
                      Alex
                    </span>
                    <span className="text-[10px] text-[#248A62] font-semibold">Host (Ready)</span>
                  </div>

                  {/* Slot 2 */}
                  <div className="p-2.5 rounded-xl bg-white border border-[#EAE3F3] flex flex-col items-center text-center">
                    <Avatar
                      name={activePreviewMode === 'couple' ? 'Sam Patel' : 'Leo Vance'}
                      initials={activePreviewMode === 'couple' ? 'SP' : 'LV'}
                      size="sm"
                      bgColor={activePreviewMode === 'couple' ? 'bg-[#D94C65]' : 'bg-[#3B82F6]'}
                    />
                    <span className="text-xs font-bold text-[#211A2D] mt-1 truncate w-full">
                      {activePreviewMode === 'couple' ? 'Sam' : 'Leo'}
                    </span>
                    <span className="text-[10px] text-[#248A62] font-semibold">Connected</span>
                  </div>

                  {/* Slot 3 & 4 */}
                  {activePreviewMode === 'friend' ? (
                    <>
                      <div className="p-2.5 rounded-xl bg-white border border-[#EAE3F3] flex flex-col items-center text-center">
                        <Avatar name="Zara Chen" initials="ZC" size="sm" bgColor="bg-[#10B981]" />
                        <span className="text-xs font-bold text-[#211A2D] mt-1 truncate w-full">
                          Zara
                        </span>
                        <span className="text-[10px] text-[#248A62] font-semibold">Connected</span>
                      </div>
                      <div className="p-2.5 rounded-xl border border-dashed border-[#D5C7EE] bg-[#F8F4FF] flex flex-col items-center justify-center text-center">
                        <div className="w-7 h-7 rounded-full border border-dashed border-[#D5C7EE] flex items-center justify-center text-[10px] text-[#756D82] font-bold mb-1">
                          +
                        </div>
                        <span className="text-[11px] font-semibold text-[#756D82]">Slot 4</span>
                        <span className="text-[9px] text-[#9D96A8]">Open</span>
                      </div>
                    </>
                  ) : (
                    <div className="col-span-2 p-2.5 rounded-xl border border-dashed border-[#FBCFE8] bg-[#FFF8FA] flex flex-col items-center justify-center text-center">
                      <span className="text-xs font-semibold text-[#9D174D]">
                        Duo Lobby Locked
                      </span>
                      <span className="text-[10px] text-[#756D82]">
                        2-player private match ready to launch
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Selected Game Card within Room */}
              <div className="p-3.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#593B91] text-white flex items-center justify-center font-bold">
                    {activePreviewMode === 'couple' ? (
                      <Heart className="w-5 h-5 fill-current" />
                    ) : (
                      <Layers className="w-5 h-5" />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-extrabold text-[#211A2D]">
                      {activePreviewMode === 'couple' ? 'BETWEEN US' : 'Original UNO-style Card Game'}
                    </span>
                    <span className="text-[11px] text-[#756D82]">
                      {activePreviewMode === 'couple'
                        ? 'Connection • 2 Players • Deep Water Prompts'
                        : 'Classic Cards • 2-4 Players • Standard Rules'}
                    </span>
                  </div>
                </div>
                <Badge variant="subtle" size="sm">
                  Active Pick
                </Badge>
              </div>

              {/* Room Controls Strip */}
              <div className="pt-2 flex items-center justify-between text-xs text-[#756D82]">
                <div className="flex items-center gap-1.5 font-medium">
                  <Sparkles className="w-3.5 h-3.5 text-[#9670E8]" />
                  <span>Interactive Room UI Composition</span>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCreateModalOpen(true)}
                  className="font-bold"
                  rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
                >
                  Configure Room
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Modals for Create and Join Room */}
      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialMode={activePreviewMode}
      />
      <JoinRoomModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        initialCode={joinInputCode}
      />
    </section>
  );
};
