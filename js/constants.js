export const MAX_GUESSES = 6;

export const FEEDBACK = {
  CORRECT: 'correct',
  WRONG: 'wrong',
  HIGHER: 'higher',
  LOWER: 'lower',
  PARTIAL: 'partial',
};

export const ATTRIBUTES = [
  { key: 'make', label: 'Make' },
  { key: 'country', label: 'Country' },
  { key: 'drivetrain', label: 'Drive' },
  { key: 'bodyStyle', label: 'Body' },
  { key: 'horsepower', label: 'HP' },
  { key: 'year', label: 'Year' },
  { key: 'engine', label: 'Engine' },
];

export const YEAR_CLOSE_THRESHOLD = 2;
export const HORSEPOWER_CLOSE_THRESHOLD = 20;

export const GAME_STATUS = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
};
