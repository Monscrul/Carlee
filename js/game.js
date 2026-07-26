import { MAX_GUESSES, GAME_STATUS } from './constants.js';
import { compareCars } from './compare.js';

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

  const comparison = compareCars(guessCar, secretCar);
  const guesses = [...state.guesses, comparison];
  const isWin = carId === state.secretCarId;
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
