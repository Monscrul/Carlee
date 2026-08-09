import { FEEDBACK, ATTRIBUTES } from './constants.js';

function compareEnum(guessValue, secretValue) {
  return guessValue === secretValue
    ? { status: FEEDBACK.CORRECT }
    : { status: FEEDBACK.WRONG };
}

function compareNumber(guessValue, secretValue) {
  if (guessValue === secretValue) {
    return { status: FEEDBACK.CORRECT };
  }

  if (secretValue > guessValue) {
    return { status: FEEDBACK.HIGHER, delta: secretValue - guessValue };
  }

  return { status: FEEDBACK.LOWER, delta: guessValue - secretValue };
}

const COMPARATORS = {
  make: (guess, secret) => compareEnum(guess.make, secret.make),
  country: (guess, secret) => compareEnum(guess.country, secret.country),
  drivetrain: (guess, secret) => compareEnum(guess.drivetrain, secret.drivetrain),
  bodyStyle: (guess, secret) => compareEnum(guess.bodyStyle, secret.bodyStyle),
  engine: (guess, secret) => compareEnum(guess.engine, secret.engine),
  year: (guess, secret) => compareNumber(guess.year, secret.year),
  horsepower: (guess, secret) => compareNumber(guess.horsepower, secret.horsepower),
};

export function compareCars(guessCar, secretCar) {
  const attributes = {};

  for (const { key } of ATTRIBUTES) {
    attributes[key] = COMPARATORS[key](guessCar, secretCar);
  }

  return {
    carId: guessCar.id,
    displayName: guessCar.displayName,
    attributes,
  };
}
