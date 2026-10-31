import React, { useState } from 'react';
import { BetterHalfLogo } from '../ui/BetterHalfLogo';
import { LegalModal } from '../modals/LegalModal';

export const Footer: React.FC = () => {
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);

  return (
    <footer className="w-full bg-[#FAF6FD] border-t border-[#E8DEF8] py-8 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B5E82]">
        {/* Centered Brand & Copyright */}
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <BetterHalfLogo size="sm" showText={true} variant="light" />
          <span className="hidden sm:inline text-[#C4B5FD]">•</span>
          <span>© 2025 Better-Half. All rights reserved.</span>
        </div>

        {/* Legal Links */}
        <div className="flex items-center gap-5 font-medium">
          <button
            type="button"
            onClick={() => setLegalModalType('privacy')}
            className="hover:text-[#7C3AED] transition-colors cursor-pointer"
          >
            Privacy Policy
          </button>
          <button
            type="button"
            onClick={() => setLegalModalType('terms')}
            className="hover:text-[#7C3AED] transition-colors cursor-pointer"
          >
            Terms of Service
          </button>
        </div>
      </div>

      <LegalModal
        isOpen={legalModalType !== null}
        onClose={() => setLegalModalType(null)}
        type={legalModalType}
      />
    </footer>
  );
};
