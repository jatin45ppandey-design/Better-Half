export interface BetweenUsQuestion {
  id: string;
  category: string;
  intensity: 1 | 2 | 3 | 4 | 5;
  prompt: string;
  followUp?: string;
  guessPrompt?: string;
  isAfterDark?: boolean;
}

export const BETWEEN_US_CATEGORIES = [
  'Trust & Loyalty',
  'Jealousy & Insecurity',
  'Past & Secrets',
  'Guilt & Regret',
  'Flirting & Boundaries',
  'Relationship Conflicts',
  'Unspoken Feelings',
  'Brutal Honesty',
  'Uncomfortable Truths',
  'What If?',
  'Hidden Expectations',
  'Confession Room',
  'Red Flag Confessions',
  'Emotional Vulnerability',
  'Love vs Attachment',
  'Future & Commitment',
  'Romance & Intimacy',
] as const;

export type BetweenUsCategory = typeof BETWEEN_US_CATEGORIES[number];

export const INTENSITY_LEVELS = [
  { level: 1, label: 'Level 1: Casual', description: 'Lighthearted, cozy curiosities and warm reflections.' },
  { level: 2, label: 'Level 2: Personal', description: 'Real experiences, sweet habits, and daily emotional habits.' },
  { level: 3, label: 'Level 3: Deep', description: 'Meaningful vulnerabilities, hidden thoughts, and tender truths.' },
  { level: 4, label: 'Level 4: Unfiltered', description: 'Raw honesty, sensitive pasts, and unspoken expectations.' },
  { level: 5, label: 'Level 5: After Dark (18+)', description: 'Sensual intimacy, passionate confessions, and raw desire. (Requires mutual consent).', isConsentRequired: true },
] as const;

export const BETWEEN_US_QUESTIONS: BetweenUsQuestion[] = [
  // 1. Trust & Loyalty
  {
    id: 'tl-1',
    category: 'Trust & Loyalty',
    intensity: 1,
    prompt: 'What was the specific moment you realized you could trust me with your guards down?',
    followUp: 'Did you hesitate at first or did it feel natural?',
    guessPrompt: 'Guess which month/place they felt this!'
  },
  {
    id: 'tl-2',
    category: 'Trust & Loyalty',
    intensity: 3,
    prompt: 'Has there ever been a small doubt or hesitation you had about our commitment that you kept to yourself?',
    followUp: 'What helped reassure you since then?'
  },
  {
    id: 'tl-3',
    category: 'Trust & Loyalty',
    intensity: 4,
    prompt: 'If you looked through my phone right now, what would you realistically expect or fear seeing?',
    followUp: 'Where does that curiosity stem from?'
  },

  // 2. Jealousy & Insecurity
  {
    id: 'ji-1',
    category: 'Jealousy & Insecurity',
    intensity: 2,
    prompt: 'When was the last time you felt a tiny twinge of jealousy regarding me, even if it was irrational?',
    followUp: 'Did you show it or bury it in the moment?'
  },
  {
    id: 'ji-2',
    category: 'Jealousy & Insecurity',
    intensity: 3,
    prompt: 'What is a personal physical or emotional insecurity you secretly worry might make you less attractive to me?',
    followUp: 'What can I do to make you feel loved in those moments?'
  },

  // 3. Past & Secrets
  {
    id: 'ps-1',
    category: 'Past & Secrets',
    intensity: 2,
    prompt: 'What is a story from your teenage or childhood years that you rarely tell anyone?',
    followUp: 'Why has that memory stayed with you for so long?'
  },
  {
    id: 'ps-2',
    category: 'Past & Secrets',
    intensity: 4,
    prompt: 'Is there an emotional scar from a past relationship or family experience that still occasionally influences how you react to me?',
    followUp: 'How can I best support you when that trigger appears?'
  },

  // 4. Guilt & Regret
  {
    id: 'gr-1',
    category: 'Guilt & Regret',
    intensity: 2,
    prompt: 'What is a past disagreement between us where you later realized you were in the wrong, but never fully said it?',
    followUp: 'How did it feel carrying that thought?'
  },
  {
    id: 'gr-2',
    category: 'Guilt & Regret',
    intensity: 4,
    prompt: 'What is one thing you wish you had done differently in the early weeks or months of our relationship?',
    followUp: 'What would that change have prevented?'
  },

  // 5. Flirting & Boundaries
  {
    id: 'fb-1',
    category: 'Flirting & Boundaries',
    intensity: 1,
    prompt: 'What is something I do innocently that you secretly find completely irresistible?',
    guessPrompt: 'Guess the habit or gesture!'
  },
  {
    id: 'fb-2',
    category: 'Flirting & Boundaries',
    intensity: 3,
    prompt: 'Where exactly is the line between playful friendly banter with someone else and crossing an emotional boundary for you?',
    followUp: 'Have we ever disagreed on where that line sits?'
  },

  // 6. Relationship Conflicts
  {
    id: 'rc-1',
    category: 'Relationship Conflicts',
    intensity: 2,
    prompt: 'When we argue or disagree, what is my communication habit that frustrates you the most?',
    followUp: 'And what is something I do during conflicts that genuinely helps de-escalate?'
  },
  {
    id: 'rc-2',
    category: 'Relationship Conflicts',
    intensity: 4,
    prompt: 'Is there an unresolved disagreement between us that you’ve swept under the rug just to keep the peace?',
    followUp: 'What would it take to peacefully resolve it today?'
  },

  // 7. Unspoken Feelings
  {
    id: 'uf-1',
    category: 'Unspoken Feelings',
    intensity: 1,
    prompt: 'What is a sweet compliment you often think about me in your head, but forget to say out loud?',
    guessPrompt: 'Guess what trait they are admiring!'
  },
  {
    id: 'uf-2',
    category: 'Unspoken Feelings',
    intensity: 3,
    prompt: 'When do you feel most emotionally distant from me, and what pulls you back close?',
    followUp: 'How can we bridge that gap faster?'
  },

  // 8. Brutal Honesty
  {
    id: 'bh-1',
    category: 'Brutal Honesty',
    intensity: 2,
    prompt: 'What is one quirky habit or mannerism of mine that tests your patience the most?',
    followUp: 'Does it annoy you or do you secretly find it endearing?'
  },
  {
    id: 'bh-2',
    category: 'Brutal Honesty',
    intensity: 4,
    prompt: 'If you had to give our relationship an honest performance review for this past month, what would be our biggest strength and our biggest area for growth?',
    followUp: 'What is one realistic step we can take this week?'
  },

  // 9. Uncomfortable Truths
  {
    id: 'ut-1',
    category: 'Uncomfortable Truths',
    intensity: 3,
    prompt: 'Do you ever compare any aspect of our life or dynamic to other couples on social media or in our friend circle?',
    followUp: 'What triggers that comparison?'
  },
  {
    id: 'ut-2',
    category: 'Uncomfortable Truths',
    intensity: 4,
    prompt: 'What is something you pretend to enjoy doing with me that you actually just tolerate because it makes me happy?',
    followUp: 'Is there an alternative we would both genuinely love?'
  },

  // 10. What If?
  {
    id: 'wi-1',
    category: 'What If?',
    intensity: 1,
    prompt: 'If we could drop everything tomorrow and live anywhere in the world for 6 months, where would we go and what would our mornings look like?',
    guessPrompt: 'Guess their dream destination!'
  },
  {
    id: 'wi-2',
    category: 'What If?',
    intensity: 3,
    prompt: 'If we had met 5 years earlier than we did, do you think we would have ended up together, or did we need to grow first?',
    followUp: 'What growth made you ready for us?'
  },

  // 11. Hidden Expectations
  {
    id: 'he-1',
    category: 'Hidden Expectations',
    intensity: 2,
    prompt: 'What is an emotional need of yours that you wish I could anticipate without you having to ask for it?',
    followUp: 'What subtle cues do you give when you need that?'
  },
  {
    id: 'he-2',
    category: 'Hidden Expectations',
    intensity: 4,
    prompt: 'Do you ever feel subtle pressure to match my energy or expectations when you just want to rest?',
    followUp: 'How can I create space where you feel 100% accepted in your downtime?'
  },

  // 12. Confession Room
  {
    id: 'cr-1',
    category: 'Confession Room',
    intensity: 2,
    prompt: 'What is a small, harmless lie you told me earlier in our relationship that you still haven’t corrected?',
    followUp: 'Reveal the truth now with zero judgment!'
  },
  {
    id: 'cr-2',
    category: 'Confession Room',
    intensity: 4,
    prompt: 'What is a thought you’ve had about our future that both excited you and terrified you at the same time?',
    followUp: 'What makes the terrifying part scary?'
  },

  // 13. Red Flag Confessions
  {
    id: 'rf-1',
    category: 'Red Flag Confessions',
    intensity: 2,
    prompt: 'What was your honest initial "amber flag" or hesitation about me when we first started getting close?',
    followUp: 'When did that concern completely melt away?'
  },
  {
    id: 'rf-2',
    category: 'Red Flag Confessions',
    intensity: 3,
    prompt: 'What is one of your own toxic or stubborn traits that you have to consciously work to keep in check with me?',
    followUp: 'How can I gently call it out without you feeling attacked?'
  },

  // 14. Emotional Vulnerability
  {
    id: 'ev-1',
    category: 'Emotional Vulnerability',
    intensity: 2,
    prompt: 'When was the last time you felt like crying or overwhelmed, and did you feel safe sharing that with me?',
    followUp: 'What brings you the deepest comfort when life feels heavy?'
  },
  {
    id: 'ev-2',
    category: 'Emotional Vulnerability',
    intensity: 4,
    prompt: 'What is the deepest fear you have about losing yourself or changing too much in a long-term partnership?',
    followUp: 'How can we preserve our independent individual sparks?'
  },

  // 15. Love vs Attachment
  {
    id: 'la-1',
    category: 'Love vs Attachment',
    intensity: 3,
    prompt: 'How do you distinguish between loving me for who I genuinely am versus being attached to the comfort and routine I provide?',
    followUp: 'What is an example of when you felt pure, unconditional love?'
  },
  {
    id: 'la-2',
    category: 'Love vs Attachment',
    intensity: 4,
    prompt: 'If our dynamic had to withstand a year of long-distance or high stress, what is the single anchor that would keep us solid?',
    followUp: 'What habits nurture that anchor right now?'
  },

  // 16. Future & Commitment
  {
    id: 'fc-1',
    category: 'Future & Commitment',
    intensity: 1,
    prompt: 'Describe what an ideal lazy Sunday morning looks like for us 5 years from today.',
    guessPrompt: 'Guess the breakfast and setting!'
  },
  {
    id: 'fc-2',
    category: 'Future & Commitment',
    intensity: 3,
    prompt: 'What is the biggest personal or financial goal you want us to conquer as a team over the next 2 years?',
    followUp: 'What role do you need me to play in making it happen?'
  },

  // 17. Romance & Intimacy
  {
    id: 'ri-1',
    category: 'Romance & Intimacy',
    intensity: 2,
    prompt: 'What was our single most romantic date or private memory so far, and what made it so special to you?',
    guessPrompt: 'Guess the specific date!'
  },
  {
    id: 'ri-2',
    category: 'Romance & Intimacy',
    intensity: 3,
    prompt: 'In what ways has our physical and emotional intimacy evolved since we met, and what do you hope blossoms next?',
    followUp: 'What brings back that new-relationship spark instantly?'
  },

  // LEVEL 5: AFTER DARK (18+ EXPLICIT CONSENT REQUIRED)
  {
    id: 'ad-1',
    category: 'Romance & Intimacy',
    intensity: 5,
    prompt: 'What is a sensual fantasy or private desire you’ve thought about with me but have felt too shy to bring up?',
    followUp: 'What would make you feel completely confident exploring it together?',
    isAfterDark: true
  },
  {
    id: 'ad-2',
    category: 'Flirting & Boundaries',
    intensity: 5,
    prompt: 'What is the most intense, unforgettable physical touch or moment of eye contact we’ve ever shared in private?',
    followUp: 'What made that specific touch so electrifying?',
    isAfterDark: true
  },
  {
    id: 'ad-3',
    category: 'Confession Room',
    intensity: 5,
    prompt: 'What is a spontaneous or adventurous place you’ve secretly imagined being intimate with me?',
    followUp: 'What would have to happen for us to actually make that memory?',
    isAfterDark: true
  }
];
