/** Device-local daily streak tracking. No account, no server. */
import { getPreviousDateKey, getUtcDateKey } from './daily.js';

const STATS_KEY = 'carlee-stats-v1';

const EMPTY_STATS = {
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastCompletedDate: null,
  lastResult: null,
};

function readStats() {
  try {
    const raw = window.localStorage.getItem(STATS_KEY);
    if (!raw) return { ...EMPTY_STATS };

    const parsed = JSON.parse(raw);
    return {
      ...EMPTY_STATS,
      ...parsed,
      gamesPlayed: Number(parsed.gamesPlayed) || 0,
      wins: Number(parsed.wins) || 0,
      currentStreak: Number(parsed.currentStreak) || 0,
      maxStreak: Number(parsed.maxStreak) || 0,
    };
  } catch {
    return { ...EMPTY_STATS };
  }
}

function writeStats(stats) {
  try {
    window.localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch {
    // Storage failures must not interrupt play.
  }
}

export function hasRecordedDaily(dateKey) {
  return readStats().lastCompletedDate === dateKey;
}

export function recordDailyResult(won, dateKey) {
  const stats = readStats();

  if (stats.lastCompletedDate === dateKey) return stats;

  stats.gamesPlayed += 1;

  if (won) {
    const continuesStreak = stats.lastCompletedDate === getPreviousDateKey(dateKey);
    stats.wins += 1;
    stats.currentStreak = continuesStreak ? stats.currentStreak + 1 : 1;
    stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
  } else {
    stats.currentStreak = 0;
  }

  stats.lastCompletedDate = dateKey;
  stats.lastResult = won ? 'won' : 'lost';

  writeStats(stats);
  return stats;
}

/**
 * A streak only survives while today's or yesterday's puzzle is the last one
 * finished, so skipped days read as 0 without rewriting stored history.
 */
export function getStatsSummary(today = getUtcDateKey()) {
  const stats = readStats();
  const yesterday = getPreviousDateKey(today);
  const streakIsLive =
    stats.lastCompletedDate === today || stats.lastCompletedDate === yesterday;

  return {
    gamesPlayed: stats.gamesPlayed,
    wins: stats.wins,
    winRate: stats.gamesPlayed
      ? Math.round((stats.wins / stats.gamesPlayed) * 100)
      : 0,
    currentStreak: streakIsLive ? stats.currentStreak : 0,
    maxStreak: stats.maxStreak,
  };
}
