/** Supabase auth: Google + email/password, UI, and local→cloud migration. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './supabase-config.js';
import { getUtcDateKey } from './daily.js';

let supabase = null;
let currentUser = null;
let authReady = false;
let sessionChangeHandler = null;
let migratedForUserId = null;

export function getSupabase() {
  return supabase;
}

export function getCurrentUser() {
  return currentUser;
}

export function isAuthReady() {
  return authReady;
}

function ensureClient() {
  if (!isSupabaseConfigured()) return null;
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

export async function signInWithGoogle() {
  const client = ensureClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.href,
    },
  });
  if (error) throw error;
}

export async function signInWithEmail(email, password) {
  const client = ensureClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
}

export async function signUpWithEmail(email, password) {
  const client = ensureClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: window.location.href,
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = ensureClient();
  if (!client) return;
  const { error } = await client.auth.signOut();
  if (error) throw error;
}

async function migrateLocalToCloud(userId) {
  if (!userId || migratedForUserId === userId) return;
  migratedForUserId = userId;

  try {
    const { syncLocalDailyToCloud } = await import('./persistence.js');
    const { syncLocalStatsToCloud } = await import('./stats.js');
    await Promise.all([
      syncLocalDailyToCloud(userId, getUtcDateKey()),
      syncLocalStatsToCloud(userId),
    ]);
  } catch (err) {
    console.error('Failed to migrate local progress to cloud:', err);
  }
}

function setAuthStatus(message, isError = false) {
  const el = document.getElementById('auth-status');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('auth-status--error', Boolean(isError && message));
  el.classList.toggle('hidden', !message);
}

function openAuthModal({ preserveStatus = false } = {}) {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.add('auth-modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('auth-modal-open');
  if (!preserveStatus) setAuthStatus('');
  document.getElementById('auth-email')?.focus();
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('auth-modal-open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('auth-modal-open');
  setAuthStatus('');
}

function closeAuthMenu() {
  document.getElementById('authMenu')?.classList.add('hidden');
  document.getElementById('authToggle')?.setAttribute('aria-expanded', 'false');
}

function updateAuthUI(user) {
  const toggle = document.getElementById('authToggle');
  const label = document.getElementById('authToggleLabel');
  const avatar = document.getElementById('authAvatar');
  const menu = document.getElementById('authMenu');
  const menuEmail = document.getElementById('authMenuEmail');
  if (!toggle) return;

  if (user) {
    const email = user.email || 'Signed in';
    const initial = (user.user_metadata?.full_name || email).charAt(0).toUpperCase();
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

    toggle.classList.add('auth-btn--signed-in');
    toggle.setAttribute('aria-label', 'Account menu');
    if (label) {
      label.textContent = email.split('@')[0];
      label.classList.remove('hidden');
    }
    if (avatar) {
      if (avatarUrl) {
        avatar.innerHTML = '';
        const img = document.createElement('img');
        img.src = avatarUrl;
        img.alt = '';
        img.className = 'auth-avatar-img';
        avatar.appendChild(img);
      } else {
        avatar.textContent = initial;
      }
      avatar.classList.remove('hidden');
    }
    if (menuEmail) menuEmail.textContent = email;
    closeAuthModal();
  } else {
    toggle.classList.remove('auth-btn--signed-in');
    toggle.setAttribute('aria-label', 'Sign in');
    toggle.setAttribute('aria-expanded', 'false');
    if (label) {
      label.textContent = 'Sign In';
      label.classList.remove('hidden');
    }
    if (avatar) {
      avatar.textContent = '';
      avatar.classList.add('hidden');
    }
    menu?.classList.add('hidden');
    if (menuEmail) menuEmail.textContent = '';
  }
}

function setupAuthUI() {
  const toggle = document.getElementById('authToggle');
  const modal = document.getElementById('authModal');
  if (!toggle || !modal) return;

  const closeBtn = document.getElementById('authClose');
  const backdrop = document.getElementById('authBackdrop');
  const googleBtn = document.getElementById('authGoogleBtn');
  const emailForm = document.getElementById('authEmailForm');
  const signUpBtn = document.getElementById('authSignUpBtn');
  const signOutBtn = document.getElementById('authSignOutBtn');
  const menu = document.getElementById('authMenu');

  toggle.addEventListener('click', (event) => {
    event.stopPropagation();
    if (currentUser) {
      const open = menu?.classList.toggle('hidden') === false;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      return;
    }
    if (!isSupabaseConfigured()) {
      openAuthModal({ preserveStatus: true });
      setAuthStatus('Add your Supabase URL and anon key in js/supabase-config.js', true);
      return;
    }
    openAuthModal();
  });

  closeBtn?.addEventListener('click', closeAuthModal);
  backdrop?.addEventListener('click', closeAuthModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAuthModal();
      closeAuthMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (!menu || menu.classList.contains('hidden')) return;
    if (toggle.contains(event.target) || menu.contains(event.target)) return;
    closeAuthMenu();
  });

  googleBtn?.addEventListener('click', async () => {
    setAuthStatus('Redirecting to Google…');
    googleBtn.disabled = true;
    try {
      await signInWithGoogle();
    } catch (err) {
      console.error(err);
      setAuthStatus(err?.message || 'Google sign-in failed.', true);
      googleBtn.disabled = false;
    }
  });

  emailForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value || '';
    if (!email || !password) {
      setAuthStatus('Email and password are required.', true);
      return;
    }

    const submitBtn = emailForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setAuthStatus('Signing in…');

    try {
      await signInWithEmail(email, password);
      setAuthStatus('Signed in!');
    } catch (err) {
      console.error(err);
      setAuthStatus(err?.message || 'Sign-in failed.', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  signUpBtn?.addEventListener('click', async () => {
    const email = document.getElementById('auth-email')?.value?.trim();
    const password = document.getElementById('auth-password')?.value || '';
    if (!email || !password) {
      setAuthStatus('Email and password are required.', true);
      return;
    }
    if (password.length < 6) {
      setAuthStatus('Password must be at least 6 characters.', true);
      return;
    }

    signUpBtn.disabled = true;
    setAuthStatus('Creating account…');

    try {
      await signUpWithEmail(email, password);
      setAuthStatus('Check your email to confirm, or sign in if confirmation is disabled.');
    } catch (err) {
      console.error(err);
      setAuthStatus(err?.message || 'Sign-up failed.', true);
    } finally {
      signUpBtn.disabled = false;
    }
  });

  signOutBtn?.addEventListener('click', async () => {
    closeAuthMenu();
    try {
      await signOut();
    } catch (err) {
      console.error(err);
    }
  });
}

/**
 * Initializes the Supabase client, wires the auth UI, and notifies the app
 * whenever the session changes (after local→cloud migration on sign-in).
 */
export async function initAuth({ onSessionChange } = {}) {
  sessionChangeHandler = onSessionChange || null;
  setupAuthUI();

  const client = ensureClient();
  if (!client) {
    authReady = true;
    updateAuthUI(null);
    return;
  }

  const {
    data: { session },
  } = await client.auth.getSession();

  currentUser = session?.user ?? null;
  updateAuthUI(currentUser);

  if (currentUser) {
    await migrateLocalToCloud(currentUser.id);
  }

  authReady = true;
  await sessionChangeHandler?.(currentUser ? session : null);

  client.auth.onAuthStateChange(async (event, nextSession) => {
    currentUser = nextSession?.user ?? null;
    updateAuthUI(currentUser);

    if (event === 'SIGNED_OUT') {
      migratedForUserId = null;
      const { clearLocalStats } = await import('./stats.js');
      const { clearDailyProgress, clearUnlimitedProgress } = await import('./persistence.js');
      clearLocalStats();
      clearDailyProgress();
      clearUnlimitedProgress();
      await sessionChangeHandler?.(null);
      return;
    }

    if (event === 'SIGNED_IN' && currentUser) {
      await migrateLocalToCloud(currentUser.id);
      await sessionChangeHandler?.(nextSession);
    }
  });
}
