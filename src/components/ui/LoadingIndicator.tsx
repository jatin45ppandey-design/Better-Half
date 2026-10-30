import React from 'react';
import { Loader2 } from 'lucide-react';

export interface LoadingIndicatorProps {
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  label = 'Loading...',
  size = 'md',
  className = '',
}) => {
  const iconSizes = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }[size];

  return (
    <div className={`flex flex-col items-center justify-center gap-3 p-6 text-[#593B91] ${className}`}>
      <Loader2 className={`${iconSizes} animate-spin text-[#9670E8]`} />
      {label && <p className="text-xs sm:text-sm font-medium text-[#756D82]">{label}</p>}
    </div>
  );
};
