import React from 'react';
import { EyeOff, Smartphone, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar } from '../ui/Avatar';

interface PassDeviceScreenProps {
  targetPlayerName?: string;
  nextPlayerName?: string;
  targetPlayerInitials?: string;
  targetPlayerColor?: string;
  roundTitle?: string;
  onReady: () => void;
  message?: string;
  instruction?: string;
}

export const PassDeviceScreen: React.FC<PassDeviceScreenProps> = ({
  targetPlayerName,
  nextPlayerName,
  targetPlayerInitials = 'PL',
  targetPlayerColor = 'bg-[#9670E8]',
  roundTitle,
  onReady,
  message,
  instruction,
}) => {
  const name = targetPlayerName || nextPlayerName || 'Next Player';
  const desc = instruction || message || 'Keep the screen turned away from other players to preserve secret answers.';
  return (
    <div className="max-w-md mx-auto my-8 p-6 sm:p-8 rounded-3xl bg-white border border-[#EAE3F3] shadow-lg shadow-[#593B91]/5 text-center flex flex-col items-center gap-5 animate-in fade-in zoom-in-95 duration-200">
      <div className="w-16 h-16 rounded-3xl bg-gradient-to-br from-[#F1EAFF] to-[#E8DCFF] text-[#593B91] flex items-center justify-center shadow-xs">
        <Smartphone className="w-8 h-8 text-[#9670E8]" />
      </div>

      <div className="flex flex-col items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-widest text-[#9670E8] flex items-center gap-1.5">
          <EyeOff className="w-3.5 h-3.5" />
          {roundTitle || 'Pass-Device Privacy Shield'}
        </span>
        <h2 className="text-2xl font-extrabold text-[#211A2D]">
          Pass to {name}
        </h2>
        <p className="text-xs sm:text-sm text-[#756D82] max-w-xs leading-relaxed">
          {desc}
        </p>
      </div>

      <div className="flex items-center gap-2.5 p-3 rounded-2xl bg-[#FCFAFF] border border-[#EAE3F3] w-full justify-center">
        <Avatar
          name={name}
          initials={targetPlayerInitials}
          bgColor={targetPlayerColor}
          size="sm"
        />
        <span className="text-xs font-bold text-[#211A2D]">
          {name}'s Private Turn
        </span>
      </div>

      <Button
        variant="primary"
        size="lg"
        onClick={onReady}
        rightIcon={<ArrowRight className="w-4 h-4" />}
        className="w-full justify-center font-bold shadow-md shadow-[#593B91]/15"
      >
        I Am {targetPlayerName} — Start Turn
      </Button>
    </div>
  );
};
