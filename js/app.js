import { loadCatalog } from './data-loader.js';
import { initGame, submitGuess, getGuessedCarIds } from './game.js';
import { searchCars } from './search.js';
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
} from './ui.js';

let catalog = [];
let gameState = null;
let selectedCarId = null;
let searchResults = [];
let activeDropdownIndex = -1;

function getGuessedIds() {
  return gameState ? getGuessedCarIds(gameState) : [];
}

function resetSelection() {
  selectedCarId = null;
  setGuessEnabled(false);
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

function handleGuessSubmit() {
  if (!gameState || !selectedCarId) return;

  const { state, error } = submitGuess(gameState, selectedCarId, catalog);

  if (error) {
    showSearchError(error);
    return;
  }

  gameState = state;
  showSearchError('');
  clearSearchInput();
  resetSelection();
  searchResults = [];
  activeDropdownIndex = -1;
  hideSearchDropdown();
  renderGame(gameState, catalog);
}

function startNewGame() {
  gameState = initGame(catalog);
  resetSelection();
  searchResults = [];
  activeDropdownIndex = -1;
  clearSearchInput();
  hideSearchDropdown();
  showSearchError('');
  renderGame(gameState, catalog);

  const { searchInput } = getUIElements();
  searchInput?.focus();
}

function setupEventListeners() {
  const { searchInput, searchDropdown, guessBtn, playAgainBtn, closeGameOverBtn } = getUIElements();

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
  closeGameOverBtn?.addEventListener('click', () => {
    const { gameOver } = getUIElements();
    gameOver?.classList.add('hidden');
  });

  document.addEventListener('click', (event) => {
    const { searchInput, searchDropdown } = getUIElements();
    if (
      searchInput &&
      searchDropdown &&
      !searchInput.contains(event.target) &&
      !searchDropdown.contains(event.target)
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

async function bootstrap() {
  initUI();
  showLoading();
  setupEventListeners();

  try {
    catalog = await loadCatalog();
    showApp();
    startNewGame();
  } catch (err) {
    console.error(err);
    showError();
  }
}

bootstrap();
