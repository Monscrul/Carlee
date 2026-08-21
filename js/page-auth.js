/** Initializes Supabase auth on non-game pages and syncs stats when signed in. */
import { initAuth } from './auth.js';
import { loadStatsFromCloud, clearCloudStatsCache } from './stats.js';
import { renderStatsPanel } from './stats-ui.js';

async function refreshFromCloudSession(session) {
  if (!session?.user) {
    clearCloudStatsCache();
    renderStatsPanel();
    return;
  }

  await loadStatsFromCloud();
  renderStatsPanel();
}

initAuth({ onSessionChange: refreshFromCloudSession });
