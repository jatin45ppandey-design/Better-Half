import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Users,
} from 'lucide-react';
import { CreateRoomModal } from '../modals/CreateRoomModal';
import { JoinRoomModal } from '../modals/JoinRoomModal';
import { soundService } from '../../services/soundService';

export const BetterHalfHeroSection: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [joinModalOpen, setJoinModalOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'couple' | 'friend'>('couple');

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleCreateRoom = () => {
    soundService.playClick();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setCreateModalOpen(true);
  };

  const handleJoinRoom = () => {
    soundService.playClick();
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setJoinModalOpen(true);
  };

  return (
    <section className="relative pt-3 pb-8 sm:pt-6 sm:pb-10 overflow-hidden bg-transparent">
      {/* Soft atmospheric ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[360px] bg-gradient-to-tr from-[#E9D5FF]/40 to-[#DDD6FE]/20 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Hero: Headline + CTAs + Standalone Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center min-h-[380px]">
          {/* Left Hero Content */}
          <div className="lg:col-span-6 flex flex-col items-start text-left gap-4 sm:gap-5">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#1E1035] leading-[1.08] font-heading">
              Good{' '}
              <span className="relative inline-block">
                games.
                <svg
                  className="absolute -bottom-2 left-0 w-full h-3 text-[#7C3AED]/80"
                  viewBox="0 0 100 20"
                  fill="none"
                  preserveAspectRatio="none"
                  aria-hidden="true"
                >
                  <path
                    d="M2 14C28 4 72 4 98 14"
                    stroke="currentColor"
                    strokeWidth="4.5"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <br />
              Better company.
            </h1>

            <p className="text-base sm:text-lg text-[#6B5E82] max-w-md leading-relaxed font-sans">
              Play together with your partner or friends.
              <br className="hidden sm:inline" />
              Choose a game and enjoy.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 pt-1 sm:pt-2">
              <button
                type="button"
                onClick={handleCreateRoom}
                className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-base font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] shadow-lg shadow-purple-900/25 active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Create Room</span>
                <ArrowRight className="w-4 h-4 ml-2" />
              </button>

              <button
                type="button"
                onClick={handleJoinRoom}
                className="inline-flex items-center justify-center px-6 py-3.5 rounded-full text-base font-bold text-[#7C3AED] bg-white/90 hover:bg-white border-2 border-[#7C3AED]/30 hover:border-[#7C3AED] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
              >
                <span>Join Room</span>
                <ChevronRight className="w-4 h-4 ml-1.5" />
              </button>
            </div>
          </div>

          {/* Right Hero Visual: Standalone Couple Illustration (No Container Box, Edge-Blended) */}
          <div className="lg:col-span-6 flex justify-center lg:justify-end items-center">
            <img
              src="/couple-gaming-hero.png"
              alt="Couple happily playing multiplayer video games together on a couch"
              className="w-full max-w-[560px] h-auto object-contain select-none pointer-events-none drop-shadow-sm transition-transform hover:scale-[1.01] duration-300"
              loading="eager"
            />
          </div>
        </div>

        {/* Lower Banner: Dark Plum Glimpse of the Games Card */}
        <div className="mt-4 sm:mt-6 md:mt-8 rounded-3xl bg-[#181126] border border-[#2F1D4F] shadow-2xl shadow-black/40 p-5 sm:p-7 text-white overflow-hidden">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left Header & Mode Selector */}
            <div className="flex flex-col gap-3 max-w-sm shrink-0">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#A855F7] animate-pulse" />
                <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight font-heading text-white">
                  Better-Half
                </h2>
              </div>
              <p className="text-xs sm:text-sm text-[#A79BBF] leading-relaxed">
                A glimpse of the games and experience.
              </p>

              {/* Mode Toggle Pills */}
              <div className="inline-flex items-center gap-2 p-1.5 rounded-2xl bg-[#23153C] border border-[#3B255D] self-start mt-1">
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setPreviewMode('couple');
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    previewMode === 'couple'
                      ? 'bg-[#DB2777] text-white shadow-md shadow-pink-900/30'
                      : 'text-[#A79BBF] hover:text-white'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 fill-current text-pink-200" />
                  <span>Couple</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setPreviewMode('friend');
                  }}
                  className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    previewMode === 'friend'
                      ? 'bg-[#7C3AED] text-white shadow-md shadow-purple-900/30'
                      : 'text-[#A79BBF] hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-purple-200" />
                  <span>Friends</span>
                </button>
              </div>
            </div>

            {/* Right Fan of 5 Game Cards matching reference artwork */}
            <div className="w-full lg:w-auto flex items-center justify-start lg:justify-end gap-3 sm:gap-4 overflow-x-auto pb-2 pt-2 scrollbar-none">
              {/* 1. UNO Card */}
              <div
                onClick={() => navigate('/dashboard')}
                className="shrink-0 w-28 sm:w-32 h-38 sm:h-44 rounded-2xl bg-gradient-to-b from-[#DC2626] via-[#B91C1C] to-[#7F1D1D] p-3 flex flex-col justify-between shadow-xl shadow-red-950/50 border border-red-500/40 hover:-translate-y-2 hover:rotate-1 transition-all cursor-pointer select-none -rotate-2"
                title="Play Original UNO Card Game"
              >
                <div className="w-full flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-red-200">
                  <span>Card</span>
                  <span className="w-2 h-2 rounded-full bg-yellow-400" />
                </div>
                <div className="my-auto text-center">
                  <div className="inline-block bg-yellow-400 text-red-700 font-black text-2xl tracking-tighter px-3 py-1 rounded-full shadow-md transform -rotate-6 border border-yellow-200">
                    UNO
                  </div>
                </div>
                <div className="flex justify-center items-center gap-1 pt-1">
                  <span className="w-3.5 h-5 rounded-xs bg-green-500 border border-white/60 -rotate-12 shadow-xs" />
                  <span className="w-3.5 h-5 rounded-xs bg-blue-500 border border-white/60 -rotate-3 shadow-xs" />
                  <span className="w-3.5 h-5 rounded-xs bg-red-500 border border-white/60 rotate-6 shadow-xs" />
                  <span className="w-3.5 h-5 rounded-xs bg-yellow-400 border border-white/60 rotate-12 shadow-xs" />
                </div>
              </div>

              {/* 2. Tic Tac Toe Card */}
              <div
                onClick={() => navigate('/dashboard')}
                className="shrink-0 w-28 sm:w-32 h-38 sm:h-44 rounded-2xl bg-gradient-to-b from-[#1E1B4B] via-[#2A1D4E] to-[#160E2E] p-3 flex flex-col justify-between shadow-xl shadow-indigo-950/50 border border-indigo-500/40 hover:-translate-y-2 hover:-rotate-1 transition-all cursor-pointer select-none -rotate-1"
                title="Play Tic Tac Toe"
              >
                <div className="w-full flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-indigo-300">
                  <span>Duel</span>
                  <span className="text-[10px] text-pink-400">1v1</span>
                </div>
                <div className="my-auto grid grid-cols-2 gap-2 text-center font-mono font-black text-base leading-none text-white tracking-widest px-2">
                  <span className="text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]">✕</span>
                  <span className="text-pink-400 drop-shadow-[0_0_6px_rgba(244,114,182,0.8)]">◯</span>
                  <span className="text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]">✕</span>
                  <span className="text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]">✕</span>
                  <span className="text-pink-400 drop-shadow-[0_0_6px_rgba(244,114,182,0.8)]">◯</span>
                  <span className="text-white drop-shadow-[0_0_6px_rgba(255,255,255,0.6)]">✕</span>
                </div>
                <div className="flex justify-between items-center text-[10px] text-indigo-300 font-semibold">
                  <span>Series</span>
                  <span className="text-pink-300 font-bold">2P+</span>
                </div>
              </div>

              {/* 3. Basketball Rivalry Card */}
              <div
                onClick={() => navigate('/dashboard')}
                className="shrink-0 w-28 sm:w-32 h-38 sm:h-44 rounded-2xl bg-gradient-to-b from-[#EA580C] via-[#C2410C] to-[#7C2D12] p-3 flex flex-col justify-between shadow-xl shadow-orange-950/50 border border-orange-500/40 hover:-translate-y-2 hover:rotate-2 transition-all cursor-pointer select-none rotate-1"
                title="Play Basketball Rivalry"
              >
                <div className="w-full flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-orange-200">
                  <span>Sports</span>
                  <span className="w-2 h-2 rounded-full bg-orange-300" />
                </div>
                <div className="my-auto flex flex-col items-center">
                  <div className="text-3xl drop-shadow-md">🏀</div>
                  <div className="w-8 h-2 border-t-2 border-dashed border-white/60 mt-1" />
                </div>
                <div className="flex justify-between items-center text-[10px] text-orange-200 font-semibold">
                  <span>Hoops</span>
                  <span className="font-bold text-orange-100">Shoot</span>
                </div>
              </div>

              {/* 4. Pen Fight / 8-Ball Card */}
              <div
                onClick={() => navigate('/dashboard')}
                className="shrink-0 w-28 sm:w-32 h-38 sm:h-44 rounded-2xl bg-gradient-to-b from-[#16A34A] via-[#15803D] to-[#14532D] p-3 flex flex-col justify-between shadow-xl shadow-green-950/50 border border-emerald-500/40 hover:-translate-y-2 hover:-rotate-2 transition-all cursor-pointer select-none rotate-2"
                title="Play Pen Fight / Arena"
              >
                <div className="w-full flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-emerald-200">
                  <span>Physics</span>
                  <span className="text-[10px] text-emerald-300 font-bold">Arena</span>
                </div>
                <div className="my-auto flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-full bg-black border-2 border-neutral-700 flex items-center justify-center shadow-lg shadow-black/60 relative">
                    <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center font-bold text-black text-xs">
                      8
                    </div>
                    <div className="absolute top-1 left-2 w-3 h-1.5 bg-white/40 rounded-full rotate-45 blur-[0.5px]" />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-emerald-200 font-semibold">
                  <span>Battle</span>
                  <span className="font-bold text-emerald-100">Flick</span>
                </div>
              </div>

              {/* 5. Between Us / Questions Card */}
              <div
                onClick={() => navigate('/dashboard')}
                className="shrink-0 w-28 sm:w-32 h-38 sm:h-44 rounded-2xl bg-gradient-to-b from-[#7C3AED] via-[#6D28D9] to-[#4C1D95] p-3 flex flex-col justify-between shadow-xl shadow-purple-950/50 border border-purple-500/40 hover:-translate-y-2 hover:rotate-1 transition-all cursor-pointer select-none rotate-3"
                title="Play Between Us Questions"
              >
                <div className="w-full flex justify-between items-center text-[10px] font-bold uppercase tracking-wider text-purple-200">
                  <span>{previewMode === 'couple' ? 'Couple' : 'Trivia'}</span>
                  <Heart className="w-3 h-3 text-pink-300 fill-current" />
                </div>
                <div className="my-auto flex flex-col items-center justify-center">
                  <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-500 border border-amber-200/80 shadow-md shadow-amber-950/40 flex items-center justify-center font-black text-amber-900 text-xl">
                    ?
                  </div>
                </div>
                <div className="flex justify-between items-center text-[10px] text-purple-200 font-semibold">
                  <span>Cards</span>
                  <span className="font-bold text-amber-300">Prompt</span>
                </div>
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
      />
    </section>
  );
};

