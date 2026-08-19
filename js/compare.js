import { FEEDBACK, ATTRIBUTES } from './constants.js';
import { makesMatchForCompare } from './make-equivalence.js';

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

/** Null vs null = correct; one null = wrong; otherwise enum or number compare. */
function compareNullable(guessValue, secretValue, type) {
  const guessMissing = guessValue === null || guessValue === undefined;
  const secretMissing = secretValue === null || secretValue === undefined;

  if (guessMissing && secretMissing) {
    return { status: FEEDBACK.CORRECT };
  }

  if (guessMissing || secretMissing) {
    return { status: FEEDBACK.WRONG };
  }

  if (type === 'number') {
    return compareNumber(guessValue, secretValue);
  }

  return compareEnum(guessValue, secretValue);
}

const COMPARATORS = {
  make: (guess, secret) =>
    makesMatchForCompare(guess.make, secret.make)
      ? { status: FEEDBACK.CORRECT }
      : { status: FEEDBACK.WRONG },
  country: (guess, secret) => compareEnum(guess.country, secret.country),
  drivetrain: (guess, secret) => compareEnum(guess.drivetrain, secret.drivetrain),
  bodyStyle: (guess, secret) => compareEnum(guess.bodyStyle, secret.bodyStyle),
  engine: (guess, secret) => compareEnum(guess.engine, secret.engine),
  year: (guess, secret) => compareNumber(guess.year, secret.year),
  horsepower: (guess, secret) => compareNumber(guess.horsepower, secret.horsepower),
  powertrain: (guess, secret) =>
    compareNullable(guess.powertrain, secret.powertrain, 'enum'),
  configuration: (guess, secret) =>
    compareNullable(guess.configuration, secret.configuration, 'enum'),
  cylinders: (guess, secret) =>
    compareNullable(guess.cylinders, secret.cylinders, 'number'),
  aspiration: (guess, secret) =>
    compareNullable(guess.aspiration, secret.aspiration, 'enum'),
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
