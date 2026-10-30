import React from 'react';
import { ToggleLeft, UserPlus, Gamepad2 } from 'lucide-react';
import { SectionHeading } from '../ui/SectionHeading';

export const HowItWorksSection: React.FC = () => {
  const steps = [
    {
      step: '01',
      title: 'Choose Your Mode',
      description:
        'Select Couple Mode for intimate 2-player conversations and cozy showdowns, or Friend Mode for up to 4 players.',
      icon: <ToggleLeft className="w-6 h-6 text-[#9670E8]" />,
    },
    {
      step: '02',
      title: 'Invite Your People',
      description:
        'Set up a pass-and-play session on one screen, or prepare your private room link ready for Phase 2 multiplayer sync.',
      icon: <UserPlus className="w-6 h-6 text-[#9670E8]" />,
    },
    {
      step: '03',
      title: 'Play and Have Fun',
      description:
        'Pick from 11 thoughtfully designed games. No ads, no clunky app store downloads—just instant playful connection.',
      icon: <Gamepad2 className="w-6 h-6 text-[#9670E8]" />,
    },
  ];

  return (
    <section id="how-it-works" className="py-16 sm:py-20 bg-white border-b border-[#EAE3F3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Simple & Instant"
          title="How PlaySpace Works"
          subtitle="Designed to start in seconds so you can spend less time configuring and more time laughing."
          align="center"
          className="mb-14"
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative max-w-5xl mx-auto">
          {steps.map((s, idx) => (
            <div
              key={s.step}
              className="relative flex flex-col items-center text-center p-6 sm:p-7 rounded-3xl bg-[#FCFAFF] border border-[#EAE3F3] hover:border-[#D5C7EE] transition-all duration-200"
            >
              {/* Step indicator */}
              <div className="w-12 h-12 rounded-2xl bg-[#F1EAFF] border border-[#E2D5F8] flex items-center justify-center mb-5 text-[#593B91] shadow-xs">
                {s.icon}
              </div>

              <span className="text-xs font-extrabold tracking-widest text-[#9670E8] uppercase mb-1">
                Step {s.step}
              </span>

              <h3 className="text-lg font-bold text-[#211A2D] mb-2.5">
                {s.title}
              </h3>

              <p className="text-xs sm:text-sm text-[#756D82] leading-relaxed">
                {s.description}
              </p>

              {/* Connecting line on desktop */}
              {idx < steps.length - 1 && (
                <div
                  className="hidden md:block absolute -right-4 top-1/2 -translate-y-1/2 w-8 h-[2px] bg-[#EAE3F3] z-10"
                  aria-hidden="true"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
