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
  { key: 'powertrain', label: 'Powertrain', engineDetail: true },
  { key: 'configuration', label: 'Configuration', engineDetail: true },
  { key: 'cylinders', label: 'Cylinders', engineDetail: true },
  { key: 'aspiration', label: 'Aspiration', engineDetail: true },
];

export const GAME_STATUS = {
  PLAYING: 'playing',
  WON: 'won',
  LOST: 'lost',
};
