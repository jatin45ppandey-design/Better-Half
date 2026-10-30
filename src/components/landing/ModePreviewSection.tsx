import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Users, Check, ArrowRight, Sparkles } from 'lucide-react';
import { MODES_DATA } from '../../data/games';
import { SectionHeading } from '../ui/SectionHeading';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import type { ModeDetail } from '../../types/game';

export const ModePreviewSection: React.FC = () => {
  const [selectedMode, setSelectedMode] = useState<ModeDetail | null>(null);
  const navigate = useNavigate();
  const { setDevUser } = useAuth();
  const { addToast } = useToast();

  const handleSelectModeAndPlay = (modeId: 'couple' | 'friend') => {
    setDevUser(modeId);
    setSelectedMode(null);
    addToast(`${modeId === 'couple' ? 'Couple Mode' : 'Friend Mode'} activated!`, {
      type: 'success',
      message: 'Navigating to your personalized dashboard...',
    });
    navigate('/dashboard');
  };

  return (
    <section id="modes" className="py-16 sm:py-20 bg-white border-y border-[#EAE3F3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Two Ways to Play"
          title="Curated for Pairs. Built for Parties."
          subtitle="Whether you are curled up on the couch with your partner or hosting a rowdy 4-player game night, choose the vibe that fits."
          align="center"
          className="mb-12 sm:mb-16"
        />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {MODES_DATA.map((mode) => {
            const isCouple = mode.id === 'couple';
            return (
              <div
                key={mode.id}
                className="relative flex flex-col justify-between rounded-3xl p-7 sm:p-8 border border-[#EAE3F3] bg-gradient-to-b from-[#FCFAFF] to-white hover:border-[#D5C7EE] hover:shadow-lg hover:shadow-[#593B91]/5 transition-all duration-300 group"
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between mb-5">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${
                      isCouple
                        ? 'bg-[#FDF2F8] text-[#9D174D]'
                        : 'bg-[#F1EAFF] text-[#593B91]'
                    }`}
                  >
                    {isCouple ? (
                      <Heart className="w-6 h-6 fill-current" />
                    ) : (
                      <Users className="w-6 h-6" />
                    )}
                  </div>
                  <span
                    className={`text-xs font-bold px-3 py-1 rounded-full border ${
                      isCouple
                        ? 'bg-[#FDF2F8] text-[#9D174D] border-[#FCE7F3]'
                        : 'bg-[#F1EAFF] text-[#593B91] border-[#E2D5F8]'
                    }`}
                  >
                    {mode.playerCount}
                  </span>
                </div>

                {/* Content */}
                <div className="flex flex-col gap-3 mb-6">
                  <div className="flex items-center gap-2">
                    <h3 className="text-2xl font-bold text-[#211A2D]">
                      {mode.name}
                    </h3>
                  </div>
                  <p className="text-sm font-semibold text-[#593B91]">
                    {mode.tagline}
                  </p>
                  <p className="text-sm text-[#756D82] leading-relaxed">
                    {mode.description}
                  </p>
                </div>

                {/* Feature Highlights */}
                <ul className="flex flex-col gap-2.5 mb-8 text-xs text-[#211A2D]">
                  {mode.highlights.map((highlight) => (
                    <li key={highlight} className="flex items-start gap-2.5">
                      <div className="mt-0.5 rounded-full p-0.5 bg-[#EBF7F2] text-[#248A62] shrink-0">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                      <span className="leading-tight">{highlight}</span>
                    </li>
                  ))}
                </ul>

                {/* Action CTA */}
                <Button
                  variant={isCouple ? 'secondary' : 'primary'}
                  size="md"
                  className="w-full justify-between"
                  onClick={() => setSelectedMode(mode)}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Explore {mode.name}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mode Details Modal */}
      {selectedMode && (
        <Modal
          isOpen={!!selectedMode}
          onClose={() => setSelectedMode(null)}
          title={selectedMode.name}
          description={selectedMode.tagline}
          maxWidth="md"
        >
          <div className="flex flex-col gap-5 pt-2">
            <div className="p-4 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3] text-sm text-[#211A2D] leading-relaxed">
              <p className="font-medium">{selectedMode.description}</p>
            </div>

            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-[#593B91] mb-2.5">
                Key Experiences Included
              </h4>
              <ul className="flex flex-col gap-2 text-xs text-[#756D82]">
                {selectedMode.highlights.map((h) => (
                  <li key={h} className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-[#9670E8] shrink-0" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="pt-3 border-t border-[#EAE3F3] flex flex-col sm:flex-row items-center justify-end gap-2.5">
              <Button
                variant="outline"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => setSelectedMode(null)}
              >
                Close
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="w-full sm:w-auto"
                onClick={() => handleSelectModeAndPlay(selectedMode.id)}
                rightIcon={<ArrowRight className="w-4 h-4" />}
              >
                Launch in Dashboard
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
};
