import React from 'react';
import { Sparkles } from 'lucide-react';
import { Button } from './Button';

export interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-8 sm:p-12 rounded-2xl border border-dashed border-[#EAE3F3] bg-[#FCFAFF] max-w-md mx-auto ${className}`}
    >
      <div className="w-12 h-12 rounded-2xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center mb-4 shadow-sm">
        {icon || <Sparkles className="w-6 h-6 text-[#9670E8]" />}
      </div>
      <h3 className="text-lg font-bold text-[#211A2D] mb-1.5">{title}</h3>
      <p className="text-sm text-[#756D82] leading-relaxed mb-5 max-w-xs">{description}</p>
      {actionLabel && onAction && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};
