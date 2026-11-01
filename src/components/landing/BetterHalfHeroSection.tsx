import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  ArrowRight,
  ChevronRight,
  Heart,
  Users,
} from 'lucide-react';
import { soundService } from '../../services/soundService';

export const BetterHalfHeroSection: React.FC = () => {
  const [previewMode, setPreviewMode] = useState<'couple' | 'friend'>('couple');

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleGameClick = () => {
    soundService.playClick();
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/login', { state: { from: '/dashboard' } });
    }
  };

  return (
    <section className="relative pt-2 pb-6 sm:pt-4 sm:pb-8 overflow-hidden bg-transparent">
      {/* Soft atmospheric ambient glow */}
      <div
        className="absolute top-0 left-1/2 -translate-x-1/2 w-[850px] h-[380px] bg-gradient-to-tr from-[#E9D5FF]/40 via-[#DDD6FE]/25 to-[#F3E8FF]/30 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Hero: Headline + CTAs + Standalone Visual */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-center min-h-[380px]">
          {/* Left Hero Content */}
          <div className="lg:col-span-6 flex flex-col items-start text-left gap-4 sm:gap-5 z-10">
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
              {isAuthenticated ? (
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    navigate('/dashboard');
                  }}
                  className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-base font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] shadow-lg shadow-purple-900/25 active:scale-[0.98] transition-all cursor-pointer"
                >
                  <span>Open Dashboard</span>
                  <ArrowRight className="w-4 h-4 ml-2" />
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      navigate('/signup');
                    }}
                    className="inline-flex items-center justify-center px-7 py-3.5 rounded-full text-base font-bold text-white bg-[#7C3AED] hover:bg-[#6D28D9] shadow-lg shadow-purple-900/25 active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <span>Get Started</span>
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      soundService.playClick();
                      navigate('/login');
                    }}
                    className="inline-flex items-center justify-center px-6 py-3.5 rounded-full text-base font-bold text-[#7C3AED] bg-white/90 hover:bg-white border-2 border-[#7C3AED]/30 hover:border-[#7C3AED] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                  >
                    <span>Sign In</span>
                    <ChevronRight className="w-4 h-4 ml-1.5" />
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Right Hero Visual: Standalone Couple Illustration (Transparent, Clean, Seamless) */}
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
        <div className="mt-2 sm:mt-4 lg:-mt-1 rounded-3xl bg-[#20132E] border border-[#3A2255] shadow-2xl shadow-black/40 p-5 sm:p-7 text-white overflow-hidden relative">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            {/* Left Header & Mode Selector */}
            <div className="flex flex-col gap-2.5 max-w-sm shrink-0">
              <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-white">
                Better-Half
              </h2>
              <p className="text-xs sm:text-sm text-[#A79BBF] leading-relaxed">
                A glimpse of the games and experience.
              </p>

              {/* Mode Toggle Pills */}
              <div className="flex items-center gap-3 mt-1.5">
                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setPreviewMode('couple');
                  }}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    previewMode === 'couple'
                      ? 'bg-[#A33D76] text-white shadow-md shadow-pink-950/40 ring-1 ring-pink-400/30'
                      : 'bg-[#2D1B42] text-[#A79BBF] hover:text-white'
                  }`}
                >
                  <Heart className="w-3.5 h-3.5 fill-current text-pink-300" />
                  <span>Couple</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    soundService.playClick();
                    setPreviewMode('friend');
                  }}
                  className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer ${
                    previewMode === 'friend'
                      ? 'bg-[#5B2E8A] text-white shadow-md shadow-purple-950/40 ring-1 ring-purple-400/30'
                      : 'bg-[#2D1B42] text-[#A79BBF] hover:text-white'
                  }`}
                >
                  <Users className="w-3.5 h-3.5 text-purple-300" />
                  <span>Friends</span>
                </button>
              </div>
            </div>

            {/* Right Fan of 5 Game Cards matching reference artwork */}
            <div className="relative w-full lg:w-auto flex items-center justify-center lg:justify-end shrink-0">
              <div className="relative group max-w-[560px] w-full">
                <img
                  src="/better-half-game-cards.png"
                  alt="Multiplayer game cards: UNO, Tic-Tac-Toe, Basketball Rivalry, 8-Ball Pool, and Question Cards"
                  className="w-full h-auto object-contain select-none transition-transform duration-300 group-hover:scale-[1.01]"
                />
                {/* Interactive Click Hotspots for the 5 games */}
                <div className="absolute inset-0 grid grid-cols-5 pointer-events-auto">
                  <button
                    type="button"
                    onClick={handleGameClick}
                    className="w-full h-full cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
                    title="Play UNO Card Game"
                    aria-label="Play UNO Card Game"
                  />
                  <button
                    type="button"
                    onClick={handleGameClick}
                    className="w-full h-full cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
                    title="Play Tic-Tac-Toe Duel"
                    aria-label="Play Tic-Tac-Toe Duel"
                  />
                  <button
                    type="button"
                    onClick={handleGameClick}
                    className="w-full h-full cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
                    title="Play Basketball Rivalry"
                    aria-label="Play Basketball Rivalry"
                  />
                  <button
                    type="button"
                    onClick={handleGameClick}
                    className="w-full h-full cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
                    title="Play 8-Ball Pool & Arena"
                    aria-label="Play 8-Ball Pool & Arena"
                  />
                  <button
                    type="button"
                    onClick={handleGameClick}
                    className="w-full h-full cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
                    title={previewMode === 'couple' ? 'Play Between Us Questions' : 'Play Trivia Cards'}
                    aria-label={previewMode === 'couple' ? 'Play Between Us Questions' : 'Play Trivia Cards'}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
