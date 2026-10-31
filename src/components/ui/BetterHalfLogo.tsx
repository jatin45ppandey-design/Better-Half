import React from 'react';

interface BetterHalfLogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  variant?: 'light' | 'dark' | 'auto';
}

export const BetterHalfLogo: React.FC<BetterHalfLogoProps> = ({
  className = '',
  size = 'md',
  showText = true,
  variant = 'auto',
}) => {
  const iconSizes = {
    sm: 'w-7 h-7',
    md: 'w-9 h-9',
    lg: 'w-11 h-11',
    xl: 'w-14 h-14',
  }[size];

  const textSizes = {
    sm: 'text-base',
    md: 'text-lg',
    lg: 'text-2xl',
    xl: 'text-3xl',
  }[size];

  const textColorClass =
    variant === 'dark'
      ? 'text-white'
      : variant === 'light'
      ? 'text-[#1E1035]'
      : 'text-[#1E1035]';

  return (
    <div className={`inline-flex items-center gap-2.5 select-none ${className}`}>
      {/* Interlinked Hearts Icon Mark */}
      <div
        className={`${iconSizes} rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#7C3AED] to-[#581C87] flex items-center justify-center p-1.5 shadow-md shadow-purple-900/15 shrink-0 transition-transform group-hover:scale-105`}
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full text-white"
        >
          {/* Dual interlocking hearts / infinity union */}
          <path
            d="M14.5 10C11.5 10 9 12.5 9 15.5C9 19.5 14.5 24 20 28.5C25.5 24 31 19.5 31 15.5C31 12.5 28.5 10 25.5 10C23 10 21 11.5 20 13C19 11.5 17 10 14.5 10Z"
            fill="currentColor"
            fillOpacity="0.25"
          />
          <path
            d="M13.5 12C11 12 9 14 9 16.5C9 20 13.5 24 18 28C19 28.9 19.7 29.5 20 29.8C20.3 29.5 21 28.9 22 28C26.5 24 31 20 31 16.5C31 14 29 12 26.5 12C24.2 12 22.2 13.5 21.2 15.2C20.7 16 19.3 16 18.8 15.2C17.8 13.5 15.8 12 13.5 12Z"
            stroke="white"
            strokeWidth="3.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="15.5" cy="18" r="2.2" fill="white" />
          <circle cx="24.5" cy="18" r="2.2" fill="white" />
        </svg>
      </div>

      {showText && (
        <span
          className={`font-extrabold tracking-tight font-heading ${textSizes} ${textColorClass}`}
        >
          Better-Half
        </span>
      )}
    </div>
  );
};

