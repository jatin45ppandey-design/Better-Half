import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { Input, type InputProps } from './Input';

export interface PasswordInputProps extends Omit<InputProps, 'type' | 'rightIcon'> {
  showStrength?: boolean;
}

export const PasswordInput = React.forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ showStrength = false, value, onChange, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    const toggleVisibility = () => {
      setShowPassword((prev) => !prev);
    };

    // Calculate basic strength if value is string
    const stringVal = typeof value === 'string' ? value : '';
    let strengthScore = 0;
    if (stringVal.length >= 6) strengthScore++;
    if (stringVal.length >= 10) strengthScore++;
    if (/[A-Z]/.test(stringVal)) strengthScore++;
    if (/[0-9]/.test(stringVal) || /[^A-Za-z0-9]/.test(stringVal)) strengthScore++;

    const strengthLabel = ['Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong'][strengthScore];
    const strengthColor = [
      'bg-[#D94C65]',
      'bg-[#F59E0B]',
      'bg-[#FCD34D]',
      'bg-[#10B981]',
      'bg-[#059669]',
    ][strengthScore];

    return (
      <div className="w-full flex flex-col gap-1.5">
        <Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          leftIcon={<Lock className="w-4 h-4 text-[#756D82]" />}
          rightIcon={
            <button
              type="button"
              onClick={toggleVisibility}
              tabIndex={0}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="text-[#756D82] hover:text-[#593B91] p-1 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#9670E8]"
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          }
          value={value}
          onChange={onChange}
          {...props}
        />

        {showStrength && stringVal.length > 0 && (
          <div className="mt-1 flex flex-col gap-1">
            <div className="flex gap-1 h-1.5 w-full">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`flex-1 rounded-full transition-all duration-300 ${
                    strengthScore >= step ? strengthColor : 'bg-[#EAE3F3]'
                  }`}
                />
              ))}
            </div>
            <span className="text-[11px] text-[#756D82] font-medium self-end">
              Strength: {strengthLabel}
            </span>
          </div>
        )}
      </div>
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
