export interface BlindRankingCategory {
  id: string;
  title: string;
  description: string;
  items: string[];
}

export const BLIND_RANKING_CATEGORIES: BlindRankingCategory[] = [
  {
    id: 'food',
    title: 'Late Night Cravings',
    description: 'Rank these 5 midnight munchies without knowing which is coming next!',
    items: [
      'Street Style Tacos with Extra Lime',
      'Piping Hot Sourdough Margherita Pizza',
      'Loaded Cheese & Bacon Fries',
      'Artisanal Salted Caramel Ice Cream',
      'Steaming Bowl of Rich Miso Ramen'
    ]
  },
  {
    id: 'dates',
    title: 'Romantic Date Concepts',
    description: 'Rank these 5 date formats from dream tier down to skips!',
    items: [
      'Golden Hour Sunset Beach Picnic',
      'Interactive Pasta Making & Wine Workshop',
      'Neon Arcade & Midnight Bowling Showdown',
      'Candlelit Rooftop Dining with City Views',
      'Cozy Blanket Fort & Studio Ghibli Marathon'
    ]
  },
  {
    id: 'tropes',
    title: 'Cinema & Story Tropes',
    description: 'Rank these 5 classic plot devices blindly!',
    items: [
      'Enemies to Lovers Slow Burn Romance',
      'The Shocking Third-Act Identity Twist',
      'The High-Stakes Training Montage with Epic Score',
      'Messy Time Loop / Butterfly Effect Paradox',
      'The Reluctant Hero Who Denies The Call'
    ]
  },
  {
    id: 'superpowers',
    title: 'Fantasy Superpowers',
    description: 'Rank these 5 superhuman abilities as your daily power!',
    items: [
      'Instant Global Teleportation',
      'Complete Time Freezing for 60 Seconds',
      'Selective Telepathy / Mind Reading',
      'Sonic Speed & Physics Defying Reflexes',
      'Total Shape-Shifting & Disguise Mastery'
    ]
  },
  {
    id: 'pet-peeves',
    title: 'Minor Everyday Annoyances',
    description: 'Rank which of these quirky habits tests your sanity the most!',
    items: [
      'People Who Snooze Alarms 6 Times in a Row',
      'Leaving Bedroom Doors Open 2 Inches',
      'Replying to Long Heartfelt Paragraphs with Just "K"',
      'Loud Chewing During a Quiet Movie Scene',
      'Unsolicited Movie Spoilers in Casual Banter'
    ]
  }
];
