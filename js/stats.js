/** Daily streak tracking — device-local, with Supabase sync when signed in. */
import { getPreviousDateKey, getUtcDateKey } from './daily.js';
import { getCurrentUser, getSupabase } from './auth.js';

const STATS_KEY = 'carlee-stats-v1';

const EMPTY_STATS = {
  gamesPlayed: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0,
  lastCompletedDate: null,
  lastResult: null,
};

/** In-memory cloud mirror used while signed in so the UI stays sync-friendly. */
let cloudStatsCache = null;

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

function toCloudRow(userId, stats) {
  return {
    user_id: userId,
    games_played: stats.gamesPlayed,
    wins: stats.wins,
    current_streak: stats.currentStreak,
    max_streak: stats.maxStreak,
    last_completed_date: stats.lastCompletedDate,
    last_result: stats.lastResult,
    updated_at: new Date().toISOString(),
  };
}

function fromCloudRow(row) {
  if (!row) return null;
  return {
    gamesPlayed: Number(row.games_played) || 0,
    wins: Number(row.wins) || 0,
    currentStreak: Number(row.current_streak) || 0,
    maxStreak: Number(row.max_streak) || 0,
    lastCompletedDate: row.last_completed_date ?? null,
    lastResult: row.last_result ?? null,
  };
}

function statsRank(stats) {
  if (!stats) return -1;
  const dateScore = stats.lastCompletedDate
    ? Number(String(stats.lastCompletedDate).replace(/-/g, '')) || 0
    : 0;
  return stats.gamesPlayed * 1_000_000 + dateScore;
}

async function upsertStatsCloud(userId, stats) {
  const client = getSupabase();
  if (!client || !userId || !stats) return;

  try {
    const { error } = await client.from('user_stats').upsert(toCloudRow(userId, stats), {
      onConflict: 'user_id',
    });
    if (error) console.error('Failed to sync stats:', error);
  } catch (err) {
    console.error('Failed to sync stats:', err);
  }
}

function queueCloudStatsSave(stats) {
  const user = getCurrentUser();
  if (!user) return;
  cloudStatsCache = { ...stats };
  // Always keep the in-memory cache current; cloud upsert can wait until enabled.
  void upsertStatsCloud(user.id, stats);
}

export function clearCloudStatsCache() {
  cloudStatsCache = null;
}

/** Wipes device-local stats so a shared browser does not keep the last account. */
export function clearLocalStats() {
  cloudStatsCache = null;
  try {
    window.localStorage.removeItem(STATS_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function setCloudStatsCache(stats) {
  cloudStatsCache = stats ? { ...EMPTY_STATS, ...stats } : null;
}

export function hasRecordedDaily(dateKey) {
  const stats = cloudStatsCache ?? readStats();
  return stats.lastCompletedDate === dateKey;
}

export function recordDailyResult(won, dateKey) {
  const stats = { ...(cloudStatsCache ?? readStats()) };

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
  queueCloudStatsSave(stats);
  return stats;
}

/**
 * A streak only survives while today's or yesterday's puzzle is the last one
 * finished, so skipped days read as 0 without rewriting stored history.
 */
export function getStatsSummary(today = getUtcDateKey()) {
  const stats = cloudStatsCache ?? readStats();
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

/** Pulls cloud stats into the local cache (and localStorage) when signed in. */
export async function loadStatsFromCloud() {
  const user = getCurrentUser();
  const client = getSupabase();
  if (!user || !client) {
    clearCloudStatsCache();
    return readStats();
  }

  try {
    const { data, error } = await client
      .from('user_stats')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load cloud stats:', error);
      return cloudStatsCache ?? readStats();
    }

    const cloud = fromCloudRow(data);
    const local = readStats();

    if (!cloud) {
      cloudStatsCache = { ...local };
      return local;
    }

    const chosen = statsRank(cloud) >= statsRank(local) ? cloud : local;
    writeStats(chosen);
    cloudStatsCache = { ...chosen };

    if (chosen === local && statsRank(local) > statsRank(cloud)) {
      await upsertStatsCloud(user.id, local);
    }

    return chosen;
  } catch (err) {
    console.error('Failed to load cloud stats:', err);
    return cloudStatsCache ?? readStats();
  }
}

/**
 * Uploads local stats if the cloud has nothing better.
 * Used once on sign-in to transfer device progress to the account.
 */
export async function syncLocalStatsToCloud(userId) {
  const local = readStats();
  if (!userId) return;

  const client = getSupabase();
  if (!client) return;

  // Nothing meaningful to migrate yet.
  if (!local.gamesPlayed && !local.lastCompletedDate) return;

  try {
    const { data, error } = await client
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Failed to check cloud stats:', error);
      return;
    }

    const cloud = fromCloudRow(data);
    if (statsRank(local) >= statsRank(cloud)) {
      await upsertStatsCloud(userId, local);
      cloudStatsCache = { ...local };
    } else if (cloud) {
      writeStats(cloud);
      cloudStatsCache = { ...cloud };
    }
  } catch (err) {
    console.error('Failed to migrate stats:', err);
  }
}
