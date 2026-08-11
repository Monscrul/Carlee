/** localStorage helpers for in-progress games so a refresh never loses guesses. */
import { GAME_STATUS } from './constants.js';

const DAILY_KEY = 'carlee-daily-v1';
const UNLIMITED_KEY = 'carlee-unlimited-v1';

const STORAGE_KEYS = {
  daily: DAILY_KEY,
  unlimited: UNLIMITED_KEY,
};

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

export function clearUnlimitedProgress() {
  removeKey(UNLIMITED_KEY);
}
