import React, { useState, useMemo } from 'react';
import {
  Heart,
  Lock,
  Eye,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  ChevronRight,
  MessageCircle,
  Filter,
  AlertTriangle,
} from 'lucide-react';
import {
  BETWEEN_US_CATEGORIES,
  INTENSITY_LEVELS,
  BETWEEN_US_QUESTIONS,
  type BetweenUsQuestion,
  type BetweenUsCategory,
} from '../../../data/questions/betweenUsQuestions';
import { Button } from '../../../components/ui/Button';
import { Badge } from '../../../components/ui/Badge';
import { Modal } from '../../../components/ui/Modal';
import { PassDeviceScreen } from '../../../components/game-ui/PassDeviceScreen';
import type { PlayerScoreSummary } from '../../../components/game-ui/GameResultsModal';

interface BetweenUsProps {
  players: { id: string; name: string; avatarInitials: string; avatarColor: string }[];
  onFinishMatch: (results: { winnerName?: string; playerScores: PlayerScoreSummary[] }) => void;
  isPaused?: boolean;
  sessionState?: any;
  sessionPrivateState?: any;
  onSendAction?: (action: any) => Promise<{ success: boolean; error?: string }>;
  currentUserId?: string;
}

type TurnPhase = 'P1_ANSWER' | 'PASS_TO_P2' | 'P2_ANSWER' | 'REVEAL' | 'SUMMARY' | 'ONLINE_ANSWER' | 'WAITING';

export const BetweenUsGame: React.FC<BetweenUsProps> = ({
  players,
  onFinishMatch,
  isPaused = false,
  sessionState,
  onSendAction,
  currentUserId,
}) => {
  const partner1 = players[0] || { id: 'p1', name: 'Partner 1', avatarInitials: 'P1', avatarColor: 'bg-primary-500' };
  const partner2 = players[1] || { id: 'p2', name: 'Partner 2', avatarInitials: 'P2', avatarColor: 'bg-secondary-500' };

  // Settings
  const [localSelectedCategory, setSelectedCategory] = useState<BetweenUsCategory | 'All'>('All');
  const [localIntensity, setIntensity] = useState<1 | 2 | 3 | 4 | 5>(2);
  const [isAdultConsentGranted, setIsAdultConsentGranted] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);

  // Filtered pool
  const eligibleQuestions = useMemo(() => {
    return BETWEEN_US_QUESTIONS.filter((q) => {
      const matchCat = localSelectedCategory === 'All' || q.category === localSelectedCategory;
      const matchInt = q.intensity <= localIntensity;
      return matchCat && matchInt;
    });
  }, [localSelectedCategory, localIntensity]);

  // Question index & History (in-memory only!)
  const [questionIdx, setQuestionIdx] = useState(0);
  const [localPhase, setPhase] = useState<TurnPhase>('P1_ANSWER');
  const [localP1Answer, setP1Answer] = useState('');
  const [localP2Answer, setP2Answer] = useState('');
  const [draftAnswer, setDraftAnswer] = useState('');
  const [localQuestionsAnsweredCount, setQuestionsAnsweredCount] = useState(0);

  const isMultiplayer = Boolean(sessionState && onSendAction);
  const selectedCategory = isMultiplayer ? sessionState.category : localSelectedCategory;
  const intensity: 1 | 2 | 3 | 4 | 5 = isMultiplayer ? sessionState.intensity : localIntensity;
  const currentQuestion: BetweenUsQuestion = isMultiplayer
    ? sessionState.currentQuestion
    : eligibleQuestions[questionIdx % eligibleQuestions.length] || BETWEEN_US_QUESTIONS[0];
  const phase: TurnPhase = isMultiplayer
    ? sessionState.phase === 'REVEAL'
      ? 'REVEAL'
      : sessionState.submittedUserIds?.includes(currentUserId)
      ? 'WAITING'
      : 'ONLINE_ANSWER'
    : localPhase;
  const p1Answer = isMultiplayer
    ? sessionState.revealedAnswers?.[partner1.id] || ''
    : localP1Answer;
  const p2Answer = isMultiplayer
    ? sessionState.revealedAnswers?.[partner2.id] || ''
    : localP2Answer;
  const questionsAnsweredCount = isMultiplayer
    ? sessionState.questionsAnsweredCount || 0
    : localQuestionsAnsweredCount;
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [showSurpriseCard, setShowSurpriseCard] = useState(false);
  const [_sessionLog, setSessionLog] = useState<Array<{ prompt: string; category: string }>>([]);

  const handleIntensityClick = (level: 1 | 2 | 3 | 4 | 5) => {
    if (level === 5 && !(isMultiplayer
      ? (sessionState.adultConsentUserIds || []).includes(currentUserId)
      : isAdultConsentGranted)) {
      setShowConsentModal(true);
      return;
    }
    if (isMultiplayer) {
      void onSendAction?.({ type: 'SET_SETTINGS', intensity: level });
    } else {
      setIntensity(level);
    }
  };

  const handleGrantConsent = () => {
    if (isMultiplayer) {
      void onSendAction?.({ type: 'GRANT_ADULT_CONSENT' });
    } else {
      setIsAdultConsentGranted(true);
      setIntensity(5);
    }
    setShowConsentModal(false);
  };

  // Turn Flow
  const handleP1Submit = () => {
    if (isMultiplayer) {
      if (!draftAnswer.trim()) return;
      void onSendAction?.({ type: 'SUBMIT_ANSWER', answer: draftAnswer.trim() });
      return;
    }
    if (!localP1Answer.trim()) return;
    setPhase('PASS_TO_P2');
  };

  const handlePassComplete = () => {
    setPhase('P2_ANSWER');
  };

  const handleP2Submit = () => {
    if (!localP2Answer.trim()) return;
    setPhase('REVEAL');
    setQuestionsAnsweredCount((c) => c + 1);
    setSessionLog((prev) => [{ prompt: currentQuestion.prompt, category: currentQuestion.category }, ...prev]);
  };

  const handleNextPrompt = () => {
    if (isMultiplayer) {
      void onSendAction?.({ type: 'NEXT_QUESTION' });
      setDraftAnswer('');
      setShowFollowUp(false);
      setShowSurpriseCard(false);
      return;
    }
    setP1Answer('');
    setP2Answer('');
    setShowFollowUp(false);
    setShowSurpriseCard(false);
    setQuestionIdx((i) => i + 1);
    setPhase('P1_ANSWER');
  };

  const handleSkipPrompt = () => {
    if (isMultiplayer) return;
    setP1Answer('');
    setP2Answer('');
    setQuestionIdx((i) => i + 1);
    setPhase('P1_ANSWER');
  };

  const handleFinishSession = () => {
    if (isMultiplayer) {
      void onSendAction?.({ type: 'FINISH_SESSION' });
      return;
    }
    onFinishMatch({
      winnerName: 'Both of You 💕',
      playerScores: [
        {
          playerId: partner1.id,
          name: partner1.name,
          avatarInitials: partner1.avatarInitials,
          avatarColor: partner1.avatarColor,
          score: questionsAnsweredCount,
          isWinner: true,
          stats: [
            { label: 'Moments Shared', value: questionsAnsweredCount },
            { label: 'Intimacy Level', value: `Level ${intensity}` },
          ],
        },
        {
          playerId: partner2.id,
          name: partner2.name,
          avatarInitials: partner2.avatarInitials,
          avatarColor: partner2.avatarColor,
          score: questionsAnsweredCount,
          isWinner: true,
          stats: [
            { label: 'Moments Shared', value: questionsAnsweredCount },
            { label: 'Intimacy Level', value: `Level ${intensity}` },
          ],
        },
      ],
    });
  };

  // If paused, prevent interaction
  if (isPaused) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center bg-white/80 rounded-3xl border border-primary-100">
        <p className="text-gray-600">Conversation paused. Resume whenever you are ready.</p>
      </div>
    );
  }

  // Intermediary Privacy Screen
  if (phase === 'PASS_TO_P2') {
    return (
      <PassDeviceScreen
        nextPlayerName={partner2.name}
        roundTitle="Between Us • Confidential Response"
        instruction="Partner 1 has locked in their private reflection. Pass the screen to Partner 2 to share without previewing."
        onReady={handlePassComplete}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto flex flex-col gap-6">
      {/* Top Intimate Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-gradient-to-r from-rose-950 via-purple-950 to-slate-950 text-white p-5 rounded-3xl shadow-xl border border-rose-500/20">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 text-rose-300 flex items-center justify-center text-xl shadow-inner">
            <Heart className="w-6 h-6 fill-rose-500 text-rose-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-serif font-bold text-xl tracking-wide text-rose-100">BETWEEN US</h3>
              <Badge variant="pink" className="bg-rose-500/20 text-rose-200 border-rose-400/30 text-[10px]">
                Couples Exclusive
              </Badge>
            </div>
            <p className="text-xs text-rose-200/70">
              An intimate sanctuary for raw honesty, emotional depth, and unspoken truths.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleFinishSession}
            disabled={isMultiplayer && (phase !== 'REVEAL' || questionsAnsweredCount < 1)}
            className="border-rose-400/30 text-rose-200 hover:bg-rose-900/40 text-xs"
          >
            Wrap Up Session ({questionsAnsweredCount})
          </Button>
        </div>
      </div>

      {/* Category & Intensity Config Bar */}
      <div className="bg-white/90 backdrop-blur-md p-4 rounded-2xl border border-rose-100 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Category Picker */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-rose-500" />
          <span className="text-xs font-semibold text-gray-700 whitespace-nowrap">Category:</span>
          <select
            value={selectedCategory}
            onChange={(e) => {
              const category = e.target.value as BetweenUsCategory | 'All';
              if (isMultiplayer) void onSendAction?.({ type: 'SET_SETTINGS', category });
              else setSelectedCategory(category);
            }}
            className="text-xs bg-rose-50 border border-rose-200 text-gray-900 rounded-xl px-2.5 py-1.5 focus:ring-2 focus:ring-rose-400 outline-none w-full sm:w-56"
          >
            <option value="All">✨ All 17 Categories ({eligibleQuestions.length})</option>
            {BETWEEN_US_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>

        {/* Intensity Selector */}
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-semibold text-gray-700 mr-1">Intensity:</span>
          {INTENSITY_LEVELS.map((lvl) => {
            const isSelected = intensity === lvl.level;
            const isDark = lvl.level === 5;
            return (
              <button
                key={lvl.level}
                onClick={() => handleIntensityClick(lvl.level as 1 | 2 | 3 | 4 | 5)}
                className={`px-2.5 py-1 rounded-xl text-xs font-bold transition-all ${
                  isSelected
                    ? isDark
                      ? 'bg-rose-900 text-rose-200 ring-2 ring-rose-400 shadow-md'
                      : 'bg-rose-600 text-white shadow-md'
                    : isDark
                    ? 'bg-rose-50 text-rose-800 hover:bg-rose-100 border border-rose-200'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                title={lvl.description}
              >
                {isDark ? '18+ 🔥' : `Lvl ${lvl.level}`}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Question Card Area */}
      <div className="relative bg-gradient-to-br from-white via-rose-50/30 to-purple-50/30 rounded-3xl p-6 sm:p-8 border-2 border-rose-200/80 shadow-xl flex flex-col gap-6">
        {/* Category & Badge */}
        <div className="flex items-center justify-between">
          <Badge variant="purple" className="bg-rose-100 text-rose-800 border-rose-200 text-xs">
            {currentQuestion.category}
          </Badge>
          <div className="flex items-center gap-1.5 text-xs text-rose-600 font-semibold">
            <Lock className="w-3.5 h-3.5" />
            {isMultiplayer ? 'Private until both submit' : 'Local pass-and-play privacy'}
          </div>
        </div>

        {/* The Prompt */}
        <div className="text-center py-4">
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-gray-900 leading-relaxed px-4">
            "{currentQuestion.prompt}"
          </h2>
          {currentQuestion.guessPrompt && (
            <p className="mt-2 text-xs italic text-rose-700 font-medium">
              Optional Guessing Prompt: {currentQuestion.guessPrompt}
            </p>
          )}
        </div>

        {/* Phase 1: Partner 1 Private Input */}
        {(phase === 'P1_ANSWER' || phase === 'ONLINE_ANSWER') && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-rose-700">
              <div className={`w-6 h-6 rounded-lg ${partner1.avatarColor} text-white flex items-center justify-center text-[10px]`}>
                {partner1.avatarInitials}
              </div>
              <span>{isMultiplayer ? 'Your Confidential Submission:' : `${partner1.name}'s Confidential Submission:`}</span>
            </div>

            <textarea
              value={isMultiplayer ? draftAnswer : localP1Answer}
              onChange={(e) => isMultiplayer ? setDraftAnswer(e.target.value) : setP1Answer(e.target.value)}
              placeholder="Speak gently and honestly from your heart..."
              rows={4}
              className="w-full p-4 rounded-2xl border-2 border-rose-200 focus:border-rose-500 focus:ring-4 focus:ring-rose-200/50 outline-none text-sm text-gray-900 bg-white shadow-inner resize-none"
            />

            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={handleSkipPrompt} disabled={isMultiplayer} className="text-xs text-gray-500">
                Skip Prompt
              </Button>
              <Button
                size="md"
                onClick={handleP1Submit}
                disabled={!(isMultiplayer ? draftAnswer.trim() : localP1Answer.trim())}
                className="bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-2"
              >
                Lock My Answer <Lock className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {phase === 'WAITING' && (
          <div className="rounded-2xl border border-rose-200 bg-white p-6 text-center">
            <Lock className="mx-auto h-8 w-8 text-rose-500" />
            <h4 className="mt-3 font-bold text-gray-900">Your answer is locked</h4>
            <p className="mt-1 text-sm text-gray-600">
              It stays private until the other participant submits their answer.
            </p>
          </div>
        )}

        {/* Phase 2: Partner 2 Private Input */}
        {phase === 'P2_ANSWER' && (
          <div className="flex flex-col gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-xs font-bold text-purple-700">
              <div className={`w-6 h-6 rounded-lg ${partner2.avatarColor} text-white flex items-center justify-center text-[10px]`}>
                {partner2.avatarInitials}
              </div>
              <span>{partner2.name}'s Confidential Submission:</span>
            </div>

            <textarea
              value={localP2Answer}
              onChange={(e) => setP2Answer(e.target.value)}
              placeholder="Your vulnerable turn to share..."
              rows={4}
              className="w-full p-4 rounded-2xl border-2 border-purple-200 focus:border-purple-500 focus:ring-4 focus:ring-purple-200/50 outline-none text-sm text-gray-900 bg-white shadow-inner resize-none"
            />

            <div className="flex items-center justify-between gap-3">
              <Button variant="ghost" size="sm" onClick={handleSkipPrompt} className="text-xs text-gray-500">
                Skip Prompt
              </Button>
              <Button
                size="md"
                onClick={handleP2Submit}
                disabled={!localP2Answer.trim()}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold flex items-center gap-2"
              >
                Lock & Reveal Both Together <Eye className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Phase 4: Simultaneous Reveal & Discussion */}
        {phase === 'REVEAL' && (
          <div className="flex flex-col gap-6 animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <Badge variant="success" className="bg-emerald-100 text-emerald-800 text-xs">
                ✨ Answers Revealed Simultaneously
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Partner 1 Answer Card */}
              <div className="p-4 rounded-2xl bg-rose-50/80 border border-rose-200 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg ${partner1.avatarColor} text-white flex items-center justify-center text-[10px] font-bold`}>
                    {partner1.avatarInitials}
                  </div>
                  <span className="font-bold text-xs text-rose-950">{partner1.name}</span>
                </div>
                <p className="text-sm text-gray-800 italic bg-white p-3.5 rounded-xl border border-rose-100 shadow-inner min-h-[80px]">
                  "{p1Answer}"
                </p>
              </div>

              {/* Partner 2 Answer Card */}
              <div className="p-4 rounded-2xl bg-purple-50/80 border border-purple-200 flex flex-col gap-2 shadow-sm">
                <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-lg ${partner2.avatarColor} text-white flex items-center justify-center text-[10px] font-bold`}>
                    {partner2.avatarInitials}
                  </div>
                  <span className="font-bold text-xs text-purple-950">{partner2.name}</span>
                </div>
                <p className="text-sm text-gray-800 italic bg-white p-3.5 rounded-xl border border-purple-100 shadow-inner min-h-[80px]">
                  "{p2Answer}"
                </p>
              </div>
            </div>

            {/* Conversation Deepener Tools */}
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              {currentQuestion.followUp && !showFollowUp && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowFollowUp(true)}
                  className="text-xs border-rose-300 text-rose-700 hover:bg-rose-50"
                >
                  <MessageCircle className="w-3.5 h-3.5 mr-1" />
                  Show Deepening Follow-up Question
                </Button>
              )}

              {!showSurpriseCard && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSurpriseCard(true)}
                  className="text-xs border-purple-300 text-purple-700 hover:bg-purple-50"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-1" />
                  Surprise Reflection Card
                </Button>
              )}
            </div>

            {/* Follow-up card */}
            {showFollowUp && currentQuestion.followUp && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-xs text-amber-950 animate-in fade-in">
                <p className="font-bold mb-1 flex items-center gap-1.5 text-amber-800">
                  <HelpCircle className="w-4 h-4 text-amber-600" /> Follow-Up Exploration:
                </p>
                <p className="italic">{currentQuestion.followUp}</p>
              </div>
            )}

            {/* Surprise reflection card */}
            {showSurpriseCard && (
              <div className="p-4 rounded-2xl bg-rose-950 text-rose-100 text-xs shadow-lg animate-in fade-in">
                <p className="font-bold mb-1 flex items-center gap-1.5 text-rose-300">
                  <Sparkles className="w-4 h-4 text-rose-400" /> Surprise Warmth Prompt:
                </p>
                <p className="italic">
                  "Take 30 seconds to hold hands, look into each other's eyes, and say one thing you deeply appreciate about how your partner answered just now."
                </p>
              </div>
            )}

            {/* Next Prompt Action */}
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs text-gray-500">
                Take your time to discuss. When ready, proceed.
              </span>
              <Button
                size="md"
                onClick={handleNextPrompt}
                className="bg-gradient-to-r from-rose-600 to-purple-600 hover:from-rose-700 hover:to-purple-700 text-white font-bold flex items-center gap-2"
              >
                Next Thoughtful Prompt <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Adult Consent Modal for Level 5 */}
      <Modal
        isOpen={showConsentModal}
        onClose={() => setShowConsentModal(false)}
        title="Level 5: After Dark (18+) Mutual Consent"
        maxWidth="md"
      >
        <div className="flex flex-col gap-4 text-sm text-gray-700">
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-xs text-rose-900 leading-relaxed">
              Level 5 explores physical romance, sensual intimacy, and uninhibited passion. Better-Half is committed to safe, healthy connection. Do both of you mutually consent to explore this level tonight?
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setShowConsentModal(false)}>
              Decline & Keep Current Level
            </Button>
            <Button
              size="sm"
              onClick={handleGrantConsent}
              className="bg-rose-700 hover:bg-rose-800 text-white font-bold flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              Yes, Both of Us Agree & Consent
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
