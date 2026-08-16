const REQUIRED_FIELDS = [
  'id',
  'make',
  'model',
  'displayName',
  'country',
  'drivetrain',
  'bodyStyle',
  'horsepower',
  'year',
  'engine',
];

function validateCar(car) {
  for (const field of REQUIRED_FIELDS) {
    if (car[field] === undefined || car[field] === null || car[field] === '') {
      throw new Error(`Car missing required field "${field}": ${JSON.stringify(car)}`);
    }
  }

  if (typeof car.horsepower !== 'number' || typeof car.year !== 'number') {
    throw new Error(`Car has invalid numeric fields: ${car.id}`);
  }

  return {
    id: String(car.id),
    make: String(car.make),
    model: String(car.model),
    displayName: String(car.displayName),
    country: String(car.country),
    drivetrain: String(car.drivetrain),
    bodyStyle: String(car.bodyStyle),
    horsepower: car.horsepower,
    year: car.year,
    engine: String(car.engine),
    generation: car.generation ? String(car.generation) : '',
  };
}

export async function loadCatalog() {
  const response = await fetch('data/cars.json');

  if (!response.ok) {
    throw new Error(`Failed to load catalog: ${response.status}`);
  }

  const data = await response.json();

  if (!Array.isArray(data)) {
    throw new Error('Catalog must be an array of cars');
  }

  const cars = data.map(validateCar);
  const ids = new Set();

  for (const car of cars) {
    if (ids.has(car.id)) {
      throw new Error(`Duplicate car id: ${car.id}`);
    }
    ids.add(car.id);
  }

  return cars;
}
