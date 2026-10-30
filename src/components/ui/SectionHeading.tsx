import React from 'react';
import { Badge } from './Badge';

export interface SectionHeadingProps {
  badge?: string;
  title: string;
  subtitle?: string;
  align?: 'left' | 'center';
  className?: string;
}

export const SectionHeading: React.FC<SectionHeadingProps> = ({
  badge,
  title,
  subtitle,
  align = 'center',
  className = '',
}) => {
  const isCenter = align === 'center';

  return (
    <div
      className={`flex flex-col gap-2.5 max-w-2xl ${
        isCenter ? 'mx-auto text-center items-center' : 'text-left items-start'
      } ${className}`}
    >
      {badge && (
        <Badge variant="lavender" size="md">
          {badge}
        </Badge>
      )}
      <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[#211A2D]">
        {title}
      </h2>
      {subtitle && (
        <p className="text-sm sm:text-base text-[#756D82] leading-relaxed">
          {subtitle}
        </p>
      )}
    </div>
  );
};
