import React, { useState } from 'react';
import { Gamepad2, Users, Heart, PlusCircle, LogIn } from 'lucide-react';
import { Button } from '../ui/Button';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { JoinRoomModal } from '../modals/JoinRoomModal';

export const ProductHeroSection: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [joinInputCode, setJoinInputCode] = useState('');

  const handleInlineJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (joinInputCode.trim().length !== 6) return;
    setJoinModalOpen(true);
  };

  return (
    <section className="relative pt-8 pb-16 md:pt-14 md:pb-20 overflow-hidden bg-gradient-to-b from-[#FCFAFF] via-[#F8F4FF]/50 to-[#FCFAFF]">
      <div
        className="absolute top-10 left-1/2 -translate-x-1/2 w-[720px] h-[360px] bg-gradient-to-tr from-[#F1EAFF]/50 to-[#E8DCFF]/30 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-8 items-center">
          <div className="lg:col-span-6 flex flex-col items-start gap-6 text-left">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#F1EAFF] border border-[#E3D6FA] text-[#593B91] text-xs font-bold">
              <Gamepad2 className="w-4 h-4 text-[#9670E8]" />
              <span>Multiplayer Social Gaming</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#211A2D] leading-[1.08]">
              Your people.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#593B91] via-[#9670E8] to-[#6C42B3]">
                Your games.
              </span>{' '}
              Your moment.
            </h1>

            <p className="text-base sm:text-lg text-[#756D82] max-w-lg leading-relaxed">
              Create a room or join with a 6-character code. Bring your partner or friends together for a game night.
            </p>

            <div className="w-full max-w-md p-4 rounded-3xl bg-white border border-[#EAE3F3] shadow-md shadow-[#593B91]/5 flex flex-col gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => setCreateModalOpen(true)}
                leftIcon={<PlusCircle className="w-5 h-5" />}
                className="w-full justify-center shadow-md shadow-[#593B91]/15 text-base font-bold"
              >
                Create Room
              </Button>

              <form onSubmit={handleInlineJoin} className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="ENTER 6-CHAR CODE"
                  aria-label="Room code"
                  value={joinInputCode}
                  onChange={(e) => setJoinInputCode(e.target.value.toUpperCase().slice(0, 6))}
                  className="min-w-0 flex-1 rounded-xl border border-[#EAE3F3] bg-[#FCFAFF] px-3.5 py-2.5 text-xs font-mono font-bold tracking-widest text-[#211A2D] placeholder-[#9D96A8] uppercase focus:border-[#9670E8] focus:bg-white focus:outline-none"
                  maxLength={6}
                  minLength={6}
                  required
                />
                <Button
                  type="submit"
                  variant="secondary"
                  size="md"
                  leftIcon={<LogIn className="w-4 h-4" />}
                  className="font-bold shrink-0"
                >
                  Join Room
                </Button>
              </form>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-xs text-[#756D82] pt-1">
              <span className="flex items-center gap-1.5 font-medium">
                <Heart className="w-3.5 h-3.5 text-[#D94C65] fill-[#D94C65]" />
                Couple Mode · 2 players
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <Users className="w-3.5 h-3.5 text-[#593B91]" />
                Friend Mode · 2–4 players
              </span>
              <span>11 games</span>
            </div>
          </div>

          <div className="lg:col-span-6 w-full">
            <div className="relative rounded-3xl bg-white border border-[#EAE3F3] shadow-xl shadow-[#593B91]/8 p-6 sm:p-8">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-10 h-10 rounded-2xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center">
                  <Gamepad2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-[#211A2D]">Two ways to play</h2>
                  <p className="text-xs text-[#756D82]">Pick your people. Pick your game.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-2xl border border-[#F3D9E4] bg-[#FFF8FB] p-5">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#B33D69] border border-[#F3D9E4] flex items-center justify-center mb-4">
                    <Heart className="w-5 h-5 fill-current" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#211A2D]">Couple Mode</h3>
                  <p className="text-xs text-[#756D82] mt-1">A private two-player session.</p>
                  <p className="text-[11px] font-semibold text-[#9D174D] mt-4">Truth or Dare · Would You Rather · BETWEEN US</p>
                </div>

                <div className="rounded-2xl border border-[#E3D6FA] bg-[#F8F4FF] p-5">
                  <div className="w-10 h-10 rounded-xl bg-white text-[#593B91] border border-[#E3D6FA] flex items-center justify-center mb-4">
                    <Users className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-extrabold text-[#211A2D]">Friend Mode</h3>
                  <p className="text-xs text-[#756D82] mt-1">Bring 2 to 4 players into the room.</p>
                  <p className="text-[11px] font-semibold text-[#593B91] mt-4">UNO-style · Kabza · Basketball Rivalry</p>
                </div>
              </div>

              <div className="mt-5 pt-5 border-t border-[#F4EFFB] flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs text-[#756D82]">Eleven original games. One shared space.</p>
                <button
                  type="button"
                  onClick={() => document.getElementById('games')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-xs font-bold text-[#593B91] hover:text-[#40266B] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9670E8]"
                >
                  Explore games
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
      />
      <JoinRoomModal
        isOpen={joinModalOpen}
        onClose={() => setJoinModalOpen(false)}
        initialCode={joinInputCode}
      />
    </section>
  );
};
