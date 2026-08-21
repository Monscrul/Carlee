/** Supabase auth: Google + email/password, UI, display name, and local→cloud migration. */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { SUPABASE_URL, SUPABASE_ANON_KEY, isSupabaseConfigured } from './supabase-config.js';
import { getUtcDateKey } from './daily.js';

const DISPLAY_NAME_MIN = 2;
const DISPLAY_NAME_MAX = 24;

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
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
      },
    });
  }
  return supabase;
}

/** Stable redirect URL for OAuth (no query/hash) — must match Supabase Auth → URL Configuration. */
function getAuthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

/** Exchange ?code= from Google OAuth redirect and strip auth params from the URL. */
async function completeOAuthCallback(client) {
  const url = new URL(window.location.href);
  const code = url.searchParams.get('code');
  if (!code) return { session: null, error: null };

  const { data, error } = await client.auth.exchangeCodeForSession(code);

  url.searchParams.delete('code');
  url.searchParams.delete('state');
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);

  if (error) {
    console.error('OAuth callback failed:', error);
    return { session: null, error };
  }

  return { session: data.session ?? null, error: null };
}

/** display_name → Google full_name/name → email local-part */
export function getDisplayName(user) {
  if (!user) return '';
  const meta = user.user_metadata || {};
  const custom = typeof meta.display_name === 'string' ? meta.display_name.trim() : '';
  if (custom) return custom;
  const googleName =
    (typeof meta.full_name === 'string' && meta.full_name.trim()) ||
    (typeof meta.name === 'string' && meta.name.trim()) ||
    '';
  if (googleName) return googleName;
  if (user.email) return user.email.split('@')[0];
  return 'Player';
}

export async function updateDisplayName(rawName) {
  const client = ensureClient();
  if (!client) throw new Error('Supabase is not configured.');
  if (!currentUser) throw new Error('You must be signed in to change your name.');

  const name = String(rawName || '').trim();
  if (name.length < DISPLAY_NAME_MIN || name.length > DISPLAY_NAME_MAX) {
    throw new Error(`Name must be ${DISPLAY_NAME_MIN}–${DISPLAY_NAME_MAX} characters.`);
  }

  const { data, error } = await client.auth.updateUser({
    data: { display_name: name },
  });
  if (error) throw error;

  currentUser = data.user ?? currentUser;
  updateAuthUI(currentUser);
  return currentUser;
}

export async function signInWithGoogle() {
  const client = ensureClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: getAuthRedirectUrl(),
    },
  });
  if (error) throw error;
}

export async function signInWithEmail(email, password) {
  const client = ensureClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;

  const session = data.session ?? (await client.auth.getSession()).data.session;
  await finishSignIn(session);
  return data;
}

export async function signUpWithEmail(email, password) {
  const client = ensureClient();
  if (!client) throw new Error('Supabase is not configured.');

  const { error } = await client.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });
  if (error) throw error;
}

export async function signOut() {
  const client = ensureClient();
  if (!client) return;

  const { error } = await client.auth.signOut();
  if (error) {
    const { error: localError } = await client.auth.signOut({ scope: 'local' });
    if (localError) throw localError;
  }
}

async function applyLocalSignOut() {
  const wasSignedIn = Boolean(currentUser);

  currentUser = null;
  migratedForUserId = null;
  closeAuthMenu();
  closeAllAuthModals();
  updateAuthUI(null);

  const { clearLocalStats } = await import('./stats.js');
  const { clearDailyProgress, clearUnlimitedProgress } = await import('./persistence.js');
  clearLocalStats();
  clearDailyProgress();
  clearUnlimitedProgress();

  if (wasSignedIn) {
    await sessionChangeHandler?.(null);
  }
}

async function performSignOut() {
  await applyLocalSignOut();

  const client = ensureClient();
  if (!client) return;

  try {
    await client.auth.signOut();
  } catch (err) {
    console.error('Sign out failed:', err);
    try {
      await client.auth.signOut({ scope: 'local' });
    } catch (localErr) {
      console.error('Local sign out failed:', localErr);
    }
  }
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

function setDisplayNameStatus(message, isError = false) {
  const el = document.getElementById('display-name-status');
  if (!el) return;
  el.textContent = message || '';
  el.classList.toggle('auth-status--error', Boolean(isError && message));
  el.classList.toggle('hidden', !message);
}

function closeAllAuthModals() {
  closeAuthModal();
  closeDisplayNameModal();
}

function openAuthModal({ preserveStatus = false } = {}) {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  closeDisplayNameModal();
  modal.classList.add('auth-modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('auth-modal-body-lock');
  if (!preserveStatus) setAuthStatus('');
  document.getElementById('auth-email')?.focus();
}

function closeAuthModal() {
  const modal = document.getElementById('authModal');
  if (!modal) return;
  modal.classList.remove('auth-modal-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.getElementById('displayNameModal')?.classList.contains('auth-modal-open')) {
    document.body.classList.remove('auth-modal-body-lock');
  }
  setAuthStatus('');
}

function openDisplayNameModal() {
  const modal = document.getElementById('displayNameModal');
  if (!modal || !currentUser) return;
  closeAuthModal();
  closeAuthMenu();
  const input = document.getElementById('display-name-input');
  if (input) input.value = getDisplayName(currentUser);
  setDisplayNameStatus('');
  modal.classList.add('auth-modal-open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('auth-modal-body-lock');
  input?.focus();
  input?.select();
}

function closeDisplayNameModal() {
  const modal = document.getElementById('displayNameModal');
  if (!modal) return;
  modal.classList.remove('auth-modal-open');
  modal.setAttribute('aria-hidden', 'true');
  if (!document.getElementById('authModal')?.classList.contains('auth-modal-open')) {
    document.body.classList.remove('auth-modal-body-lock');
  }
  setDisplayNameStatus('');
}

async function finishSignIn(session) {
  currentUser = session?.user ?? null;
  updateAuthUI(currentUser);
  closeAllAuthModals();

  if (!currentUser) return;

  await migrateLocalToCloud(currentUser.id);
  await sessionChangeHandler?.(session);
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
    const displayName = getDisplayName(user);
    const initial = displayName.charAt(0).toUpperCase() || '?';
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;

    toggle.classList.add('auth-btn--signed-in');
    toggle.setAttribute('aria-label', 'Account menu');
    if (label) {
      label.textContent = displayName;
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
    closeAllAuthModals();
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
    closeDisplayNameModal();
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
  const changeNameBtn = document.getElementById('authChangeNameBtn');
  const menu = document.getElementById('authMenu');

  const displayNameClose = document.getElementById('displayNameClose');
  const displayNameBackdrop = document.getElementById('displayNameBackdrop');
  const displayNameForm = document.getElementById('displayNameForm');
  const displayNameCancel = document.getElementById('displayNameCancel');

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
  displayNameClose?.addEventListener('click', closeDisplayNameModal);
  displayNameBackdrop?.addEventListener('click', closeDisplayNameModal);
  displayNameCancel?.addEventListener('click', closeDisplayNameModal);

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeAllAuthModals();
      closeAuthMenu();
    }
  });

  document.addEventListener('click', (event) => {
    if (!menu || menu.classList.contains('hidden')) return;
    if (toggle.contains(event.target) || menu.contains(event.target)) return;
    closeAuthMenu();
  });

  menu?.addEventListener('click', (event) => {
    event.stopPropagation();
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

  changeNameBtn?.addEventListener('click', () => {
    openDisplayNameModal();
  });

  displayNameForm?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('display-name-input');
    const submitBtn = displayNameForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;
    setDisplayNameStatus('Saving…');

    try {
      await updateDisplayName(input?.value);
      setDisplayNameStatus('Saved!');
      window.setTimeout(() => closeDisplayNameModal(), 500);
    } catch (err) {
      console.error(err);
      setDisplayNameStatus(err?.message || 'Could not save name.', true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });

  signOutBtn?.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    signOutBtn.disabled = true;
    try {
      await performSignOut();
    } finally {
      signOutBtn.disabled = false;
    }
  });
}

/**
 * Initializes the Supabase client, wires the auth UI, and notifies the app
 * whenever the session changes (after local→cloud migration on sign-in).
 */
export async function initAuth({ onSessionChange } = {}) {
  sessionChangeHandler = onSessionChange || null;
  closeAllAuthModals();
  setupAuthUI();

  const client = ensureClient();
  if (!client) {
    authReady = true;
    updateAuthUI(null);
    return;
  }

  client.auth.onAuthStateChange(async (event, nextSession) => {
    currentUser = nextSession?.user ?? null;
    updateAuthUI(currentUser);

    if (event === 'SIGNED_OUT') {
      await applyLocalSignOut();
      return;
    }

    if (event === 'USER_UPDATED') {
      return;
    }

    if (event === 'SIGNED_IN' && currentUser) {
      closeAllAuthModals();
      await migrateLocalToCloud(currentUser.id);
      await sessionChangeHandler?.(nextSession);
    }
  });

  const { session: oauthSession, error: oauthError } = await completeOAuthCallback(client);

  let session = oauthSession;
  if (!session) {
    const {
      data: { session: storedSession },
    } = await client.auth.getSession();
    session = storedSession;
  }

  if (oauthError) {
    openAuthModal({ preserveStatus: true });
    setAuthStatus(oauthError.message || 'Google sign-in failed. Try again.', true);
  }

  currentUser = session?.user ?? null;
  updateAuthUI(currentUser);

  if (currentUser) {
    await migrateLocalToCloud(currentUser.id);
  }

  authReady = true;
  await sessionChangeHandler?.(currentUser ? session : null);
}
