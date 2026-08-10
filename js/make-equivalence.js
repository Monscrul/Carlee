const HONDA_ACURA = new Set(['Honda', 'Acura']);

export function isHondaAcuraFamily(make) {
  return HONDA_ACURA.has(make);
}

export function makesMatchForCompare(guessMake, secretMake) {
  if (guessMake === secretMake) return true;
  return isHondaAcuraFamily(guessMake) && isHondaAcuraFamily(secretMake);
}

export function isWinningGuess(guessCar, secretCar) {
  if (guessCar.id === secretCar.id) return true;
  if (!makesMatchForCompare(guessCar.make, secretCar.make)) return false;
  return guessCar.model === secretCar.model && guessCar.year === secretCar.year;
}

export function isEquivalentCar(a, b) {
  return isWinningGuess(a, b);
}
