import React from 'react';

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'white' | 'lavender' | 'subtle';
  hoverable?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      children,
      variant = 'white',
      hoverable = false,
      padding = 'md',
      className = '',
      ...props
    },
    ref
  ) => {
    const variantStyles = {
      white: 'bg-white border-[#EAE3F3] text-[#211A2D]',
      lavender: 'bg-[#F1EAFF] border-[#E2D5F8] text-[#211A2D]',
      subtle: 'bg-[#F8F4FF] border-[#EDE7F6] text-[#211A2D]',
    }[variant];

    const paddingStyles = {
      none: '',
      sm: 'p-3.5 sm:p-4',
      md: 'p-5 sm:p-6',
      lg: 'p-6 sm:p-8',
    }[padding];

    const hoverStyles = hoverable
      ? 'transition-all duration-200 hover:-translate-y-1 hover:shadow-md hover:shadow-[#593B91]/5 hover:border-[#D5C7EE]'
      : '';

    return (
      <div
        ref={ref}
        className={`rounded-2xl border shadow-sm shadow-[#211A2D]/3 ${variantStyles} ${paddingStyles} ${hoverStyles} ${className}`}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';
