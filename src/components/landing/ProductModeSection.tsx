import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Heart, Users, Check, ArrowRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { CreateRoomModal } from '../modals/CreateRoomModal';

export const ProductModeSection: React.FC = () => {
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [targetMode, setTargetMode] = useState<'couple' | 'friend'>('couple');
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const handleLaunchCreate = (mode: 'couple' | 'friend') => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    setTargetMode(mode);
    setCreateModalOpen(true);
  };

  return (
    <section className="py-14 sm:py-18 bg-white border-y border-[#EAE3F3]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10 max-w-4xl">
          <div>
            <Badge variant="lavender" size="md" className="mb-2.5">
              Room Architectures
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-[#211A2D] tracking-tight">
              Two Tailored Room Experiences
            </h2>
            <p className="text-xs sm:text-sm text-[#756D82] mt-1 max-w-xl">
              Rooms dynamically adjust player quotas, interface layouts, and game options based on your selected mode.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl">
          {/* Couple Mode Card */}
          <div className="p-6 sm:p-7 rounded-3xl border border-[#EAE3F3] bg-gradient-to-br from-[#FFF8FA] via-white to-[#FCFAFF] flex flex-col justify-between hover:border-[#FBCFE8] transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#FDF2F8] text-[#9D174D] flex items-center justify-center">
                  <Heart className="w-5 h-5 fill-current" />
                </div>
                <Badge variant="pink" size="sm">
                  2-Player Intimate
                </Badge>
              </div>

              <h3 className="text-xl font-bold text-[#211A2D] mb-1">
                Couple Mode
              </h3>
              <p className="text-xs font-semibold text-[#9D174D] mb-2.5">
                Private duo room with curated conversational and physical duels
              </p>
              <p className="text-xs text-[#756D82] leading-relaxed mb-5">
                Designed for partners to bond without distractions. Features exclusive access to deep-connection card decks, turn reflections, and cozy 2-player physics battles.
              </p>

              <div className="p-3 rounded-xl bg-white border border-[#EAE3F3] mb-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82] block mb-2">
                  Featured Duo Mechanics
                </span>
                <ul className="flex flex-col gap-1.5 text-xs text-[#211A2D]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#248A62] shrink-0" />
                    <span>Exclusive prompt decks in <strong>BETWEEN US</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#248A62] shrink-0" />
                    <span>Side-by-side reflex showdowns in <strong>Snatch the Fries</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#248A62] shrink-0" />
                    <span>Fast head-to-head rounds in <strong>Pen Fight</strong></span>
                  </li>
                </ul>
              </div>
            </div>

            <Button
              variant="secondary"
              size="md"
              onClick={() => handleLaunchCreate('couple')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full justify-between font-bold"
            >
              Create Couple Room
            </Button>
          </div>

          {/* Friend Mode Card */}
          <div className="p-6 sm:p-7 rounded-3xl border border-[#EAE3F3] bg-gradient-to-br from-[#F8F4FF] via-white to-[#FCFAFF] flex flex-col justify-between hover:border-[#D5C7EE] transition-all">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-2xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <Badge variant="lavender" size="sm">
                  Up to 4 Players
                </Badge>
              </div>

              <h3 className="text-xl font-bold text-[#211A2D] mb-1">
                Friend Mode
              </h3>
              <p className="text-xs font-semibold text-[#593B91] mb-2.5">
                Group party room for high-energy banter, cards, and rivalries
              </p>
              <p className="text-xs text-[#756D82] leading-relaxed mb-5">
                Built for game nights with your circle. Supports live multi-seat lobbies, real-time score tracking, simultaneous choice reveals, and territory conquests.
              </p>

              <div className="p-3 rounded-xl bg-white border border-[#EAE3F3] mb-5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82] block mb-2">
                  Featured Group Mechanics
                </span>
                <ul className="flex flex-col gap-1.5 text-xs text-[#211A2D]">
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#248A62] shrink-0" />
                    <span>4-player draw card battles in <strong>UNO-style</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#248A62] shrink-0" />
                    <span>Simultaneous dilemma voting in <strong>Would You Rather</strong></span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Check className="w-3.5 h-3.5 text-[#248A62] shrink-0" />
                    <span>Strategic board encirclement in <strong>Kabza</strong></span>
                  </li>
                </ul>
              </div>
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={() => handleLaunchCreate('friend')}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="w-full justify-between font-bold"
            >
              Create Friend Room
            </Button>
          </div>
        </div>
      </div>

      <CreateRoomModal
        isOpen={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        initialMode={targetMode}
      />
    </section>
  );
};
