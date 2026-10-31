import React from 'react';
import { Heart, Users, Check } from 'lucide-react';
import { soundService } from '../../services/soundService';

interface ModeSelectorProps {
  activeMode: 'couple' | 'friend';
  onSelectMode: (mode: 'couple' | 'friend') => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  activeMode,
  onSelectMode,
}) => {
  return (
    <div className="mb-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg sm:text-xl font-bold font-heading text-white flex items-center gap-2">
            <span>Experience Mode</span>
            <span className="text-xs font-normal text-[#A79BBF]">
              (Select to filter games)
            </span>
          </h2>
          <p className="text-xs text-[#A79BBF]">
            Switch between intimate 2-player duels or 2–4 player party sessions.
          </p>
        </div>
      </div>

      {/* Dual Mode Selector Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Couple Mode Card */}
        <div
          onClick={() => {
            soundService.playClick();
            onSelectMode('couple');
          }}
          className={`relative rounded-3xl p-5 sm:p-6 border-2 transition-all duration-200 flex flex-col justify-between cursor-pointer select-none ${
            activeMode === 'couple'
              ? 'border-[#EC4899] bg-gradient-to-br from-[#2D122B] to-[#1A0E26] shadow-xl shadow-pink-950/30'
              : 'border-[#2D1B48] bg-[#160E25] hover:border-[#4B2F73]'
          }`}
        >
          {activeMode === 'couple' && (
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#DB2777] text-white shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
                Active
              </span>
            </div>
          )}

          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  activeMode === 'couple'
                    ? 'bg-[#DB2777] text-white shadow-md shadow-pink-900/40'
                    : 'bg-[#291638] text-[#EC4899]'
                }`}
              >
                <Heart className="w-5 h-5 fill-current" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-heading">
                  Couple Mode
                </h3>
                <span className="text-[11px] font-semibold text-[#F472B6]">
                  Strictly 2 Players
                </span>
              </div>
            </div>

            <p className="text-xs text-[#A79BBF] leading-relaxed mb-3">
              Intimate questions, deep conversation decks, and cozy partner duels.
            </p>

            <div className="flex flex-wrap gap-1.5 text-[10px] font-medium text-[#F472B6]">
              <span className="px-2 py-0.5 rounded-lg bg-[#3B1736] border border-[#5E2456]">
                BETWEEN US
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#3B1736] border border-[#5E2456]">
                Truth or Dare
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#3B1736] border border-[#5E2456]">
                Would You Rather
              </span>
            </div>
          </div>
        </div>

        {/* Friend Mode Card */}
        <div
          onClick={() => {
            soundService.playClick();
            onSelectMode('friend');
          }}
          className={`relative rounded-3xl p-5 sm:p-6 border-2 transition-all duration-200 flex flex-col justify-between cursor-pointer select-none ${
            activeMode === 'friend'
              ? 'border-[#A855F7] bg-gradient-to-br from-[#23123D] to-[#150D24] shadow-xl shadow-purple-950/30'
              : 'border-[#2D1B48] bg-[#160E25] hover:border-[#4B2F73]'
          }`}
        >
          {activeMode === 'friend' && (
            <div className="absolute top-4 right-4">
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#9333EA] text-white shadow-xs">
                <Check className="w-3 h-3 stroke-[3]" />
                Active
              </span>
            </div>
          )}

          <div>
            <div className="flex items-center gap-3 mb-3">
              <div
                className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                  activeMode === 'friend'
                    ? 'bg-[#9333EA] text-white shadow-md shadow-purple-900/40'
                    : 'bg-[#211438] text-[#C084FC]'
                }`}
              >
                <Users className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white font-heading">
                  Friend Mode
                </h3>
                <span className="text-[11px] font-semibold text-[#C084FC]">
                  2 to 4 Players
                </span>
              </div>
            </div>

            <p className="text-xs text-[#A79BBF] leading-relaxed mb-3">
              Fast-paced card games, arcade physics showdowns, and opinion clashes.
            </p>

            <div className="flex flex-wrap gap-1.5 text-[10px] font-medium text-[#C084FC]">
              <span className="px-2 py-0.5 rounded-lg bg-[#2B184A] border border-[#48287A]">
                UNO-style Card Game
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#2B184A] border border-[#48287A]">
                Kabza Strategy
              </span>
              <span className="px-2 py-0.5 rounded-lg bg-[#2B184A] border border-[#48287A]">
                Basketball & Pen Fight
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
