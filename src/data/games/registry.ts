import type { GameItem, ModeDetail, GameCategory } from '../../types/game';

export const MODES_DATA: ModeDetail[] = [
  {
    id: 'couple',
    name: 'Couple Mode',
    tagline: 'Intimate, playful, and crafted for two',
    playerCount: '2 Players',
    description: 'Designed specifically for partners to bond, laugh, share vulnerable secrets, and test their chemistry through cozy duels and deep questions.',
    badge: 'Cozy Duo Experience',
    icon: 'Heart',
    accent: {
      bg: 'from-[#FDF2F8] to-[#F1EAFF]',
      border: 'border-[#EAE3F3] hover:border-[#D8B4FE]',
      pill: 'bg-[#FCE7F3] text-[#9D174D]',
    },
    highlights: [
      'Heartfelt deep conversation prompts in BETWEEN US',
      'Exclusive Couple Truth or Dare & Would You Rather decks',
      'Pass-and-play privacy flow or synced lobby link',
      'Cozy, distraction-free lavender atmosphere'
    ]
  },
  {
    id: 'friend',
    name: 'Friend Mode',
    tagline: 'High-energy party games for your crew',
    playerCount: 'Up to 4 Players',
    description: 'Built for spirited game nights, friendly rivalries, unexpected chaos, and nonstop banter across card games, physics showdowns, and opinion clashes.',
    badge: 'Group Party Arena',
    icon: 'Users',
    accent: {
      bg: 'from-[#F5F3FF] to-[#EDE9FE]',
      border: 'border-[#EAE3F3] hover:border-[#C4B5FD]',
      pill: 'bg-[#EDE9FE] text-[#593B91]',
    },
    highlights: [
      'Fast-paced card and strategy showdowns like Kabza and UNO-style',
      'Hilarious blind ranking arguments and quick duels',
      'Lightning-fast reflex clashes like Snatch the Fries',
      'Supports up to 4 players with lobby game voting & live scores'
    ]
  }
];

export const GAMES_DATA: GameItem[] = [
  {
    id: 'truth-or-dare',
    name: 'Truth or Dare',
    tagline: 'Spicy confessions and hilarious dares',
    description: 'Classic intimacy icebreaker upgraded with curated mood decks from lighthearted giggle-starters to spicy dares and vulnerable questions.',
    category: 'Connection',
    modes: ['couple'], // Couple Mode EXCLUSIVE
    minPlayers: 2,
    maxPlayers: 2,
    estimatedMinutes: '15-30 min',
    iconName: 'Flame',
    badgeText: 'Couple Exclusive',
    accentColor: {
      bg: 'bg-[#FDF2F8]',
      border: 'border-[#FBCFE8]',
      text: 'text-[#9D174D]',
      pillBg: 'bg-[#FCE7F3]'
    },
    rulesPreview: [
      'Take turns choosing Truth or Dare.',
      'Select from Romantic, Funny, Personal, or Challenging categories.',
      'Max 2 skips allowed per session—or take a lighthearted forfeit!'
    ],
    instructions: {
      overview: 'A playful conversational duel tailored for two. Take turns facing spicy truths and adventurous dares with adjustable intensity.',
      rules: [
        'Active player selects Truth or Dare from the current category.',
        'Read the prompt aloud and answer honestly or perform the dare.',
        'Use a Skip if uncomfortable (max 2 per player).',
        'Turn passes to the partner once completed.'
      ],
      controls: 'Tap Truth or Dare buttons, use Skip or Shuffle controls, and tap "Completed" to pass turn.',
      prototypeNotes: 'Includes privacy pass-device screens and optional response timers in local demo.'
    },
    featured: true
  },
  {
    id: 'would-you-rather',
    name: 'Would You Rather',
    tagline: 'Agonizing choices and quirky dilemmas',
    description: 'Vote on absurd, philosophical, and intimate dilemmas. Lock answers secretly and reveal simultaneously to compare priorities.',
    category: 'Connection',
    modes: ['couple'], // Couple Mode EXCLUSIVE
    minPlayers: 2,
    maxPlayers: 2,
    estimatedMinutes: '10-20 min',
    iconName: 'HelpCircle',
    badgeText: 'Couple Exclusive',
    accentColor: {
      bg: 'bg-[#EFF6FF]',
      border: 'border-[#BFDBFE]',
      text: 'text-[#1E40AF]',
      pillBg: 'bg-[#DBEAFE]'
    },
    rulesPreview: [
      'Each round presents two tricky dilemmas.',
      'Both players submit their answer privately without peeking.',
      'Simultaneous reveal reveals compatibility score and sparks discussion!'
    ],
    instructions: {
      overview: 'Each round reveals two compelling options. Both partners secretly submit their pick before the simultaneous reveal.',
      rules: [
        'Player 1 selects Option A or Option B on their turn.',
        'Screen hides the pick and prompts to pass device to Player 2.',
        'Player 2 submits their pick.',
        'Both answers are revealed at once with a compatibility indicator!'
      ],
      controls: 'Tap option cards to lock selection; tap "Reveal Answers" to compare.',
      prototypeNotes: 'Uses a pass-device privacy shield so neither player sees the other choice before reveal.'
    },
    featured: false
  },
  {
    id: 'blind-ranking',
    name: 'Blind Ranking',
    tagline: 'Rank 5 mystery items with zero foresight',
    description: 'Place mystery items into ranks 1 through 5 one by one without knowing what is coming next. Test your intuition and argue rankings.',
    category: 'Party',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '5-15 min',
    iconName: 'ListOrdered',
    badgeText: 'Banter & Chaos',
    accentColor: {
      bg: 'bg-[#FEF3C7]',
      border: 'border-[#FDE68A]',
      text: 'text-[#92400E]',
      pillBg: 'bg-[#FEF3C7]'
    },
    rulesPreview: [
      'A topic is revealed (e.g., Late Night Food, Movie Tropes, Annoying Habits).',
      'Five mystery cards appear one by one.',
      'Commit to an open rank slot immediately—no reordering allowed!'
    ],
    instructions: {
      overview: 'Rank 5 mystery items without knowing what items come next. Once a slot is filled, it is permanently locked.',
      rules: [
        'Read the revealed item.',
        'Tap an open rank slot from #1 (Best) to #5 (Worst).',
        'Lock in your pick. Next item appears.',
        'Once all 5 slots are filled, boards are compared and compatibility/agreement is scored.'
      ],
      controls: 'Click/tap available numbered slots to place items.',
      prototypeNotes: 'Supports pass-and-play ranking for 2-4 players with side-by-side comparison.'
    },
    featured: false
  },
  {
    id: 'uno-style',
    name: 'Original UNO-style Card Game',
    tagline: 'Ruthless colors, numbers, and +4 reversals',
    description: 'Fast-paced, original card shedding showdown. Match colors or numbers, drop wild +4 reversals, and call your last card before winning.',
    category: 'Card & Board',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '10-25 min',
    iconName: 'Layers',
    badgeText: 'Card Classic',
    accentColor: {
      bg: 'bg-[#FEE2E2]',
      border: 'border-[#FECACA]',
      text: 'text-[#991B1B]',
      pillBg: 'bg-[#FEE2E2]'
    },
    rulesPreview: [
      'Match the top discard by color, number, or action symbol.',
      'Use Skips, Reverses, and +2 / Wild +4 cards to thwart opponents.',
      'First player to shed all cards wins the match!'
    ],
    instructions: {
      overview: 'An original casual card shedding game. Players start with 7 cards. Match the discard pile by color or number to shed your hand.',
      rules: [
        'On your turn, play a card matching the active color or rank, or play a Wild card.',
        'Special action cards: Skip skips next player, Reverse changes direction, +2 forces next player to draw 2.',
        'Wild and Wild +4 allow choosing the next active color.',
        'If you have no legal play, draw one card from the draw pile.',
        'First player to reach 0 cards wins.'
      ],
      controls: 'Click cards in your hand to play them. Click draw pile to draw.',
      prototypeNotes: 'Provisional rule decisions (draw stacking, immediate play upon draw) documented in phase-2-prototype-rule-decisions.md.'
    },
    featured: true
  },
  {
    id: 'tic-tac-toe',
    name: 'Tic Tac Toe',
    tagline: 'Timeless grid showdown with a tactical twist',
    description: 'The classic 3x3 strategy duel refined with snappy turn timers, Best-of-3 / Best-of-5 tournament tracking, and spectator queue for 3-4 players.',
    category: 'Quick Duel',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    activeBoardPlayers: 2, // Active board is strictly 2 players
    estimatedMinutes: '3-5 min',
    iconName: 'Grid3X3',
    badgeText: '2P Duel (Queue Enabled)',
    accentColor: {
      bg: 'bg-[#F3E8FF]',
      border: 'border-[#E9D5FF]',
      text: 'text-[#6B21A8]',
      pillBg: 'bg-[#F3E8FF]'
    },
    rulesPreview: [
      'Players alternate placing X or O on the 3x3 grid.',
      'Align three marks horizontally, vertically, or diagonally to score a round.',
      'In Friend Mode (3-4P), 2 players duel while others queue for next match!'
    ],
    instructions: {
      overview: 'Fast-paced 3x3 grid duel. Align 3 of your marks in any direction to win the round.',
      rules: [
        'Players alternate turns placing X or O.',
        'First to connect 3 in a line wins 1 point.',
        'If the grid fills with no winner, round is a draw.',
        'First to win 2 of 3 (or 3 of 5) rounds takes match victory.',
        'In Friend Mode with 3-4 players, the waiting player challenges the winner in next match.'
      ],
      controls: 'Click any open grid cell on your turn.',
      prototypeNotes: 'Enforces active duelists = 2; non-playing room members have spectator/waiting badge.'
    },
    featured: false
  },
  {
    id: 'pen-fight',
    name: 'Pen Fight',
    tagline: 'School desk physics simulator & flick clash',
    description: 'Nostalgic desk battle! Angle your virtual pen, balance flick impulse, and knock your opponents off the wooden tabletop.',
    category: 'Arcade & Physics',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '5-10 min',
    iconName: 'Swords',
    badgeText: 'Physics Flick Arena',
    accentColor: {
      bg: 'bg-[#E0F2FE]',
      border: 'border-[#BAE6FD]',
      text: 'text-[#0369A1]',
      pillBg: 'bg-[#E0F2FE]'
    },
    rulesPreview: [
      'Drag back from your pen to aim and set flick force.',
      'Release to strike! Collide with rival pens to push them off the desk.',
      'Last pen remaining on the table scores the round point.'
    ],
    instructions: {
      overview: 'Flick your pen across the desk surface to dislodge opponents while remaining on the table yourself.',
      rules: [
        'Players take turns aiming their pen with drag-and-release impulse.',
        'Elastic collisions push other pens upon impact.',
        'If a pen completely crosses the table boundary, it falls off and is eliminated for the round.',
        'Last pen remaining on the desk wins 1 point. First to 3 points wins match.'
      ],
      controls: 'Click and drag back from your pen to aim trajectory line and power meter. Release to launch.',
      prototypeNotes: 'Local prototype 2D physics simulation with surface friction and elastic restitution.'
    },
    featured: true
  },
  {
    id: 'kabza',
    name: 'Kabza',
    tagline: 'Strategic territory conquer board duel',
    description: 'A tactical grid territory capture showdown. Place markers, build enclosures, convert enemy cells, and claim maximum board dominance.',
    category: 'Card & Board',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '10-20 min',
    iconName: 'Crown',
    badgeText: 'Territory Strategy',
    accentColor: {
      bg: 'bg-[#ECFDF5]',
      border: 'border-[#A7F3D0]',
      text: 'text-[#065F46]',
      pillBg: 'bg-[#D1FAE5]'
    },
    rulesPreview: [
      'Take turns placing your clan stone on empty grid nodes.',
      'Enclose opponent stones or build contiguous territory walls to capture cells.',
      'Player with the highest percentage of territory when board fills wins.'
    ],
    instructions: {
      overview: 'Strategic territory control on an evolving grid. Expand your borders and trap enemy territory to convert it.',
      rules: [
        'Players take turns placing a territory marker on an unoccupied grid cell.',
        'If a move flanks or surrounds enemy cells horizontally or vertically, those cells flip to your clan!',
        'Special corner bonus points awarded for perimeter control.',
        'Match concludes after 24 total turns or board fill. Highest territory score wins.'
      ],
      controls: 'Click any valid empty cell to place your territory marker.',
      prototypeNotes: 'Configurable board dimensions and capture algorithms documented in rule decision docs.'
    },
    featured: false
  },
  {
    id: 'basketball-rivalry',
    name: 'Basketball Rivalry',
    tagline: 'Arcade hoop shootouts & buzzer beaters',
    description: 'Swipe-to-shoot head-to-head arcade basketball. Master arc calculation, bank off the backboard, chain swish streaks, and race the shot clock.',
    category: 'Arcade & Physics',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '3-8 min',
    iconName: 'Trophy',
    badgeText: 'Arcade Shootout',
    accentColor: {
      bg: 'bg-[#FFEDD5]',
      border: 'border-[#FED7AA]',
      text: 'text-[#9A3412]',
      pillBg: 'bg-[#FFEDD5]'
    },
    rulesPreview: [
      'Drag and release to calibrate shot trajectory and arc.',
      'Clean swishes award 3 points; rim banks award 2 points.',
      'Score multiplier builds with consecutive baskets!'
    ],
    instructions: {
      overview: 'Arcade basketball shootout. Each player takes shots to score as many points as possible before round time expires.',
      rules: [
        'Each turn gives 5 basketball shots (or 45s round clock).',
        'Drag backward from ball to aim angle and release with proper impulse.',
        'Swish = 3 points + streak bonus. Rim bank = 2 points. Miss = 0.',
        'Highest total score after rounds wins the championship trophy.'
      ],
      controls: 'Click and pull down/back to aim the arc, release to shoot.',
      prototypeNotes: 'Configurable gravity, backboard restitution, and difficulty tiers.'
    },
    featured: false
  },
  {
    id: 'snatch-the-fries',
    name: 'Snatch the Fries',
    tagline: 'High-tension reflex clash over the golden fry',
    description: 'Two to four hands hover over a fast-food tray. Wait for the suspenseful audio/visual drop, then tap before rivals snatch the prize.',
    category: 'Quick Duel',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '2-5 min',
    iconName: 'Zap',
    badgeText: 'Reflex Clash',
    accentColor: {
      bg: 'bg-[#FEF9C3]',
      border: 'border-[#FEF08A]',
      text: 'text-[#854D0E]',
      pillBg: 'bg-[#FEF9C3]'
    },
    rulesPreview: [
      'Keep fingers ready on your assigned player buzzer.',
      'When the fry shakes and drops, tap instantly to snatch!',
      'Tapping before the signal incurs a false-start penalty (-50 pts).'
    ],
    instructions: {
      overview: 'Lightning reaction speed game. Watch the fry basket—at a random moment, a golden fry drops. Fastest tap snatches the points.',
      rules: [
        'Round begins with fry basket vibrating in suspense.',
        'At a random interval between 1.5s and 4.0s, the golden fry drops with a signal!',
        'Tap your player snatch button immediately.',
        'First valid tap wins +100 pts. False-start tap before signal deducts -50 pts.',
        'First player to collect 5 fries (or highest score after 10 rounds) wins.'
      ],
      controls: 'Click your assigned player zone / button or use keyboard keys (P1: Q, P2: P, P3: Z, P4: M).',
      prototypeNotes: 'Fair local timestamp check preventing double-snatches.'
    },
    featured: false
  },
  {
    id: 'aloo-golf',
    name: 'Aloo Golf',
    tagline: 'Irregular potato physics mini-golf madness',
    description: 'Wacky mini-golf where your ball is an irregularly shaped potato that wobbles, bounces, and tumbles across whimsical obstacle greens.',
    category: 'Arcade & Physics',
    modes: ['couple', 'friend'],
    minPlayers: 2,
    maxPlayers: 4,
    estimatedMinutes: '10-20 min',
    iconName: 'Target',
    badgeText: 'Potato Mini-Golf',
    accentColor: {
      bg: 'bg-[#F0FDF4]',
      border: 'border-[#BBF7D0]',
      text: 'text-[#166534]',
      pillBg: 'bg-[#DCFCE7]'
    },
    rulesPreview: [
      'Aim your putt and gauge power to navigate potato hazards.',
      'Account for the lumpy potato\'s eccentric tumble roll.',
      'Sink the potato in the fewest strokes across 3 holes to win.'
    ],
    instructions: {
      overview: 'Miniature golf with a twist—your ball is a lumpy potato with unpredictable roll dynamics.',
      rules: [
        'Players alternate turns putting their potato toward the flag.',
        'Drag backward to set shot direction and power.',
        'Avoid sand pits and butter slicks which alter friction.',
        'Sink the potato into the hole in fewer strokes than par.',
        'Lowest stroke count across 3 holes wins.'
      ],
      controls: 'Click/drag back from the potato to aim putt angle and power, release to stroke.',
      prototypeNotes: 'Eccentric rotational wobble formula applied to ball physics.'
    },
    featured: false
  },
  {
    id: 'between-us',
    name: 'BETWEEN US',
    tagline: 'Deep connection questions exclusively for two',
    description: 'A mature, private, emotionally thoughtful connection experience with 17 categories, 5 intensity levels, and confidential simultaneous reveals.',
    category: 'Connection',
    modes: ['couple'], // Couple Mode EXCLUSIVE
    minPlayers: 2,
    maxPlayers: 2,
    estimatedMinutes: '20-45 min',
    iconName: 'Heart',
    badgeText: 'Couple Intimacy Exclusive',
    accentColor: {
      bg: 'bg-[#FDF2F8]',
      border: 'border-[#FBCFE8]',
      text: 'text-[#9D174D]',
      pillBg: 'bg-[#FCE7F3]'
    },
    rulesPreview: [
      'Choose from 17 deep categories across 5 intensity levels.',
      'Level 5 (After Dark 18+) requires explicit mutual consent.',
      'Both submit answers privately in-memory before simultaneous reveal.'
    ],
    instructions: {
      overview: 'A dedicated intimacy experience created exclusively for couples to spark meaningful, honest, and respectful conversations.',
      rules: [
        'Partners select categories and agree upon an intensity level (1 to 5).',
        'Both read the same prompt.',
        'Partner 1 submits their confidential reflection (no peeking!).',
        'Partner 2 submits their confidential reflection.',
        'Both reflections are simultaneously unlocked for honest, open discussion.',
        'Special cards available: Surprise Card, Guess My Answer, and Follow-up Prompts.'
      ],
      controls: 'Type private thoughts into confidential input, tap "Lock Response", and tap "Reveal Both".',
      prototypeNotes: 'Responses stored in temporary in-memory session only; never persisted to localStorage for strict privacy.'
    },
    featured: true
  }
];

export const GAME_CATEGORIES: GameCategory[] = [
  'All',
  'Connection',
  'Party',
  'Quick Duel',
  'Card & Board',
  'Arcade & Physics'
];



// Single source of truth helper functions
export function getGamesForMode(mode: 'couple' | 'friend'): GameItem[] {
  return GAMES_DATA.filter((g) => g.modes.includes(mode));
}

export function isGameEligibleForMode(gameId: string, mode: 'couple' | 'friend'): boolean {
  const game = GAMES_DATA.find((g) => g.id === gameId);
  return game ? game.modes.includes(mode) : false;
}

export function getGameById(gameId: string): GameItem | undefined {
  return GAMES_DATA.find((g) => g.id === gameId);
}
