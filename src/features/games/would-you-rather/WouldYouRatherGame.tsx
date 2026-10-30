import React, { useState, useEffect } from 'react';
import {
  Check,
  Plus,
  ArrowRight,
  MessageCircle,
} from 'lucide-react';
import { WOULD_YOU_RATHER_ITEMS, type WouldYouRatherItem } from '../../../data/questions/wouldYouRatherQuestions';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { PassDeviceScreen } from '../../../components/game-ui/PassDeviceScreen';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface WouldYouRatherGameProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  onUpdateTurn?: (playerName: string, roundInfo: string) => void;
}

export const WouldYouRatherGame: React.FC<WouldYouRatherGameProps> = ({
  players,
  onFinishMatch,
  onUpdateTurn,
}) => {
  const p1 = players[0] || { id: 'p1', name: 'Alex', avatarInitials: 'AR', avatarColor: 'bg-[#9670E8]' };
  const p2 = players[1] || { id: 'p2', name: 'Sam', avatarInitials: 'SP', avatarColor: 'bg-[#D94C65]' };

  const [questionIndex, setQuestionIndex] = useState(0);
  const [phase, setPhase] = useState<'p1-answering' | 'pass-to-p2' | 'p2-answering' | 'reveal'>('p1-answering');
  const [p1Choice, setP1Choice] = useState<'A' | 'B' | null>(null);
  const [p2Choice, setP2Choice] = useState<'A' | 'B' | null>(null);
  const [matchCount, setMatchCount] = useState(0);
  const [history, setHistory] = useState<{ dilemma: string; p1: string; p2: string; agreed: boolean }[]>([]);
  const [customQuestions, setCustomQuestions] = useState<WouldYouRatherItem[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customOptA, setCustomOptA] = useState('');
  const [customOptB, setCustomOptB] = useState('');

  const allQuestions = [...WOULD_YOU_RATHER_ITEMS, ...customQuestions];
  const currentQ = allQuestions[questionIndex % allQuestions.length];

  useEffect(() => {
    if (onUpdateTurn) {
      if (phase === 'p1-answering') {
        onUpdateTurn(p1.name, `Question ${questionIndex + 1} • Would You Rather`);
      } else if (phase === 'p2-answering') {
        onUpdateTurn(p2.name, `Question ${questionIndex + 1} • Would You Rather`);
      } else {
        onUpdateTurn('Both Players', `Question ${questionIndex + 1} • Dilemma Reveal`);
      }
    }
  }, [phase, questionIndex, p1.name, p2.name, onUpdateTurn]);

  const handleP1Select = (choice: 'A' | 'B') => {
    setP1Choice(choice);
    setPhase('pass-to-p2');
  };

  const handleP2Select = (choice: 'A' | 'B') => {
    setP2Choice(choice);
    const agreed = p1Choice === choice;
    if (agreed) {
      setMatchCount((prev) => prev + 1);
    }

    setHistory((prev) => [
      {
        dilemma: `${currentQ.optionA} OR ${currentQ.optionB}`,
        p1: p1Choice === 'A' ? currentQ.optionA : currentQ.optionB,
        p2: choice === 'A' ? currentQ.optionA : currentQ.optionB,
        agreed,
      },
      ...prev,
    ]);

    setPhase('reveal');
  };

  const handleNextQuestion = () => {
    if (questionIndex >= 7) {
      // Complete match after 8 questions
      const percent = Math.round((matchCount / (questionIndex + 1)) * 100);
      onFinishMatch({
        winnerName: percent >= 50 ? 'Harmonious Duo!' : 'Hilarious Opposites!',
        playerScores: [
          { ...p1, score: `${matchCount} Matches`, isWinner: true, subtext: `${percent}% Alignment` },
          { ...p2, score: `${matchCount} Matches`, isWinner: true, subtext: `${percent}% Alignment` },
        ],
      });
      return;
    }

    setP1Choice(null);
    setP2Choice(null);
    setQuestionIndex((prev) => prev + 1);
    setPhase('p1-answering');
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customOptA.trim() || !customOptB.trim()) return;

    setCustomQuestions((prev) => [
      ...prev,
      {
        id: `custom-wyr-${Date.now()}`,
        category: 'Personal',
        optionA: customOptA.trim(),
        optionB: customOptB.trim(),
      },
    ]);
    setCustomOptA('');
    setCustomOptB('');
    setShowCustomModal(false);
  };

  if (phase === 'pass-to-p2') {
    return (
      <PassDeviceScreen
        targetPlayerName={p2.name}
        targetPlayerInitials={p2.avatarInitials}
        targetPlayerColor={p2.avatarColor}
        onReady={() => setPhase('p2-answering')}
        message="Alex has locked in their secret pick. Pass the screen to Sam!"
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6 py-4">
      {/* Top Banner */}
      <div className="p-4 rounded-2xl bg-white border border-[#EAE3F3] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="purple" size="sm">
            Dilemma {questionIndex + 1} of {allQuestions.length}
          </Badge>
          <Badge variant="subtle" size="sm">
            {currentQ.category}
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowCustomModal(true)}
            leftIcon={<Plus className="w-3.5 h-3.5" />}
            className="text-xs"
          >
            Custom
          </Button>
          <span className="text-xs text-[#756D82] font-semibold">
            Matches: <strong className="text-[#593B91]">{matchCount}</strong>
          </span>
        </div>
      </div>

      {/* Main Dilemma Question Box */}
      <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#EAE3F3] shadow-md text-center flex flex-col items-center gap-6">
        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-[#9670E8] mb-1 block">
            Would You Rather...
          </span>
          <h2 className="text-xl sm:text-2xl font-extrabold text-[#211A2D]">
            {phase === 'reveal'
              ? 'Answers Revealed!'
              : phase === 'p1-answering'
              ? `${p1.name}, choose secretly:`
              : `${p2.name}, choose secretly:`}
          </h2>
        </div>

        {/* The Two Choice Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
          {/* Option A */}
          <button
            type="button"
            disabled={phase === 'reveal'}
            onClick={() => {
              if (phase === 'p1-answering') handleP1Select('A');
              else if (phase === 'p2-answering') handleP2Select('A');
            }}
            className={`p-6 rounded-3xl border-2 text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
              phase === 'reveal' && p1Choice === 'A' && p2Choice === 'A'
                ? 'border-[#248A62] bg-[#EBF7F2] shadow-md'
                : phase === 'reveal' && (p1Choice === 'A' || p2Choice === 'A')
                ? 'border-[#9670E8] bg-[#F1EAFF]'
                : 'border-[#EAE3F3] bg-[#FCFAFF] hover:border-[#D5C7EE] hover:bg-white'
            }`}
          >
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#593B91] block mb-2">
                Option A
              </span>
              <p className="text-base sm:text-lg font-bold text-[#211A2D] leading-snug">
                {currentQ.optionA}
              </p>
            </div>

            {/* In reveal phase, show who picked this */}
            {phase === 'reveal' && (
              <div className="mt-4 pt-3 border-t border-black/5 flex items-center gap-1.5 flex-wrap">
                {p1Choice === 'A' && (
                  <Badge variant="purple" size="sm">
                    {p1.name}'s Pick
                  </Badge>
                )}
                {p2Choice === 'A' && (
                  <Badge variant="pink" size="sm">
                    {p2.name}'s Pick
                  </Badge>
                )}
              </div>
            )}
          </button>

          {/* Option B */}
          <button
            type="button"
            disabled={phase === 'reveal'}
            onClick={() => {
              if (phase === 'p1-answering') handleP1Select('B');
              else if (phase === 'p2-answering') handleP2Select('B');
            }}
            className={`p-6 rounded-3xl border-2 text-left flex flex-col justify-between transition-all duration-200 cursor-pointer ${
              phase === 'reveal' && p1Choice === 'B' && p2Choice === 'B'
                ? 'border-[#248A62] bg-[#EBF7F2] shadow-md'
                : phase === 'reveal' && (p1Choice === 'B' || p2Choice === 'B')
                ? 'border-[#9670E8] bg-[#F1EAFF]'
                : 'border-[#EAE3F3] bg-[#FCFAFF] hover:border-[#D5C7EE] hover:bg-white'
            }`}
          >
            <div>
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#9670E8] block mb-2">
                Option B
              </span>
              <p className="text-base sm:text-lg font-bold text-[#211A2D] leading-snug">
                {currentQ.optionB}
              </p>
            </div>

            {/* In reveal phase, show who picked this */}
            {phase === 'reveal' && (
              <div className="mt-4 pt-3 border-t border-black/5 flex items-center gap-1.5 flex-wrap">
                {p1Choice === 'B' && (
                  <Badge variant="purple" size="sm">
                    {p1.name}'s Pick
                  </Badge>
                )}
                {p2Choice === 'B' && (
                  <Badge variant="pink" size="sm">
                    {p2.name}'s Pick
                  </Badge>
                )}
              </div>
            )}
          </button>
        </div>

        {/* Reveal Verdict & Next Action */}
        {phase === 'reveal' && (
          <div className="w-full pt-4 border-t border-[#EAE3F3] flex flex-col sm:flex-row items-center justify-between gap-4 animate-in fade-in duration-200">
            <div className="text-left">
              {p1Choice === p2Choice ? (
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#248A62]">
                  <Check className="w-4 h-4 stroke-[3]" />
                  <span>Perfect Match! You both chose Option {p1Choice}.</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm font-extrabold text-[#9670E8]">
                  <MessageCircle className="w-4 h-4" />
                  <span>Clash! Talk it out: Why did you pick different paths?</span>
                </div>
              )}
            </div>

            <Button
              variant="primary"
              size="md"
              onClick={handleNextQuestion}
              rightIcon={<ArrowRight className="w-4 h-4" />}
              className="font-bold shrink-0"
            >
              Next Question
            </Button>
          </div>
        )}
      </div>

      {/* History log */}
      {history.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-[#EAE3F3]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82] block mb-2">
            Comparison Log
          </span>
          <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
            {history.map((h, i) => (
              <div key={i} className="text-xs p-2.5 rounded-xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-center justify-between gap-2">
                <span className="text-[#211A2D] font-medium truncate flex-1">{h.dilemma}</span>
                <Badge variant={h.agreed ? 'success' : 'subtle'} size="sm">
                  {h.agreed ? 'Matched' : 'Differed'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Dilemma Modal */}
      <Modal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title="Create Custom Dilemma"
        description="Craft two options for you and your partner."
        maxWidth="sm"
      >
        <form onSubmit={handleAddCustom} className="flex flex-col gap-3 pt-1">
          <Input
            label="Option A"
            value={customOptA}
            onChange={(e) => setCustomOptA(e.target.value)}
            placeholder="e.g. Live in a treehouse"
            required
          />
          <Input
            label="Option B"
            value={customOptB}
            onChange={(e) => setCustomOptB(e.target.value)}
            placeholder="e.g. Live in a cozy houseboat"
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCustomModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Add Dilemma
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
