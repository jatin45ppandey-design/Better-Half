import React from 'react';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  containerClassName?: string;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      id,
      className = '',
      containerClassName = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? `input-${label.toLowerCase().replace(/\s+/g, '-')}` : undefined);
    const errorId = error && inputId ? `${inputId}-error` : undefined;
    const helperId = helperText && inputId ? `${inputId}-helper` : undefined;

    return (
      <div className={`w-full flex flex-col gap-1.5 ${containerClassName}`}>
        {label && (
          <label
            htmlFor={inputId}
            className="text-xs font-semibold uppercase tracking-wider text-[#593B91]"
          >
            {label}
          </label>
        )}
        <div className="relative flex items-center">
          {leftIcon && (
            <div className="absolute left-3.5 text-[#756D82] pointer-events-none flex items-center justify-center">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={!!error}
            aria-describedby={error ? errorId : helperId}
            className={`w-full rounded-xl border bg-white px-3.5 py-2.5 text-sm text-[#211A2D] placeholder-[#9D96A8] transition-all duration-150 outline-none
              ${leftIcon ? 'pl-10' : ''}
              ${rightIcon ? 'pr-10' : ''}
              ${
                error
                  ? 'border-[#D94C65] focus:border-[#D94C65] focus:ring-2 focus:ring-[#D94C65]/20 bg-[#FFF9FA]'
                  : 'border-[#EAE3F3] focus:border-[#9670E8] focus:ring-2 focus:ring-[#9670E8]/20 hover:border-[#D5C7EE]'
              }
              disabled:bg-[#F8F4FF] disabled:text-[#A59CB5] disabled:cursor-not-allowed
              ${className}`}
            {...props}
          />
          {rightIcon && (
            <div className="absolute right-3 text-[#756D82] flex items-center justify-center">
              {rightIcon}
            </div>
          )}
        </div>
        {error ? (
          <p id={errorId} className="text-xs text-[#D94C65] font-medium flex items-center gap-1 mt-0.5">
            <span>•</span> {error}
          </p>
        ) : helperText ? (
          <p id={helperId} className="text-xs text-[#756D82] mt-0.5">
            {helperText}
          </p>
        ) : null}
      </div>
    );
  }
);

Input.displayName = 'Input';
