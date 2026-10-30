import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'lavender' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = '',
      variant = 'primary',
      size = 'md',
      isLoading = false,
      disabled,
      leftIcon,
      rightIcon,
      type = 'button',
      ...props
    },
    ref
  ) => {
    // Base styles
    const baseStyles =
      'inline-flex items-center justify-center font-medium transition-all duration-200 select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9670E8] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer';

    // Size variants
    const sizeStyles = {
      sm: 'text-xs px-3 py-1.5 gap-1.5 min-h-[32px]',
      md: 'text-sm px-4 py-2.5 gap-2 min-h-[42px]',
      lg: 'text-base px-6 py-3.5 gap-2.5 min-h-[50px] font-semibold',
      icon: 'p-2 min-h-[40px] min-w-[40px] rounded-xl',
    }[size];

    // Variant styles
    const variantStyles = {
      primary:
        'bg-[#593B91] text-white hover:bg-[#4D2F82] shadow-sm shadow-[#593B91]/15 active:bg-[#3E246D]',
      secondary:
        'bg-[#F1EAFF] text-[#593B91] hover:bg-[#E6D9FF] border border-[#EAE3F3] active:bg-[#DDD0FC]',
      lavender:
        'bg-[#9670E8] text-white hover:bg-[#865CE3] shadow-sm shadow-[#9670E8]/25 active:bg-[#784ED9]',
      outline:
        'bg-white text-[#211A2D] border border-[#EAE3F3] hover:bg-[#F8F4FF] hover:border-[#D5C7EE] active:bg-[#F1EAFF]',
      ghost:
        'bg-transparent text-[#756D82] hover:bg-[#F1EAFF] hover:text-[#593B91] active:bg-[#EAE3F3]',
      danger:
        'bg-[#D94C65] text-white hover:bg-[#C53B53] shadow-sm shadow-[#D94C65]/20 active:bg-[#B32F46]',
    }[variant];

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${sizeStyles} ${variantStyles} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin text-current" />
        ) : (
          leftIcon && <span className="inline-flex shrink-0">{leftIcon}</span>
        )}
        <span>{children}</span>
        {!isLoading && rightIcon && (
          <span className="inline-flex shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  }
);

Button.displayName = 'Button';
