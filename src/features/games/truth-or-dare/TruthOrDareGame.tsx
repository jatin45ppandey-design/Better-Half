import React, { useState, useEffect } from 'react';
import {
  Flame,
  HelpCircle,
  RefreshCw,
  Plus,
  Check,
} from 'lucide-react';
import { TRUTH_OR_DARE_ITEMS, type TruthOrDareItem } from '../../../data/questions/truthOrDareQuestions';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { Input } from '../../../components/ui/Input';
import { PassDeviceScreen } from '../../../components/game-ui/PassDeviceScreen';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface TruthOrDareGameProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  onUpdateTurn?: (playerName: string, roundInfo: string) => void;
}

export const TruthOrDareGame: React.FC<TruthOrDareGameProps> = ({
  players,
  onFinishMatch,
  onUpdateTurn,
}) => {
  const p1 = players[0] || { id: 'p1', name: 'Alex', avatarInitials: 'AR', avatarColor: 'bg-[#9670E8]' };
  const p2 = players[1] || { id: 'p2', name: 'Sam', avatarInitials: 'SP', avatarColor: 'bg-[#D94C65]' };

  const [activePlayerIndex, setActivePlayerIndex] = useState<0 | 1>(0);
  const [selectedType, setSelectedType] = useState<'truth' | 'dare' | null>(null);
  const [currentPrompt, setCurrentPrompt] = useState<TruthOrDareItem | null>(null);
  const [intensity, setIntensity] = useState<'Soft' | 'Spicy' | 'Wild'>('Spicy');
  const [category, setCategory] = useState<'Romantic' | 'Funny' | 'Personal' | 'Challenging'>('Romantic');
  const [skipsUsed, setSkipsUsed] = useState<{ [playerId: string]: number }>({ [p1.id]: 0, [p2.id]: 0 });
  const [completedCount, setCompletedCount] = useState<{ [playerId: string]: number }>({ [p1.id]: 0, [p2.id]: 0 });
  const [history, setHistory] = useState<{ player: string; type: string; text: string }[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customText, setCustomText] = useState('');
  const [showPassDevice, setShowPassDevice] = useState(false);

  const activePlayer = activePlayerIndex === 0 ? p1 : p2;
  const targetSkips = skipsUsed[activePlayer.id] || 0;

  useEffect(() => {
    if (onUpdateTurn) {
      onUpdateTurn(activePlayer.name, `Turn ${history.length + 1} • Truth or Dare`);
    }
  }, [activePlayer, history.length, onUpdateTurn]);

  const pickRandomPrompt = (type: 'truth' | 'dare') => {
    const pool = TRUTH_OR_DARE_ITEMS.filter(
      (item) => item.type === type && (item.category === category || item.intensity === intensity)
    );
    const fallbackPool = TRUTH_OR_DARE_ITEMS.filter((item) => item.type === type);
    const chosenList = pool.length > 0 ? pool : fallbackPool;
    const randomItem = chosenList[Math.floor(Math.random() * chosenList.length)];

    setSelectedType(type);
    setCurrentPrompt(randomItem);
  };

  const handleComplete = () => {
    if (currentPrompt) {
      setHistory((prev) => [
        { player: activePlayer.name, type: currentPrompt.type.toUpperCase(), text: currentPrompt.text },
        ...prev,
      ]);
      setCompletedCount((prev) => ({
        ...prev,
        [activePlayer.id]: (prev[activePlayer.id] || 0) + 1,
      }));
    }

    // Check if session can wrap after 8 completed turns
    if (history.length >= 7) {
      const p1Score = completedCount[p1.id] + 1;
      const p2Score = completedCount[p2.id];
      onFinishMatch({
        winnerName: p1Score >= p2Score ? p1.name : p2.name,
        playerScores: [
          { ...p1, score: `${p1Score} Completed`, isWinner: p1Score >= p2Score },
          { ...p2, score: `${p2Score} Completed`, isWinner: p2Score > p1Score },
        ],
      });
      return;
    }

    // Pass turn
    setSelectedType(null);
    setCurrentPrompt(null);
    setActivePlayerIndex(activePlayerIndex === 0 ? 1 : 0);
    setShowPassDevice(true);
  };

  const handleSkip = () => {
    if (targetSkips >= 2) return;
    setSkipsUsed((prev) => ({ ...prev, [activePlayer.id]: targetSkips + 1 }));
    if (selectedType) {
      pickRandomPrompt(selectedType);
    }
  };

  const handleAddCustom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customText.trim() || !selectedType) return;

    setCurrentPrompt({
      id: `custom-${Date.now()}`,
      type: selectedType,
      category,
      intensity,
      text: customText.trim(),
    });
    setCustomText('');
    setShowCustomModal(false);
  };

  if (showPassDevice) {
    return (
      <PassDeviceScreen
        targetPlayerName={activePlayer.name}
        targetPlayerInitials={activePlayer.avatarInitials}
        targetPlayerColor={activePlayer.avatarColor}
        onReady={() => setShowPassDevice(false)}
        message="Keep your selection secret until you're ready to reveal the prompt!"
      />
    );
  }

  return (
    <div className="max-w-2xl mx-auto flex flex-col gap-6 py-4">
      {/* Turn indicator card */}
      <div className="p-4 rounded-2xl bg-white border border-[#EAE3F3] shadow-xs flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${activePlayer.avatarColor} text-white font-bold flex items-center justify-center text-sm shadow-xs`}>
            {activePlayer.avatarInitials}
          </div>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9670E8]">
              Active Player
            </span>
            <h2 className="text-base font-extrabold text-[#211A2D]">
              {activePlayer.name}'s Choice
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-[#756D82]">Skips Remaining:</span>
          <Badge variant={2 - targetSkips > 0 ? 'lavender' : 'subtle'} size="sm">
            {2 - targetSkips} / 2
          </Badge>
        </div>
      </div>

      {/* Choice Screen if no type selected */}
      {!selectedType ? (
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#EAE3F3] shadow-md text-center flex flex-col items-center gap-6">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-[#593B91] mb-1 block">
              Make Your Decision
            </span>
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#211A2D]">
              Truth or Dare?
            </h3>
            <p className="text-xs sm:text-sm text-[#756D82] max-w-sm mt-1 mx-auto">
              Select what challenge you want to face. No judgment, just laughter and honesty.
            </p>
          </div>

          {/* Category & Intensity Controls */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
            <div className="flex flex-wrap items-center justify-center gap-2 p-1.5 rounded-2xl bg-[#F8F4FF] border border-[#EAE3F3]">
              {(['Romantic', 'Funny', 'Personal', 'Challenging'] as const).map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    category === cat
                      ? 'bg-[#593B91] text-white shadow-xs'
                      : 'text-[#756D82] hover:text-[#211A2D]'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1 p-1.5 rounded-2xl bg-[#FFF5F8] border border-[#FCE7F3]">
              {(['Soft', 'Spicy', 'Wild'] as const).map((lvl) => (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setIntensity(lvl)}
                  className={`px-2.5 py-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                    intensity === lvl
                      ? 'bg-[#D94C65] text-white shadow-xs'
                      : 'text-[#9D174D] hover:text-[#700D2B]'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Big Decision Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <button
              type="button"
              onClick={() => pickRandomPrompt('truth')}
              className="p-6 rounded-3xl border-2 border-[#9670E8] bg-gradient-to-br from-[#F8F4FF] to-white hover:shadow-lg hover:shadow-[#9670E8]/10 hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center gap-3 text-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#F1EAFF] text-[#593B91] flex items-center justify-center group-hover:scale-105 transition-transform">
                <HelpCircle className="w-8 h-8 text-[#9670E8]" />
              </div>
              <h4 className="text-xl font-extrabold text-[#211A2D]">Truth</h4>
              <p className="text-xs text-[#756D82]">
                Answer a candid, intriguing, or vulnerable question honestly.
              </p>
            </button>

            <button
              type="button"
              onClick={() => pickRandomPrompt('dare')}
              className="p-6 rounded-3xl border-2 border-[#D94C65] bg-gradient-to-br from-[#FFF5F8] to-white hover:shadow-lg hover:shadow-[#D94C65]/10 hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center gap-3 text-center group"
            >
              <div className="w-14 h-14 rounded-2xl bg-[#FDF2F8] text-[#9D174D] flex items-center justify-center group-hover:scale-105 transition-transform">
                <Flame className="w-8 h-8 text-[#D94C65]" />
              </div>
              <h4 className="text-xl font-extrabold text-[#211A2D]">Dare</h4>
              <p className="text-xs text-[#756D82]">
                Take on a playful, romantic, or hilarious micro-challenge.
              </p>
            </button>
          </div>
        </div>
      ) : (
        /* Active Prompt Screen */
        <div className="p-6 sm:p-8 rounded-3xl bg-white border border-[#EAE3F3] shadow-md flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <Badge variant={selectedType === 'truth' ? 'purple' : 'pink'} size="md">
              {selectedType.toUpperCase()} • {currentPrompt?.category}
            </Badge>

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
              <Button
                variant="outline"
                size="sm"
                onClick={handleSkip}
                disabled={targetSkips >= 2}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                className="text-xs"
              >
                Skip ({2 - targetSkips} left)
              </Button>
            </div>
          </div>

          {/* Prompt Presentation Box */}
          <div className="p-6 sm:p-8 rounded-3xl bg-gradient-to-br from-[#FCFAFF] via-[#F8F4FF] to-[#F1EAFF] border border-[#EAE3F3] text-center flex flex-col items-center gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#9670E8]">
              {activePlayer.name}'s Prompt
            </span>
            <p className="text-lg sm:text-xl font-extrabold text-[#211A2D] leading-snug max-w-lg">
              "{currentPrompt?.text}"
            </p>
          </div>

          {/* Complete Turn Button */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedType(null)}
            >
              Back to Choice
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={handleComplete}
              rightIcon={<Check className="w-4 h-4" />}
              className="font-bold shadow-md shadow-[#593B91]/15"
            >
              Completed — Next Turn
            </Button>
          </div>
        </div>
      )}

      {/* History Log */}
      {history.length > 0 && (
        <div className="p-4 rounded-2xl bg-white border border-[#EAE3F3]">
          <span className="text-[10px] font-bold uppercase tracking-wider text-[#756D82] block mb-2">
            Session History ({history.length} Prompts Completed)
          </span>
          <div className="flex flex-col gap-2 max-h-36 overflow-y-auto pr-1">
            {history.map((h, i) => (
              <div key={i} className="text-xs p-2 rounded-xl bg-[#FCFAFF] border border-[#EAE3F3] flex items-start gap-2">
                <Badge variant={h.type === 'TRUTH' ? 'purple' : 'pink'} size="sm" className="text-[9px]">
                  {h.type}
                </Badge>
                <div className="flex-1 min-w-0">
                  <span className="font-bold text-[#211A2D] mr-1">{h.player}:</span>
                  <span className="text-[#756D82]">{h.text}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Question Modal */}
      <Modal
        isOpen={showCustomModal}
        onClose={() => setShowCustomModal(false)}
        title={`Add Custom ${selectedType?.toUpperCase()}`}
        description="Type a personalized prompt for your partner."
        maxWidth="sm"
      >
        <form onSubmit={handleAddCustom} className="flex flex-col gap-4 pt-1">
          <Input
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder="Type prompt here..."
            required
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" size="sm" onClick={() => setShowCustomModal(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" size="sm">
              Use Custom Prompt
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
