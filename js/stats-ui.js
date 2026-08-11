/** Fills the shared navbar Statistics panel from device-local daily stats. */
import { getStatsSummary } from './stats.js';

const STAT_TILES = [
  { key: 'currentStreak', label: 'Current streak' },
  { key: 'maxStreak', label: 'Max streak' },
  { key: 'gamesPlayed', label: 'Games played' },
  { key: 'winRate', label: 'Win rate', suffix: '%' },
];

export function renderStatsPanel() {
  const container = document.getElementById('stats-panel-body');
  if (!container) return;

  const summary = getStatsSummary();
  container.innerHTML = '';

  const grid = document.createElement('div');
  grid.className = 'stats-grid';

  for (const tile of STAT_TILES) {
    const cell = document.createElement('div');
    cell.className = 'stats-cell';

    const value = document.createElement('span');
    value.className = 'stats-cell-value';
    value.textContent = `${summary[tile.key]}${tile.suffix ?? ''}`;

    const label = document.createElement('span');
    label.className = 'stats-cell-label';
    label.textContent = tile.label;

    cell.appendChild(value);
    cell.appendChild(label);
    grid.appendChild(cell);
  }

  const note = document.createElement('p');
  note.className = 'stats-panel-message';
  note.textContent = summary.gamesPlayed
    ? 'Daily results only.'
    : 'Play the Daily car to start a streak.';

  container.appendChild(grid);
  container.appendChild(note);
}

function init() {
  renderStatsPanel();
  document.getElementById('statsToggle')?.addEventListener('click', renderStatsPanel);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
