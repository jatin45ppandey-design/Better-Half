import React, { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { BetterHalfLogo } from '../ui/BetterHalfLogo';
import { LegalModal } from '../modals/LegalModal';

export const Footer: React.FC = () => {
  const [legalModalType, setLegalModalType] = useState<'privacy' | 'terms' | null>(null);
  const location = useLocation();
  const isLandingPage = location.pathname === '/';

  return (
    <footer
      className={`w-full transition-colors ${
        isLandingPage
          ? 'bg-transparent border-t-0 pt-4 pb-8'
          : 'bg-[#FAF6FD] border-t border-[#E8DEF8] py-8'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B5E82]">
        {/* Centered Brand & Copyright */}
        <div className={`flex flex-col items-center gap-1.5 ${isLandingPage ? 'sm:flex-1 sm:translate-x-16 text-center' : 'sm:flex-row sm:gap-3'}`}>
          <BetterHalfLogo size="sm" showText={true} variant="light" />
          {!isLandingPage && <span className="hidden sm:inline text-[#C4B5FD]">•</span>}
          <span>© 2025 Better-Half. All rights reserved.</span>
        </div>

        {/* Legal Links */}
        <div className="flex items-center gap-5 font-medium shrink-0">
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
