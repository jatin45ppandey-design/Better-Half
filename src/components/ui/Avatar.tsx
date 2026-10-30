import React from 'react';

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  initials?: string;
  src?: string;
  size?: 'sm' | 'md' | 'lg';
  isOnline?: boolean;
  bgColor?: string;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  initials,
  src,
  size = 'md',
  isOnline = false,
  bgColor = 'bg-[#9670E8]',
  className = '',
  ...props
}) => {
  const displayInitials =
    initials ||
    name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base font-semibold',
  }[size];

  const dotSizeClasses = {
    sm: 'w-2 h-2 ring-1',
    md: 'w-2.5 h-2.5 ring-2',
    lg: 'w-3 h-3 ring-2',
  }[size];

  return (
    <div className="relative inline-flex shrink-0">
      <div
        className={`relative inline-flex items-center justify-center rounded-full font-bold text-white shadow-sm ring-2 ring-white select-none ${bgColor} ${sizeClasses} ${className}`}
        aria-label={name}
        title={name}
        {...props}
      >
        {src ? (
          <img
            src={src}
            alt={name}
            className="w-full h-full object-cover rounded-full"
          />
        ) : (
          <span>{displayInitials}</span>
        )}
      </div>

      {isOnline && (
        <span
          className={`absolute bottom-0 right-0 rounded-full bg-[#248A62] ring-white ${dotSizeClasses}`}
          title="Online"
        />
      )}
    </div>
  );
};
