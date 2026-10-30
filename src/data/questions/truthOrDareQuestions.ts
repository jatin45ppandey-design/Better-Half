export interface TruthOrDareItem {
  id: string;
  type: 'truth' | 'dare';
  category: 'Romantic' | 'Funny' | 'Personal' | 'Challenging';
  intensity: 'Soft' | 'Spicy' | 'Wild';
  text: string;
}

export const TRUTH_OR_DARE_ITEMS: TruthOrDareItem[] = [
  // TRUTHS
  {
    id: 't-1',
    type: 'truth',
    category: 'Romantic',
    intensity: 'Soft',
    text: 'What was your honest first impression of me the day we met?'
  },
  {
    id: 't-2',
    type: 'truth',
    category: 'Romantic',
    intensity: 'Spicy',
    text: 'What outfit or hairstyle of mine makes you look twice every single time?'
  },
  {
    id: 't-3',
    type: 'truth',
    category: 'Funny',
    intensity: 'Soft',
    text: 'What is the most embarrassing thing you have ever done to impress me?'
  },
  {
    id: 't-4',
    type: 'truth',
    category: 'Funny',
    intensity: 'Spicy',
    text: 'What is an odd habit you have when you think nobody is watching?'
  },
  {
    id: 't-5',
    type: 'truth',
    category: 'Personal',
    intensity: 'Soft',
    text: 'What is a personal dream you have put on hold that you still want to accomplish?'
  },
  {
    id: 't-6',
    type: 'truth',
    category: 'Personal',
    intensity: 'Spicy',
    text: 'Have you ever stalked an old flame or acquaintance on social media recently?'
  },
  {
    id: 't-7',
    type: 'truth',
    category: 'Challenging',
    intensity: 'Spicy',
    text: 'What is a critique of your behavior that you know is true, but hate hearing?'
  },
  {
    id: 't-8',
    type: 'truth',
    category: 'Challenging',
    intensity: 'Wild',
    text: 'What is a secret guilty pleasure or craving you have never confessed to anyone?'
  },

  // DARES
  {
    id: 'd-1',
    type: 'dare',
    category: 'Romantic',
    intensity: 'Soft',
    text: 'Look into my eyes without laughing or blinking for 45 full seconds.'
  },
  {
    id: 'd-2',
    type: 'dare',
    category: 'Romantic',
    intensity: 'Spicy',
    text: 'Whisper three genuine compliments directly into my ear.'
  },
  {
    id: 'd-3',
    type: 'dare',
    category: 'Funny',
    intensity: 'Soft',
    text: 'Do your best, most dramatic impersonation of me ordering food at a restaurant.'
  },
  {
    id: 'd-4',
    type: 'dare',
    category: 'Funny',
    intensity: 'Spicy',
    text: 'Speak in a dramatic Shakespearean accent for the next two rounds.'
  },
  {
    id: 'd-5',
    type: 'dare',
    category: 'Personal',
    intensity: 'Soft',
    text: 'Show the partner the last 3 photos in your phone camera roll with zero explanation.'
  },
  {
    id: 'd-6',
    type: 'dare',
    category: 'Personal',
    intensity: 'Spicy',
    text: 'Let your partner style your hair however they want for the remainder of the game.'
  },
  {
    id: 'd-7',
    type: 'dare',
    category: 'Challenging',
    intensity: 'Spicy',
    text: 'Give your partner a relaxing 60-second neck and shoulder massage right now.'
  },
  {
    id: 'd-8',
    type: 'dare',
    category: 'Challenging',
    intensity: 'Wild',
    text: 'Slow dance with your partner to an imaginary love song for one minute.'
  }
];
