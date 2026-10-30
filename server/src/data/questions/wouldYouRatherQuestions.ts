export interface WouldYouRatherItem {
  id: string;
  category: 'Romantic' | 'Funny' | 'Personal' | 'Difficult';
  optionA: string;
  optionB: string;
  contextTip?: string;
}

export const WOULD_YOU_RATHER_ITEMS: WouldYouRatherItem[] = [
  {
    id: 'wyr-1',
    category: 'Romantic',
    optionA: 'Spend every weekend on spontaneous luxury surprise getaways',
    optionB: 'Spend every evening building a dream cozy home together in total tranquility'
  },
  {
    id: 'wyr-2',
    category: 'Romantic',
    optionA: 'Always know exactly what your partner is thinking at all times',
    optionB: 'Keep the mystery alive and be surprised by their thoughts forever'
  },
  {
    id: 'wyr-3',
    category: 'Funny',
    optionA: 'Have to announce your partner\'s entrance like a WWE wrestler every time they walk in',
    optionB: 'Have to sing your responses in opera style whenever you ask for a favor'
  },
  {
    id: 'wyr-4',
    category: 'Funny',
    optionA: 'Accidentally send a cringey romantic love note to your partner\'s boss',
    optionB: 'Have your partner\'s parents join you on your dream romantic anniversary vacation'
  },
  {
    id: 'wyr-5',
    category: 'Personal',
    optionA: 'Be able to pause time when life gets too stressful',
    optionB: 'Be able to rewind time by 10 minutes whenever a conversation goes off track'
  },
  {
    id: 'wyr-6',
    category: 'Personal',
    optionA: 'Pursue a high-risk dream career with unpredictable income',
    optionB: 'Stay in a safe, predictable job with maximum guaranteed free time for each other'
  },
  {
    id: 'wyr-7',
    category: 'Difficult',
    optionA: 'Live without internet and smartphones for an entire month together',
    optionB: 'Live without speaking out loud (only written notes) for two weeks'
  },
  {
    id: 'wyr-8',
    category: 'Difficult',
    optionA: 'Give up your favourite food for the rest of your life',
    optionB: 'Give up sleeping in late on weekends for the rest of your life'
  }
];
