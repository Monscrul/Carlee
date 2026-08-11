import { loadCatalog } from './data-loader.js';
import { initGame, initDailyGame, restoreGame, submitGuess, getGuessedCarIds } from './game.js';
import { searchCars } from './search.js';
import { GAME_STATUS } from './constants.js';
import { getUtcDateKey, formatDateKeyLabel } from './daily.js';
import {
  saveProgress,
  loadDailyProgress,
  loadUnlimitedProgress,
  clearUnlimitedProgress,
} from './persistence.js';
import { recordDailyResult, getStatsSummary } from './stats.js';
import { renderStatsPanel } from './stats-ui.js';
import { shareGameOverCard } from './share-card.js';
import {
  initUI,
  getUIElements,
  showLoading,
  showError,
  showApp,
  renderGame,
  renderSearchDropdown,
  hideSearchDropdown,
  showSearchError,
  clearSearchInput,
  setGuessEnabled,
  setModeLabel,
  setGameOverActions,
  celebrateWinningCard,
  showGameOver,
  setShareStatus,
} from './ui.js';

let catalog = [];
let gameState = null;
let selectedCarId = null;
let searchResults = [];
let activeDropdownIndex = -1;

const mode =
  new URLSearchParams(window.location.search).get('mode') === 'unlimited'
    ? 'unlimited'
    : 'daily';
const dateKey = getUtcDateKey();

function getGuessedIds() {
  return gameState ? getGuessedCarIds(gameState) : [];
}

function resetSelection() {
  selectedCarId = null;
  setGuessEnabled(false);
}

function persist() {
  saveProgress(mode, gameState, dateKey);
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getWinStreak() {
  if (mode !== 'daily') return null;
  return getStatsSummary(dateKey).currentStreak || null;
}

function openFinishedOverlay({ celebrate = false } = {}) {
  const secretCar = catalog.find((car) => car.id === gameState.secretCarId);
  showGameOver(gameState, secretCar, {
    streak: gameState.status === GAME_STATUS.WON ? getWinStreak() : null,
    showShare: gameState.status === GAME_STATUS.WON,
    celebrate,
  });
}

function handleGameFinished() {
  if (mode !== 'daily') return;

  recordDailyResult(gameState.status === GAME_STATUS.WON, dateKey);
  renderStatsPanel();
}

function wait(ms) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function handleGuessSubmit() {
  if (!gameState || !selectedCarId) return;

  // Disable immediately to prevent double taps while processing
  setGuessEnabled(false);

  const { state, error } = submitGuess(gameState, selectedCarId, catalog);

  if (error) {
    showSearchError(error);
    setGuessEnabled(true);
    return;
  }

  gameState = state;
  persist();
  showSearchError('');
  clearSearchInput();
  resetSelection();
  searchResults = [];
  activeDropdownIndex = -1;
  hideSearchDropdown();

  const justWon = gameState.status === GAME_STATUS.WON;
  const justLost = gameState.status === GAME_STATUS.LOST;

  // Board first. Live finishes open the overlay from here (wins celebrate the card first).
  renderGame(gameState, catalog, { showOverlay: false });

  if (justWon || justLost) handleGameFinished();

  if (justWon) {
    const delay = prefersReducedMotion() ? 0 : celebrateWinningCard();
    if (delay > 0) await wait(delay);
    openFinishedOverlay({ celebrate: true });
    return;
  }

  if (justLost) {
    openFinishedOverlay({ celebrate: false });
  }
}

function resetBoardControls() {
  resetSelection();
  searchResults = [];
  activeDropdownIndex = -1;
  clearSearchInput();
  hideSearchDropdown();
  showSearchError('');
}

function renderCurrentGame() {
  resetBoardControls();

  // Restored finished games open the overlay immediately — no celebration delay.
  renderGame(gameState, catalog, {
    showOverlay: true,
    streak: gameState.status === GAME_STATUS.WON ? getWinStreak() : null,
    showShare: gameState.status === GAME_STATUS.WON,
  });

  const { searchInput } = getUIElements();
  if (gameState.status === GAME_STATUS.PLAYING) searchInput?.focus();
}

/** Play again only applies to Unlimited; Daily keeps today's result on screen. */
function startNewGame() {
  if (mode === 'daily') return;

  clearUnlimitedProgress();
  gameState = initGame(catalog);
  persist();
  renderCurrentGame();
}

async function handleShare() {
  const { gameOverWrapped, shareResultBtn } = getUIElements();
  if (!gameOverWrapped || !shareResultBtn) return;

  shareResultBtn.disabled = true;
  setShareStatus('Preparing…');

  try {
    const result = await shareGameOverCard({
      root: gameOverWrapped,
      filename: `carlee-${dateKey}.png`,
      title: 'Carlee',
    });
    setShareStatus(result.method === 'share' ? 'Shared!' : 'Saved!');
  } catch (err) {
    if (err?.name === 'AbortError') {
      setShareStatus('');
    } else {
      console.error(err);
      setShareStatus('Couldn’t share');
    }
  } finally {
    shareResultBtn.disabled = false;
    window.setTimeout(() => setShareStatus(''), 2200);
  }
}

function setupEventListeners() {
  const {
    searchInput,
    searchDropdown,
    guessBtn,
    playAgainBtn,
    closeGameOverBtn,
    shareResultBtn,
  } = getUIElements();

  searchInput?.addEventListener('input', updateSearch);

  searchInput?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (searchResults.length === 0) return;
      activeDropdownIndex = Math.min(activeDropdownIndex + 1, searchResults.length - 1);
      renderSearchDropdown(searchResults, activeDropdownIndex);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (searchResults.length === 0) return;
      activeDropdownIndex = Math.max(activeDropdownIndex - 1, 0);
      renderSearchDropdown(searchResults, activeDropdownIndex);
      return;
    }

    if (event.key === 'Enter') {
      event.preventDefault();
      const { searchInput } = getUIElements();
      const activeOption = activeDropdownIndex >= 0 ? searchResults[activeDropdownIndex] : null;
      const selectedCar = catalog.find((car) => car.id === selectedCarId);

      if (selectedCar && searchInput?.value === selectedCar.displayName) {
        handleGuessSubmit();
        return;
      }

      if (activeOption) {
        selectCar(activeOption.id);
      } else if (selectedCarId) {
        handleGuessSubmit();
      }
      return;
    }

    if (event.key === 'Escape') {
      hideSearchDropdown();
      activeDropdownIndex = -1;
    }
  });

  searchDropdown?.addEventListener('click', (event) => {
    const option = event.target.closest('[data-car-id]');
    if (!option) return;
    selectCar(option.dataset.carId);
  });

  guessBtn?.addEventListener('click', handleGuessSubmit);
  playAgainBtn?.addEventListener('click', startNewGame);
  shareResultBtn?.addEventListener('click', handleShare);
  closeGameOverBtn?.addEventListener('click', () => {
    const { gameOver } = getUIElements();
    gameOver?.classList.add('hidden');
  });

  document.addEventListener('click', (event) => {
    const { searchInput, searchDropdown, guessBtn } = getUIElements();
    if (
      searchInput &&
      searchDropdown &&
      !searchInput.contains(event.target) &&
      !searchDropdown.contains(event.target) &&
      !guessBtn?.contains(event.target)
    ) {
      hideSearchDropdown();
    }
  });

  document.addEventListener('keydown', (event) => {
    const { searchInput } = getUIElements();
    if (event.key !== 'Enter') return;
    if (document.activeElement === searchInput) return;
    if (!selectedCarId) return;

    event.preventDefault();
    handleGuessSubmit();
  });
}

function updateSearch() {
  const { searchInput } = getUIElements();
  if (!searchInput || !gameState) return;

  const query = searchInput.value;

  if (selectedCarId) {
    const selected = catalog.find((car) => car.id === selectedCarId);
    if (selected && selected.displayName === query) {
      searchResults = [];
      activeDropdownIndex = -1;
      hideSearchDropdown();
      return;
    }
    resetSelection();
  }

  searchResults = searchCars(catalog, query, getGuessedIds());
  activeDropdownIndex = searchResults.length > 0 ? 0 : -1;
  renderSearchDropdown(searchResults, activeDropdownIndex);
}

function selectCar(carId) {
  const car = catalog.find((c) => c.id === carId);
  if (!car) return;

  selectedCarId = carId;
  const { searchInput } = getUIElements();
  if (searchInput) searchInput.value = car.displayName;

  hideSearchDropdown();
  setGuessEnabled(true);
  showSearchError('');
}

function loadGameState() {
  const save = mode === 'daily' ? loadDailyProgress(dateKey) : loadUnlimitedProgress();
  const restored = restoreGame(save, catalog);

  if (restored) return restored;

  const fresh = mode === 'daily' ? initDailyGame(catalog, dateKey) : initGame(catalog);
  return fresh;
}

async function bootstrap() {
  initUI();
  showLoading();
  setupEventListeners();
  setModeLabel(mode === 'daily' ? `Daily · ${formatDateKeyLabel(dateKey)}` : 'Unlimited');
  setGameOverActions({ canPlayAgain: mode === 'unlimited' });

  try {
    catalog = await loadCatalog();
    showApp();
    gameState = loadGameState();
    persist();
    renderCurrentGame();
    renderStatsPanel();
  } catch (err) {
    console.error(err);
    showError();
  }
}

bootstrap();
