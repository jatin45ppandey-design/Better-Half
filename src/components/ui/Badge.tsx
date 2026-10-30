import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'lavender' | 'purple' | 'subtle' | 'outline' | 'success' | 'warning' | 'pink';
  size?: 'sm' | 'md';
  icon?: React.ReactNode;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = 'lavender',
  size = 'md',
  icon,
  className = '',
  ...props
}) => {
  const sizeStyles = {
    sm: 'text-[11px] px-2 py-0.5 gap-1 font-medium',
    md: 'text-xs px-2.5 py-1 gap-1.5 font-medium',
  }[size];

  const variantStyles = {
    lavender: 'bg-[#F1EAFF] text-[#593B91] border border-[#E3D6FA]',
    purple: 'bg-[#593B91] text-white',
    subtle: 'bg-[#F8F4FF] text-[#756D82] border border-[#EAE3F3]',
    outline: 'bg-white text-[#593B91] border border-[#D5C7EE]',
    success: 'bg-[#EBF7F2] text-[#248A62] border border-[#C6ECD9]',
    warning: 'bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A]',
    pink: 'bg-[#FDF2F8] text-[#9D174D] border border-[#FCE7F3]',
  }[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full transition-colors select-none ${sizeStyles} ${variantStyles} ${className}`}
      {...props}
    >
      {icon && <span className="shrink-0">{icon}</span>}
      <span>{children}</span>
    </span>
  );
};
