import { MAX_GUESSES, GAME_STATUS } from './constants.js';
import { compareCars } from './compare.js';
import { isEquivalentCar, isWinningGuess } from './make-equivalence.js';
import { pickDailyCarId } from './daily.js';

export function initGame(catalog, maxGuesses = MAX_GUESSES) {
  if (!catalog.length) {
    throw new Error('Cannot start game with empty catalog');
  }

  const secretIndex = Math.floor(Math.random() * catalog.length);

  return {
    status: GAME_STATUS.PLAYING,
    secretCarId: catalog[secretIndex].id,
    guesses: [],
    maxGuesses,
  };
}

export function initDailyGame(catalog, dateKey, maxGuesses = MAX_GUESSES) {
  if (!catalog.length) {
    throw new Error('Cannot start game with empty catalog');
  }

  return {
    status: GAME_STATUS.PLAYING,
    secretCarId: pickDailyCarId(catalog, dateKey),
    guesses: [],
    maxGuesses,
  };
}

/** Rebuilds state from a saved game; returns null if the save no longer fits the catalog. */
export function restoreGame(save, catalog, maxGuesses = MAX_GUESSES) {
  if (!save || !catalog.some((car) => car.id === save.secretCarId)) return null;

  const guesses = save.guesses.filter((guess) =>
    catalog.some((car) => car.id === guess.carId),
  );

  return {
    status: save.status ?? GAME_STATUS.PLAYING,
    secretCarId: save.secretCarId,
    guesses,
    maxGuesses: save.maxGuesses ?? maxGuesses,
  };
}

export function getGuessedCarIds(state) {
  return state.guesses.map((guess) => guess.carId);
}

export function getSecretCar(state, catalog) {
  return catalog.find((car) => car.id === state.secretCarId) ?? null;
}

export function submitGuess(state, carId, catalog) {
  if (state.status !== GAME_STATUS.PLAYING) {
    return { state, error: 'Game is already over.' };
  }

  if (getGuessedCarIds(state).includes(carId)) {
    return { state, error: 'You already guessed that car.' };
  }

  const guessCar = catalog.find((car) => car.id === carId);
  const secretCar = getSecretCar(state, catalog);

  if (!guessCar || !secretCar) {
    return { state, error: 'Invalid car selection.' };
  }

  const alreadyGuessedEquivalent = state.guesses.some((guess) => {
    const priorCar = catalog.find((car) => car.id === guess.carId);
    return priorCar && isEquivalentCar(guessCar, priorCar);
  });

  if (alreadyGuessedEquivalent) {
    return { state, error: 'You already guessed that car.' };
  }

  const comparison = compareCars(guessCar, secretCar);
  const guesses = [...state.guesses, comparison];
  const isWin = isWinningGuess(guessCar, secretCar);
  const isLoss = !isWin && guesses.length >= state.maxGuesses;

  let status = state.status;
  if (isWin) {
    status = GAME_STATUS.WON;
  } else if (isLoss) {
    status = GAME_STATUS.LOST;
  }

  return {
    state: {
      ...state,
      status,
      guesses,
    },
    error: null,
  };
}
