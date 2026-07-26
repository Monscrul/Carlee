const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 8;

function matchesCar(car, query) {
  const q = query.toLowerCase();
  return (
    car.make.toLowerCase().includes(q) ||
    car.model.toLowerCase().includes(q) ||
    car.displayName.toLowerCase().includes(q)
  );
}

function relevanceScore(car, query) {
  const q = query.toLowerCase();
  const fields = [car.make, car.model, car.displayName].map((f) => f.toLowerCase());

  let score = 0;

  for (const field of fields) {
    if (field === q) score += 100;
    else if (field.startsWith(q)) score += 50;
    else if (field.includes(q)) score += 10;
  }

  score -= car.displayName.length * 0.1;
  return score;
}

export function searchCars(catalog, query, excludeIds = []) {
  const q = query.trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return [];
  }

  const excludeSet = new Set(excludeIds);

  return catalog
    .filter((car) => !excludeSet.has(car.id))
    .filter((car) => matchesCar(car, q))
    .sort((a, b) => relevanceScore(b, q) - relevanceScore(a, q))
    .slice(0, MAX_RESULTS);
}

export { MIN_QUERY_LENGTH, MAX_RESULTS };
