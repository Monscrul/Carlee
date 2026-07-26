import { ATTRIBUTES, FEEDBACK, GAME_STATUS } from './constants.js';

const elements = {};

export function initUI() {
  elements.loading = document.getElementById('loading');
  elements.error = document.getElementById('error');
  elements.app = document.getElementById('app');
  elements.guessCounter = document.getElementById('guess-counter');
  elements.searchInput = document.getElementById('search-input');
  elements.searchDropdown = document.getElementById('search-dropdown');
  elements.guessBtn = document.getElementById('guess-btn');
  elements.searchError = document.getElementById('search-error');
  elements.emptyHint = document.getElementById('empty-hint');
  elements.guessCards = document.getElementById('guess-cards');
  elements.gameOver = document.getElementById('game-over');
  elements.gameOverMessage = document.getElementById('game-over-message');
  elements.secretReveal = document.getElementById('secret-reveal');
  elements.playAgainBtn = document.getElementById('play-again-btn');
  elements.closeGameOverBtn = document.getElementById('close-game-over-btn');

}

export function getUIElements() {
  return elements;
}

export function showLoading() {
  elements.loading?.classList.remove('hidden');
  elements.error?.classList.add('hidden');
  elements.app?.classList.add('hidden');
}

export function showError() {
  elements.loading?.classList.add('hidden');
  elements.error?.classList.remove('hidden');
  elements.app?.classList.add('hidden');
}

export function showApp() {
  elements.loading?.classList.add('hidden');
  elements.error?.classList.add('hidden');
  elements.app?.classList.remove('hidden');
}

function getAttributeValue(attrKey, car) {
  switch (attrKey) {
    case 'horsepower':
      return car.horsepower;
    case 'year':
      return car.year;
    case 'make':
      return car.make;
    case 'country':
      return car.country;
    case 'drivetrain':
      return car.drivetrain;
    case 'bodyStyle':
      return car.bodyStyle;
    case 'engine':
      return car.engine;
    default:
      return '';
  }
}

function formatCellContent(attrKey, result, car) {
  const { status, delta, direction } = result;

  if (status === FEEDBACK.CORRECT) {
    const value = getAttributeValue(attrKey, car);
    return value !== '' ? `${value} ✓` : '✓';
  }

  if (status === FEEDBACK.WRONG) {
    if (attrKey === 'horsepower') return `${car.horsepower} ✗`;
    if (attrKey === 'year') return `${car.year} ✗`;
    return getAttributeValue(attrKey, car) || '✗';
  }

  if (status === FEEDBACK.PARTIAL) {
    const arrow = direction === FEEDBACK.HIGHER ? '↑' : '↓';
    const value = attrKey === 'horsepower' ? car.horsepower : car.year;
    return `${value} ${arrow} (~${delta})`;
  }

  if (status === FEEDBACK.HIGHER) {
    const value = attrKey === 'horsepower' ? car.horsepower : car.year;
    return `${value} ↑`;
  }

  if (status === FEEDBACK.LOWER) {
    const value = attrKey === 'horsepower' ? car.horsepower : car.year;
    return `${value} ↓`;
  }

  return '';
}

function getResultBadge(status) {
  switch (status) {
    case FEEDBACK.CORRECT:
      return '✓';
    case FEEDBACK.WRONG:
      return '✗';
    case FEEDBACK.HIGHER:
      return '↑';
    case FEEDBACK.LOWER:
      return '↓';
    default:
      return '';
  }
}

function createGuessCard(guess, car, isNew) {
  const card = document.createElement('article');
  card.className = `guess-card${isNew ? ' guess-card--new' : ''}`;

  const header = document.createElement('div');
  header.className = 'guess-card-header';

  const avatar = document.createElement('div');
  avatar.className = 'guess-card-avatar';
  avatar.textContent = car.make?.[0] || '?';

  const title = document.createElement('div');
  const name = document.createElement('h2');
  name.className = 'guess-card-title';
  name.textContent = car.displayName;
  title.appendChild(name);

  header.appendChild(avatar);
  header.appendChild(title);
  card.appendChild(header);

  const grid = document.createElement('div');
  grid.className = 'guess-card-grid';

  for (const attr of ATTRIBUTES) {
    const result = guess.attributes[attr.key];
    const tile = document.createElement('div');
    tile.className = `guess-tile guess-tile--${result.status}`;

    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = attr.label;

    const value = document.createElement('div');
    value.className = 'tile-value';
    const attributeValue = getAttributeValue(attr.key, car);
    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = getResultBadge(result.status);

    value.textContent = attributeValue;
    if (result.status === FEEDBACK.CORRECT) {
      value.appendChild(badge);
    } else {
      value.appendChild(badge);
    }

    tile.appendChild(label);
    tile.appendChild(value);
    grid.appendChild(tile);
  }

  card.appendChild(grid);
  return card;
}

export function renderGuessTable(guesses, catalog) {
  if (!elements.guessCards) return;

  elements.guessCards.innerHTML = '';

  if (guesses.length === 0) {
    elements.emptyHint?.classList.remove('hidden');
    return;
  }

  elements.emptyHint?.classList.add('hidden');

  for (let index = guesses.length - 1; index >= 0; index -= 1) {
    const guess = guesses[index];
    const car = catalog.find((c) => c.id === guess.carId);
    if (!car) continue;
    const card = createGuessCard(guess, car, index === guesses.length - 1);
    elements.guessCards.appendChild(card);
  }
}

export function updateGuessCounter(guessCount, maxGuesses) {
  if (elements.guessCounter) {
    elements.guessCounter.textContent = `Guesses: ${guessCount} / ${maxGuesses}`;
  }
}

export function renderSearchDropdown(results, activeIndex) {
  if (!elements.searchDropdown || !elements.searchInput) return;

  elements.searchDropdown.innerHTML = '';

  if (results.length === 0) {
    elements.searchDropdown.classList.add('hidden');
    elements.searchInput.setAttribute('aria-expanded', 'false');
    return;
  }

  results.forEach((car, index) => {
    const li = document.createElement('li');
    li.role = 'option';
    li.id = `search-option-${index}`;
    li.textContent = car.displayName;
    li.dataset.carId = car.id;
    li.className = index === activeIndex ? 'active' : '';
    li.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
    elements.searchDropdown.appendChild(li);
  });

  elements.searchDropdown.classList.remove('hidden');
  elements.searchInput.setAttribute('aria-expanded', 'true');
}

export function hideSearchDropdown() {
  elements.searchDropdown?.classList.add('hidden');
  elements.searchInput?.setAttribute('aria-expanded', 'false');
}

export function showSearchError(message) {
  if (!elements.searchError) return;

  if (message) {
    elements.searchError.textContent = message;
    elements.searchError.classList.remove('hidden');
  } else {
    elements.searchError.textContent = '';
    elements.searchError.classList.add('hidden');
  }
}

export function setSearchEnabled(enabled) {
  if (elements.searchInput) elements.searchInput.disabled = !enabled;
}

export function setGuessEnabled(enabled) {
  if (elements.guessBtn) elements.guessBtn.disabled = !enabled;
}

export function clearSearchInput() {
  if (elements.searchInput) elements.searchInput.value = '';
}

export function showGameOver(state, secretCar) {
  if (!elements.gameOver || !secretCar) return;

  elements.gameOver.classList.remove('hidden');

  if (state.status === GAME_STATUS.WON) {
    elements.gameOverMessage.textContent = `You got it in ${state.guesses.length} ${
      state.guesses.length === 1 ? 'guess' : 'guesses'
    }!`;
    elements.gameOver.classList.add('game-over-won');
    elements.gameOver.classList.remove('game-over-lost');
  } else {
    elements.gameOverMessage.textContent = 'Out of guesses! The car was:';
    elements.gameOver.classList.add('game-over-lost');
    elements.gameOver.classList.remove('game-over-won');
  }

  elements.secretReveal.innerHTML = `
    <strong>${secretCar.displayName}</strong>
    <span>${secretCar.year} · ${secretCar.drivetrain} · ${secretCar.horsepower} hp · ${secretCar.engine}</span>
  `;
}

export function hideGameOver() {
  elements.gameOver?.classList.add('hidden');
  elements.gameOver?.classList.remove('game-over-won', 'game-over-lost');
  if (elements.secretReveal) elements.secretReveal.innerHTML = '';
  if (elements.gameOverMessage) elements.gameOverMessage.textContent = '';
}

export function renderGame(state, catalog) {
  updateGuessCounter(state.guesses.length, state.maxGuesses);
  renderGuessTable(state.guesses, catalog);

  if (state.status === GAME_STATUS.PLAYING) {
    hideGameOver();
    setSearchEnabled(true);
    setGuessEnabled(false);
  } else {
    const secretCar = catalog.find((car) => car.id === state.secretCarId);
    showGameOver(state, secretCar);
    setSearchEnabled(false);
    setGuessEnabled(false);
    hideSearchDropdown();
  }
}
