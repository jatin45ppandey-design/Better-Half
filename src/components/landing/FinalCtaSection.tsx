import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ArrowRight, Gamepad2 } from 'lucide-react';
import { Button } from '../ui/Button';

export const FinalCtaSection: React.FC = () => {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-[#FCFAFF] via-[#F1EAFF]/70 to-[#F8F4FF] border-b border-[#EAE3F3] relative overflow-hidden">
      {/* Subtle background glow */}
      <div
        className="absolute inset-0 bg-[radial-gradient(#9670E8_1px,transparent_1px)] [background-size:24px_24px] opacity-[0.06] pointer-events-none"
        aria-hidden="true"
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10 flex flex-col items-center gap-6">
        <div className="w-14 h-14 rounded-3xl bg-white border border-[#E2D5F8] text-[#593B91] flex items-center justify-center shadow-md shadow-[#593B91]/10">
          <Gamepad2 className="w-7 h-7 text-[#9670E8]" />
        </div>

        <h2 className="text-3xl sm:text-4xl md:text-5xl font-extrabold text-[#211A2D] tracking-tight max-w-2xl leading-tight">
          Ready to Make Game Night Your Favourite Routine?
        </h2>

        <p className="text-base sm:text-lg text-[#756D82] max-w-xl leading-relaxed">
          Step into our Phase 1 player dashboard, try out both modes, and discover
          games designed for meaningful laughter and connection.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2 w-full sm:w-auto">
          <Link to="/signup" className="w-full sm:w-auto">
            <Button
              variant="primary"
              size="lg"
              rightIcon={<ArrowRight className="w-5 h-5" />}
              className="w-full sm:w-auto shadow-md shadow-[#593B91]/25"
            >
              Get Started Free
            </Button>
          </Link>
          <Link to="/dashboard" className="w-full sm:w-auto">
            <Button
              variant="secondary"
              size="lg"
              leftIcon={<Sparkles className="w-4 h-4 text-[#9670E8]" />}
              className="w-full sm:w-auto"
            >
              Explore Dashboard
            </Button>
          </Link>
        </div>

        <p className="text-xs text-[#756D82] pt-2">
          No credit card • Development mock preview active • Ready to play
        </p>
      </div>
    </section>
  );
};
