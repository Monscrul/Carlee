/** localStorage helpers for in-progress games so a refresh never loses guesses.
 *  When signed in, daily progress is also synced to Supabase.
 */
import { GAME_STATUS } from './constants.js';
import { getCurrentUser, getSupabase } from './auth.js';

const DAILY_KEY = 'carlee-daily-v1';
const UNLIMITED_KEY = 'carlee-unlimited-v1';

const STORAGE_KEYS = {
  daily: DAILY_KEY,
  unlimited: UNLIMITED_KEY,
};

/** Prevents bootstrap from overwriting cloud progress before the first pull. */
let cloudSyncEnabled = false;

export function enableCloudSync() {
  cloudSyncEnabled = true;
}

function readJson(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private browsing or a full quota should never break gameplay.
  }
}

function removeKey(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures.
  }
}

function isValidSave(save) {
  return Boolean(
    save &&
      typeof save.secretCarId === 'string' &&
      Array.isArray(save.guesses) &&
      typeof save.status === 'string',
  );
}

function toCloudRow(userId, payload) {
  return {
    user_id: userId,
    date_key: payload.dateKey,
    secret_car_id: payload.secretCarId,
    guesses: payload.guesses,
    status: payload.status,
    max_guesses: payload.maxGuesses,
  };
}

function fromCloudRow(row) {
  if (!row) return null;
  return {
    dateKey: row.date_key,
    secretCarId: row.secret_car_id,
    guesses: row.guesses,
    status: row.status,
    maxGuesses: row.max_guesses,
  };
}

function saveRank(save) {
  if (!save) return -1;
  if (save.status === GAME_STATUS.WON || save.status === GAME_STATUS.LOST) {
    return 1000 + (Array.isArray(save.guesses) ? save.guesses.length : 0);
  }
  return Array.isArray(save.guesses) ? save.guesses.length : 0;
}

async function upsertDailyCloud(userId, payload) {
  const client = getSupabase();
  if (!client || !userId || !payload?.dateKey) return;

  try {
    const { error } = await client.from('daily_progress').upsert(toCloudRow(userId, payload), {
      onConflict: 'user_id,date_key',
    });
    if (error) console.error('Failed to sync daily progress:', error);
  } catch (err) {
    console.error('Failed to sync daily progress:', err);
  }
}

function queueCloudDailySave(payload) {
  if (!cloudSyncEnabled) return;
  const user = getCurrentUser();
  if (!user || !payload?.dateKey) return;
  void upsertDailyCloud(user.id, payload);
}

export function saveProgress(mode, state, dateKey) {
  const key = STORAGE_KEYS[mode];
  if (!key || !state) return;

  const payload = {
    secretCarId: state.secretCarId,
    guesses: state.guesses,
    status: state.status,
    maxGuesses: state.maxGuesses,
  };

  if (mode === 'daily') payload.dateKey = dateKey;

  writeJson(key, payload);

  if (mode === 'daily') queueCloudDailySave(payload);
}

/** Returns today's daily save, or null when absent, malformed, or stale. */
export function loadDailyProgress(dateKey) {
  const save = readJson(DAILY_KEY);
  if (!isValidSave(save)) return null;
  if (save.dateKey !== dateKey) {
    removeKey(DAILY_KEY);
    return null;
  }
  return save;
}

/**
 * Prefers cloud daily progress when signed in, otherwise localStorage.
 * Also writes the chosen save back to localStorage so offline play stays consistent.
 */
export async function loadDailyProgressAsync(dateKey) {
  const local = loadDailyProgress(dateKey);
  const user = getCurrentUser();
  const client = getSupabase();

  if (!user || !client) return local;

  try {
    const { data, error } = await client
      .from('daily_progress')
      .select('*')
      .eq('user_id', user.id)
      .eq('date_key', dateKey)
      .maybeSingle();

    if (error) {
      console.error('Failed to load cloud daily progress:', error);
      return local;
    }

    const cloud = fromCloudRow(data);
    if (!isValidSave(cloud)) return local;

    const chosen = saveRank(cloud) >= saveRank(local) ? cloud : local;
    writeJson(DAILY_KEY, { ...chosen, dateKey });
    if (chosen === local && local) {
      await upsertDailyCloud(user.id, { ...local, dateKey });
    }
    return { ...chosen, dateKey };
  } catch (err) {
    console.error('Failed to load cloud daily progress:', err);
    return local;
  }
}

/**
 * Uploads today's local daily save if the cloud has nothing better.
 * Used once on sign-in to transfer device progress to the account.
 */
export async function syncLocalDailyToCloud(userId, dateKey) {
  const local = loadDailyProgress(dateKey);
  if (!local || !userId) return;

  const client = getSupabase();
  if (!client) return;

  try {
    const { data, error } = await client
      .from('daily_progress')
      .select('*')
      .eq('user_id', userId)
      .eq('date_key', dateKey)
      .maybeSingle();

    if (error) {
      console.error('Failed to check cloud daily progress:', error);
      return;
    }

    const cloud = fromCloudRow(data);
    if (saveRank(local) >= saveRank(cloud)) {
      await upsertDailyCloud(userId, { ...local, dateKey });
    }
  } catch (err) {
    console.error('Failed to migrate daily progress:', err);
  }
}

/** Only unfinished unlimited runs are worth restoring after a refresh. */
export function loadUnlimitedProgress() {
  const save = readJson(UNLIMITED_KEY);
  if (!isValidSave(save)) return null;
  if (save.status !== GAME_STATUS.PLAYING) {
    removeKey(UNLIMITED_KEY);
    return null;
  }
  return save;
}

export function clearDailyProgress() {
  removeKey(DAILY_KEY);
}

export function clearUnlimitedProgress() {
  removeKey(UNLIMITED_KEY);
}
