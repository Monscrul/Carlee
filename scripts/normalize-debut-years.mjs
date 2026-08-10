/**
 * Apply generation debut years from data/debut-years.json to data/cars.json.
 * Usage: npm run normalize-debut-years
 */
import fs from 'node:fs';

const cars = JSON.parse(fs.readFileSync('data/cars.json', 'utf8'));
const debutYears = JSON.parse(fs.readFileSync('data/debut-years.json', 'utf8'));

const missing = [];
for (const car of cars) {
  if (debutYears[car.id] === undefined) {
    missing.push(car.id);
  }
}

if (missing.length) {
  console.error('Missing debut year for:', missing.join(', '));
  process.exit(1);
}

const extra = Object.keys(debutYears).filter(
  (id) => !cars.some((car) => car.id === id),
);
if (extra.length) {
  console.warn('Unused debut-year keys:', extra.join(', '));
}

for (const car of cars) {
  car.year = debutYears[car.id];
}

const collisions = new Map();
for (const car of cars) {
  const key = `${car.make}|${car.model}|${car.year}`;
  if (!collisions.has(key)) collisions.set(key, []);
  collisions.get(key).push(car.id);
}

// Same model name across different debut years is fine; only block exact make+model+year triples.
const dupes = [...collisions.entries()].filter(([, ids]) => ids.length > 1);
if (dupes.length) {
  console.error('make+model+year collisions after normalization:');
  for (const [key, ids] of dupes) {
    console.error(`  ${key}: ${ids.join(', ')}`);
  }
  process.exit(1);
}

fs.writeFileSync('data/cars.json', `${JSON.stringify(cars, null, 2)}\n`);
console.log(`Normalized ${cars.length} cars to debut years.`);
