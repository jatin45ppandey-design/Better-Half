import React from 'react';
import { Heart, Users, Check } from 'lucide-react';
import { MODES_DATA } from '../../data/games';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';

interface ModeSelectorProps {
  activeMode: 'couple' | 'friend';
  onSelectMode: (mode: 'couple' | 'friend') => void;
  onOpenRoomModal: (mode: 'couple' | 'friend') => void;
}

export const ModeSelector: React.FC<ModeSelectorProps> = ({
  activeMode,
  onSelectMode,
  onOpenRoomModal,
}) => {
  return (
    <div className="mb-12">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 mb-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-[#211A2D]">
            Select Experience Mode
          </h2>
          <p className="text-xs sm:text-sm text-[#756D82] mt-0.5">
            Switch your active view to filter games curated for intimate duos or group parties.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MODES_DATA.map((mode) => {
          const isCouple = mode.id === 'couple';
          const isActive = activeMode === mode.id;

          return (
            <div
              key={mode.id}
              className={`relative rounded-3xl p-6 sm:p-7 border-2 transition-all duration-200 flex flex-col justify-between ${
                isActive
                  ? isCouple
                    ? 'border-[#F472B6] bg-gradient-to-br from-[#FFF5F8] to-[#FCFAFF] shadow-md shadow-[#F472B6]/10'
                    : 'border-[#9670E8] bg-gradient-to-br from-[#F8F4FF] to-[#FCFAFF] shadow-md shadow-[#9670E8]/10'
                  : 'border-[#EAE3F3] bg-white hover:border-[#D5C7EE]'
              }`}
            >
              {/* Active Badge */}
              {isActive && (
                <div className="absolute -top-3 right-6">
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-white shadow-xs ${
                      isCouple ? 'bg-[#DB2777]' : 'bg-[#593B91]'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    Active Mode
                  </span>
                </div>
              )}

              <div>
                {/* Header Icon + Player Count */}
                <div className="flex items-center justify-between mb-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                      isCouple
                        ? 'bg-[#FDF2F8] text-[#9D174D]'
                        : 'bg-[#F1EAFF] text-[#593B91]'
                    }`}
                  >
                    {isCouple ? (
                      <Heart className="w-6 h-6 fill-current" />
                    ) : (
                      <Users className="w-6 h-6" />
                    )}
                  </div>
                  <Badge variant={isCouple ? 'pink' : 'lavender'} size="sm">
                    {mode.playerCount}
                  </Badge>
                </div>

                <h3 className="text-xl font-bold text-[#211A2D] mb-1">
                  {mode.name}
                </h3>
                <p className="text-xs font-semibold text-[#593B91] mb-2">
                  {mode.tagline}
                </p>
                <p className="text-xs sm:text-sm text-[#756D82] leading-relaxed mb-5">
                  {mode.description}
                </p>

                {/* Key feature pills */}
                <div className="flex flex-wrap gap-2 mb-6">
                  {mode.highlights.slice(0, 2).map((item, idx) => (
                    <span
                      key={idx}
                      className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-white border border-[#EAE3F3] text-[#756D82]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-[#F4EFFB]">
                <Button
                  variant={isActive ? (isCouple ? 'secondary' : 'lavender') : 'outline'}
                  size="sm"
                  onClick={() => onSelectMode(mode.id)}
                  className="flex-1 font-bold"
                >
                  {isActive ? 'Mode Selected' : `Choose ${mode.name}`}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onOpenRoomModal(mode.id)}
                  className="text-xs text-[#593B91]"
                >
                  Room Preview
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
