import React from 'react';
import { Heart, Users, PlusCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { useAuth } from '../../context/AuthContext';

interface WelcomeBannerProps {
  activeMode: 'couple' | 'friend';
  onOpenRoomModal: () => void;
}

export const WelcomeBanner: React.FC<WelcomeBannerProps> = ({
  activeMode,
  onOpenRoomModal,
}) => {
  const { user } = useAuth();
  const isCouple = activeMode === 'couple';

  return (
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-[#593B91] via-[#6C42B3] to-[#9670E8] text-white p-6 sm:p-8 md:p-10 shadow-lg shadow-[#593B91]/15 mb-8">
      {/* Decorative ambient background */}
      <div
        className="absolute -right-16 -top-16 w-80 h-80 bg-white/10 rounded-full blur-2xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -left-16 -bottom-16 w-60 h-60 bg-[#9670E8]/30 rounded-full blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="flex flex-col gap-3 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 rounded-full bg-white/20 backdrop-blur-xs text-xs font-semibold text-white flex items-center gap-1.5">
              {isCouple ? (
                <>
                  <Heart className="w-3.5 h-3.5 fill-current text-pink-300" />
                  Couple Mode Active • 2 Players
                </>
              ) : (
                <>
                  <Users className="w-3.5 h-3.5 text-purple-200" />
                  Friend Mode Active • Up to 4 Players
                </>
              )}
            </span>
            <span className="text-xs text-purple-200 hidden sm:inline">•</span>
            <span className="text-xs text-purple-200 hidden sm:inline">11 Games Ready</span>
          </div>

          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white leading-tight">
            Ready for your next game, {user?.name?.split(' ')[0] || 'Player'}?
          </h1>

          <p className="text-sm sm:text-base text-purple-100 max-w-xl leading-relaxed">
            Pick your mode, bring your people, and make the moment fun. Browse our
            11 handcrafted games below or configure a match preview.
          </p>
        </div>

        {/* Action Button */}
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <Button
            variant="outline"
            size="md"
            onClick={onOpenRoomModal}
            leftIcon={<PlusCircle className="w-4 h-4 text-[#593B91]" />}
            className="w-full sm:w-auto bg-white text-[#593B91] hover:bg-white/95 border-none shadow-md font-bold"
          >
            Create Match Room
          </Button>
        </div>
      </div>
    </div>
  );
};
