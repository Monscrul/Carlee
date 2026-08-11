/** Ad-hoc verification of the daily puzzle, persistence, and streak rules. */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const store = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  },
};

const { getUtcDateKey, getPreviousDateKey, pickDailyCarId } = await import('../js/daily.js');
const { initDailyGame, initGame, restoreGame, submitGuess } = await import('../js/game.js');
const { saveProgress, loadDailyProgress, loadUnlimitedProgress, clearUnlimitedProgress } =
  await import('../js/persistence.js');
const { recordDailyResult, getStatsSummary } = await import('../js/stats.js');

const catalog = JSON.parse(await readFile(new URL('../data/cars.json', import.meta.url), 'utf8'));
const today = getUtcDateKey();

// Daily pick is deterministic and independent of catalog file order.
const shuffled = [...catalog].sort(() => Math.random() - 0.5);
assert.equal(pickDailyCarId(catalog, today), pickDailyCarId(shuffled, today));
assert.notEqual(pickDailyCarId(catalog, '2026-01-01'), pickDailyCarId(catalog, '2026-06-14'));

// Mid-game daily save round-trips through a "refresh".
let daily = initDailyGame(catalog, today);
const wrongGuess = catalog.find((c) => c.id !== daily.secretCarId);
daily = submitGuess(daily, wrongGuess.id, catalog).state;
saveProgress('daily', daily, today);

const restoredDaily = restoreGame(loadDailyProgress(today), catalog);
assert.equal(restoredDaily.secretCarId, daily.secretCarId);
assert.equal(restoredDaily.guesses.length, 1);
assert.equal(restoredDaily.status, 'playing');

// A stale daily save is discarded when the UTC date rolls over.
assert.equal(loadDailyProgress('2026-01-01'), null);
assert.equal(loadDailyProgress(today), null, 'stale save should be evicted');

// Unlimited restores while playing, but a finished run starts fresh.
let unlimited = initGame(catalog);
unlimited = submitGuess(unlimited, catalog.find((c) => c.id !== unlimited.secretCarId).id, catalog).state;
saveProgress('unlimited', unlimited, today);
assert.equal(restoreGame(loadUnlimitedProgress(), catalog).guesses.length, 1);
saveProgress('unlimited', { ...unlimited, status: 'won' }, today);
assert.equal(loadUnlimitedProgress(), null);
clearUnlimitedProgress();

// Streaks: consecutive wins build, a gap resets, a loss zeroes.
store.clear();
recordDailyResult(true, '2026-03-01');
recordDailyResult(true, '2026-03-02');
recordDailyResult(true, '2026-03-02'); // idempotent re-finish
assert.deepEqual(getStatsSummary('2026-03-02'), {
  gamesPlayed: 2,
  wins: 2,
  winRate: 100,
  currentStreak: 2,
  maxStreak: 2,
});

recordDailyResult(true, '2026-03-05');
assert.equal(getStatsSummary('2026-03-05').currentStreak, 1, 'gap should restart the streak');
assert.equal(getStatsSummary('2026-03-05').maxStreak, 2);

recordDailyResult(false, '2026-03-06');
assert.equal(getStatsSummary('2026-03-06').currentStreak, 0);
assert.equal(getStatsSummary('2026-03-06').winRate, 75);

// A skipped day reads as no live streak without rewriting history.
store.clear();
recordDailyResult(true, getPreviousDateKey(getPreviousDateKey(today)));
assert.equal(getStatsSummary(today).currentStreak, 0);
assert.equal(getStatsSummary(today).maxStreak, 1);

console.log('All daily/persistence/stats checks passed.');
