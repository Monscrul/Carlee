/** Deterministic daily puzzle selection based on the UTC calendar date. */

export function getUtcDateKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

/** Human label such as "Mar 10" for the daily mode badge. */
export function formatDateKeyLabel(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function getPreviousDateKey(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  date.setUTCDate(date.getUTCDate() - 1);
  return getUtcDateKey(date);
}

/** FNV-1a keeps the mapping stable across browsers and sessions. */
function hashString(value) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Sorted ids keep past puzzles stable when the catalog file is reordered. */
export function pickDailyCarId(catalog, dateKey) {
  if (!catalog.length) return null;

  const ids = catalog.map((car) => car.id).sort();
  return ids[hashString(dateKey) % ids.length];
}
