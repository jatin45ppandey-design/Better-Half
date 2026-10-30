import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Heart, Users, CheckCircle2, Flame, RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

export const HeroSection: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'couple' | 'friend'>('couple');
  const [revealed, setRevealed] = useState(false);

  return (
    <section className="relative overflow-hidden pt-10 pb-16 md:pt-16 md:pb-24 bg-gradient-to-b from-[#FCFAFF] via-[#F8F4FF]/70 to-[#FCFAFF]">
      {/* Decorative ambient gradients */}
      <div
        className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[650px] h-[350px] bg-gradient-to-tr from-[#F1EAFF]/60 to-[#E8DCFF]/40 rounded-full blur-3xl pointer-events-none -z-10"
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: Headlines & CTA */}
          <div className="lg:col-span-7 flex flex-col items-start gap-6 text-left">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#F1EAFF] border border-[#E3D6FA] text-[#593B91] text-xs font-semibold shadow-xs">
              <Sparkles className="w-4 h-4 text-[#9670E8]" />
              <span>Phase 1 Frontend • 11 Games for Couples & Friends</span>
            </div>

            <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight text-[#211A2D] leading-[1.12]">
              Good Times.{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#593B91] via-[#9670E8] to-[#784ED9]">
                Better Games.
              </span>{' '}
              Together.
            </h1>

            <p className="text-base sm:text-lg md:text-xl text-[#756D82] max-w-xl leading-relaxed">
              Bring your favourite people together with playful games made for couples and friends.
              Zero downloads, instant browser lobbies, and unforgettable memories.
            </p>

            {/* CTAs */}
            <div className="flex flex-wrap items-center gap-3.5 w-full sm:w-auto">
              <Link to="/signup" className="w-full sm:w-auto">
                <Button
                  variant="primary"
                  size="lg"
                  rightIcon={<ArrowRight className="w-5 h-5" />}
                  className="w-full sm:w-auto shadow-md shadow-[#593B91]/20 hover:shadow-lg"
                >
                  Play Now
                </Button>
              </Link>
              <a href="#games" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto">
                  Explore 11 Games
                </Button>
              </a>
            </div>

            {/* Feature Pills */}
            <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[#756D82]">
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#248A62]" />
                Pass-and-play or private link
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#248A62]" />
                2 to 4 Players supported
              </span>
              <span className="flex items-center gap-1.5 font-medium">
                <CheckCircle2 className="w-4 h-4 text-[#248A62]" />
                No app installation required
              </span>
            </div>
          </div>

          {/* Right Column: Visual Preview of the Gaming Experience (No External Images) */}
          <div className="lg:col-span-5 w-full">
            <div className="relative mx-auto max-w-md w-full bg-white rounded-3xl border border-[#EAE3F3] shadow-xl shadow-[#593B91]/8 p-5 sm:p-6 transition-all">
              {/* Top bar with mode selector preview */}
              <div className="flex items-center justify-between pb-4 border-b border-[#F4EFFB] mb-4">
                <div className="flex items-center gap-1.5 bg-[#F8F4FF] p-1 rounded-xl border border-[#EAE3F3]">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('couple');
                      setRevealed(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      activeTab === 'couple'
                        ? 'bg-white text-[#9D174D] shadow-xs'
                        : 'text-[#756D82] hover:text-[#211A2D]'
                    }`}
                  >
                    <Heart className="w-3.5 h-3.5 fill-current" />
                    Couple
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab('friend');
                      setRevealed(false);
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                      activeTab === 'friend'
                        ? 'bg-white text-[#593B91] shadow-xs'
                        : 'text-[#756D82] hover:text-[#211A2D]'
                    }`}
                  >
                    <Users className="w-3.5 h-3.5" />
                    Friends
                  </button>
                </div>
                <Badge variant="success" size="sm">
                  Live Preview
                </Badge>
              </div>

              {/* Simulated Game Duel Box */}
              {activeTab === 'couple' ? (
                <div className="flex flex-col gap-4">
                  {/* Game Title Tag */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#9D174D] uppercase tracking-wider">
                      Game 11 • BETWEEN US
                    </span>
                    <span className="text-xs text-[#756D82]">Round 3 of 10</span>
                  </div>

                  {/* Active Question Prompt Card */}
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#FDF2F8] to-[#F1EAFF] border border-[#FBCFE8]/60 text-center flex flex-col items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white text-[#9D174D] flex items-center justify-center shadow-xs">
                      <Heart className="w-4 h-4 fill-current" />
                    </div>
                    <span className="text-[11px] font-bold text-[#9D174D] tracking-wide uppercase">
                      Deep Spark Prompt
                    </span>
                    <p className="text-sm sm:text-base font-semibold text-[#211A2D] leading-snug">
                      {revealed
                        ? '"What is a sweet habit of mine that quietly makes your entire day brighter?"'
                        : '"Tap below to reveal your partner\'s private question for this round..."'}
                    </p>
                  </div>

                  {/* Interactive Button */}
                  <Button
                    variant="lavender"
                    size="sm"
                    className="w-full"
                    onClick={() => setRevealed(!revealed)}
                    leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                  >
                    {revealed ? 'Shuffle Another Prompt' : 'Reveal Question'}
                  </Button>

                  {/* Player Statuses */}
                  <div className="pt-2 border-t border-[#F4EFFB] grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F8F4FF]">
                      <div className="w-7 h-7 rounded-full bg-[#9670E8] text-white flex items-center justify-center font-bold text-xs">
                        A
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#211A2D]">Alex</span>
                        <span className="text-[10px] text-[#248A62] font-semibold">Turn Active</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 p-2 rounded-xl bg-[#F8F4FF]">
                      <div className="w-7 h-7 rounded-full bg-[#D94C65] text-white flex items-center justify-center font-bold text-xs">
                        S
                      </div>
                      <div className="flex flex-col">
                        <span className="font-bold text-[#211A2D]">Sam</span>
                        <span className="text-[10px] text-[#756D82]">Listening...</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {/* Friend Mode Preview */}
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#593B91] uppercase tracking-wider">
                      Game 1 • Truth or Dare
                    </span>
                    <span className="text-xs text-[#756D82]">4 Players • Free-for-all</span>
                  </div>

                  <div className="p-4 rounded-2xl bg-gradient-to-br from-[#F5F3FF] to-[#EDE9FE] border border-[#DDD6FE] text-center flex flex-col items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-white text-[#593B91] flex items-center justify-center shadow-xs">
                      <Flame className="w-4 h-4 text-[#D94C65]" />
                    </div>
                    <span className="text-[11px] font-bold text-[#593B91] tracking-wide uppercase">
                      Dare of the Round
                    </span>
                    <p className="text-sm sm:text-base font-semibold text-[#211A2D] leading-snug">
                      {revealed
                        ? '"Do your best impression of another player until someone correctly guesses who it is!"'
                        : '"Spin the wheel to assign this dare to one of your group..."'}
                    </p>
                  </div>

                  <Button
                    variant="primary"
                    size="sm"
                    className="w-full"
                    onClick={() => setRevealed(!revealed)}
                    leftIcon={<Flame className="w-3.5 h-3.5" />}
                  >
                    {revealed ? 'Pick Next Dare' : 'Spin for Dare'}
                  </Button>

                  {/* 4 Players Bar */}
                  <div className="pt-2 border-t border-[#F4EFFB] grid grid-cols-4 gap-1.5 text-center text-[10px]">
                    {['Maya (3 pts)', 'Leo (5 pts)', 'Zara (4 pts)', 'Kai (2 pts)'].map((p, i) => (
                      <div
                        key={p}
                        className={`p-1.5 rounded-lg border ${
                          i === 1
                            ? 'bg-[#F1EAFF] border-[#D5C7EE] font-bold text-[#593B91]'
                            : 'bg-[#FCFAFF] border-[#EAE3F3] text-[#756D82]'
                        }`}
                      >
                        {p}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
