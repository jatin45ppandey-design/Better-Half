import React from 'react';
import { Loader2 } from 'lucide-react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'lavender' | 'outline' | 'ghost' | 'danger' | 'dark-outline';
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
      'inline-flex items-center justify-center font-medium transition-all duration-200 select-none rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8B5CF6] focus-visible:ring-offset-2 disabled:opacity-50 disabled:pointer-events-none active:scale-[0.98] cursor-pointer';

    // Accessible touch targets (WCAG 2.1 AA 44x44px touch-targets on primary controls)
    const sizeStyles = {
      sm: 'text-xs px-3.5 py-1.5 gap-1.5 min-h-[36px]',
      md: 'text-sm px-4.5 py-2.5 gap-2 min-h-[44px]',
      lg: 'text-base px-6 py-3.5 gap-2.5 min-h-[50px] font-semibold',
      icon: 'p-2.5 min-h-[44px] min-w-[44px] rounded-xl',
    }[size];

    // Variant styles matching Better-Half purple / lavender identity
    const variantStyles = {
      primary:
        'bg-[#7C3AED] text-white hover:bg-[#6D28D9] shadow-md shadow-purple-900/15 active:bg-[#5B21B6]',
      secondary:
        'bg-[#F3ECFB] text-[#6B21A8] hover:bg-[#EADBFA] border border-[#E4D7F5] active:bg-[#DBC3F5]',
      lavender:
        'bg-[#8B5CF6] text-white hover:bg-[#7C3AED] shadow-sm shadow-[#8B5CF6]/25 active:bg-[#6D28D9]',
      outline:
        'bg-white text-[#1E1035] border border-[#E8DEF8] hover:bg-[#F9F5FD] hover:border-[#C4B5FD] active:bg-[#F3ECFB]',
      ghost:
        'bg-transparent text-[#6B5E82] hover:bg-[#F3ECFB] hover:text-[#6B21A8] active:bg-[#EADBFA]',
      danger:
        'bg-[#DC2626] text-white hover:bg-[#B91C1C] shadow-sm shadow-red-900/20 active:bg-[#991B1B]',
      'dark-outline':
        'bg-[#1F1433]/70 text-[#E9D5FF] border border-[#3B255D] hover:bg-[#2A1B45] hover:border-[#7C3AED] active:bg-[#19102B]',
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
