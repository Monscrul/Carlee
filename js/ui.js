import { ATTRIBUTES, FEEDBACK, GAME_STATUS } from './constants.js';
import { getBrandLogoUrl, getBodyStyleSvgUrl, getCountryFlagEmoji } from './assets.js';

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
  elements.gameOverPhoto = document.getElementById('game-over-photo');
  elements.gameOverPhotoImg = document.getElementById('game-over-photo-img');
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

/** Compact attrs (Drive/HP/Year) vs wider text attrs (Make/Country). */
function getTileSizeClass(attrKey) {
  switch (attrKey) {
    case 'drivetrain':
    case 'horsepower':
    case 'year':
    case 'make':
    case 'bodyStyle':
    case 'country':
    case 'engine':
      return 'guess-tile--compact';
      default:
      return 'guess-tile--wide';
  }
}

function createGuessCard(guess, car, isNew) {
  const card = document.createElement('article');
  card.className = `guess-card${isNew ? ' guess-card--new' : ''}`;

  const header = document.createElement('div');
  header.className = 'guess-card-header';

  const avatar = document.createElement('div');
  avatar.className = 'guess-card-avatar';

  const logoImg = document.createElement('img');
  logoImg.className = 'guess-card-avatar-img';
  logoImg.src = getBrandLogoUrl(car.make);
  logoImg.alt = `${car.make} logo`;
  logoImg.loading = 'lazy';

  const logoFallback = document.createElement('span');
  logoFallback.className = 'guess-card-avatar-fallback';
  logoFallback.textContent = car.make?.[0] || '?';
  logoFallback.hidden = true;

  logoImg.addEventListener('error', () => {
    logoImg.hidden = true;
    logoFallback.hidden = false;
  });

  avatar.appendChild(logoImg);
  avatar.appendChild(logoFallback);

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
    const sizeClass = getTileSizeClass(attr.key);
    tile.className = `guess-tile guess-tile--${result.status}${sizeClass ? ` ${sizeClass}` : ''}`;

    const label = document.createElement('div');
    label.className = 'tile-label';
    label.textContent = attr.label;

    const value = document.createElement('div');
    value.className = 'tile-value';
    const attributeValue = getAttributeValue(attr.key, car);

    const text = document.createElement('span');
    text.className = 'tile-text';
    text.textContent = attributeValue;
    value.appendChild(text);

    if (attr.key === 'country') {
      const flag = getCountryFlagEmoji(car.country);
      if (flag) {
        const flagEl = document.createElement('span');
        flagEl.className = 'tile-flag';
        flagEl.textContent = flag;
        flagEl.setAttribute('aria-hidden', 'true');
        flagEl.title = car.country;
        value.appendChild(flagEl);
      }
    }

    const badge = document.createElement('span');
    badge.className = 'tile-badge';
    badge.textContent = getResultBadge(result.status);
    value.appendChild(badge);

    tile.appendChild(label);
    tile.appendChild(value);
    grid.appendChild(tile);
  }

  card.appendChild(grid);

  const photoSlot = document.createElement('div');
  photoSlot.className = 'guess-card-photo';
  photoSlot.dataset.carId = car.id;
  photoSlot.dataset.bodyStyle = car.bodyStyle;

  const photoImg = document.createElement('img');
  photoImg.className = 'guess-card-photo-img';
  photoImg.alt = `${car.bodyStyle} silhouette`;
  photoImg.src = getBodyStyleSvgUrl(car.bodyStyle);
  photoImg.loading = 'lazy';
  photoImg.addEventListener('error', () => {
    photoImg.remove();
  });

  photoSlot.appendChild(photoImg);
  card.appendChild(photoSlot);

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

  if (elements.secretReveal) {
    elements.secretReveal.innerHTML = `
      <div class="secret-reveal-make">
        <img
          class="secret-reveal-logo"
          src="${getBrandLogoUrl(secretCar.make)}"
          alt="${secretCar.make} logo"
        />
      </div>
      <strong>${secretCar.displayName}</strong>
      <span>${secretCar.year} · ${secretCar.drivetrain} · ${secretCar.horsepower} hp · ${secretCar.engine}</span>
    `;

    const logoImg = elements.secretReveal.querySelector('.secret-reveal-logo');
    logoImg?.addEventListener('error', () => {
      logoImg.hidden = true;
    });
  }

  if (elements.gameOverPhotoImg) {
    const photoImg = elements.gameOverPhotoImg;
    photoImg.hidden = false;
    photoImg.alt = `${secretCar.bodyStyle} silhouette`;
    photoImg.src = getBodyStyleSvgUrl(secretCar.bodyStyle);
    photoImg.onerror = () => {
      photoImg.hidden = true;
      photoImg.removeAttribute('src');
    };
  }
}

export function hideGameOver() {
  elements.gameOver?.classList.add('hidden');
  elements.gameOver?.classList.remove('game-over-won', 'game-over-lost');
  if (elements.secretReveal) elements.secretReveal.innerHTML = '';
  if (elements.gameOverMessage) elements.gameOverMessage.textContent = '';
  if (elements.gameOverPhotoImg) {
    elements.gameOverPhotoImg.hidden = true;
    elements.gameOverPhotoImg.removeAttribute('src');
    elements.gameOverPhotoImg.alt = '';
    elements.gameOverPhotoImg.onerror = null;
  }
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
