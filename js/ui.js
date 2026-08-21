import { ATTRIBUTES, FEEDBACK, GAME_STATUS } from './constants.js';
import { getBrandLogoUrl, getBodyStyleSvgUrl, getCountryFlagEmoji } from './assets.js';
import { getMsUntilNextUtcMidnight, formatCountdownMs } from './daily.js';
import { formatSearchSubtitle } from './search.js';

const elements = {};
let countdownInterval = null;

const TONE_BY_GUESSES = {
  1: ['First try.', 'Unreal.'],
  2: ['Sharp.', 'You knew that one.'],
  3: ['Sharp.', 'You knew that one.'],
  4: ['Nice solve.'],
  5: ['Clutch.'],
  6: ['Just in time.'],
};

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
  elements.gameOverWrapped = document.getElementById('game-over-wrapped');
  elements.gameOverTitle = document.getElementById('game-over-title');
  elements.gameOverTone = document.getElementById('game-over-tone');
  elements.gameOverMessage = document.getElementById('game-over-message');
  elements.gameOverStreak = document.getElementById('game-over-streak');
  elements.secretReveal = document.getElementById('secret-reveal');
  elements.gameOverPhoto = document.getElementById('game-over-photo');
  elements.gameOverPhotoImg = document.getElementById('game-over-photo-img');
  elements.playAgainBtn = document.getElementById('play-again-btn');
  elements.shareResultBtn = document.getElementById('share-result-btn');
  elements.shareStatus = document.getElementById('share-status');
  elements.closeGameOverBtn = document.getElementById('close-game-over-btn');
  elements.modeLabel = document.getElementById('mode-label');
  elements.dailyDoneNote = document.getElementById('daily-done-note');
  elements.nextCarCountdown = document.getElementById('next-car-countdown');
  elements.playUnlimitedLink = document.getElementById('play-unlimited-link');
}

export function setModeLabel(text) {
  if (elements.modeLabel) elements.modeLabel.textContent = text;
}

/** Daily is one-and-done, so its game over screen swaps replay for the Unlimited exit. */
export function setGameOverActions({ canPlayAgain }) {
  elements.playAgainBtn?.classList.toggle('hidden', !canPlayAgain);
  elements.dailyDoneNote?.classList.toggle('hidden', canPlayAgain);
  elements.playUnlimitedLink?.classList.toggle('hidden', canPlayAgain);
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

function pickTone(guessCount) {
  const options = TONE_BY_GUESSES[guessCount] || TONE_BY_GUESSES[6];
  return options[Math.floor(Math.random() * options.length)];
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function createCarSearchLink(displayName, className) {
  const a = document.createElement('a');
  a.className = className;
  a.href = `https://www.google.com/search?q=${encodeURIComponent(displayName)}`;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  a.textContent = displayName;
  a.title = `Search Google for ${displayName}`;
  return a;
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
  const nameHeading = document.createElement('h2');
  nameHeading.className = 'guess-card-title-wrap';
  nameHeading.appendChild(createCarSearchLink(car.displayName, 'guess-card-title'));
  title.appendChild(nameHeading);

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

/** Marks the newest card as the winning punchline and returns how long to wait. */
export function celebrateWinningCard() {
  const card = elements.guessCards?.querySelector('.guess-card');
  if (!card) return 0;

  card.classList.add('guess-card--win');

  if (prefersReducedMotion()) return 0;

  // Tile flip (~350ms staggered) + short pause so the glow reads as the punchline.
  return 650;
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
    li.dataset.carId = car.id;
    li.className = index === activeIndex ? 'active search-option' : 'search-option';
    li.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');

    const title = document.createElement('span');
    title.className = 'search-option-title';
    title.textContent = car.displayName;

    const subtitle = document.createElement('span');
    subtitle.className = 'search-option-subtitle';
    subtitle.textContent = formatSearchSubtitle(car);

    li.appendChild(title);
    li.appendChild(subtitle);
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

function setText(el, text, { hidden = false } = {}) {
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', hidden || !text);
}

function spawnWinParticles(container) {
  if (!container || prefersReducedMotion()) return;

  const burst = document.createElement('div');
  burst.className = 'win-particles';
  burst.setAttribute('aria-hidden', 'true');

  for (let i = 0; i < 14; i += 1) {
    const speck = document.createElement('span');
    speck.className = 'win-particle';
    speck.style.setProperty('--i', String(i));
    speck.style.setProperty('--angle', `${(360 / 14) * i}deg`);
    burst.appendChild(speck);
  }

  container.appendChild(burst);
  window.setTimeout(() => burst.remove(), 800);
}

function formatStreakLine(streak) {
  if (!streak || streak < 1) return '';
  if (streak === 1) return 'Streak started.';
  return `Streak continues — ${streak} days`;
}

function updateNextCarCountdown() {
  const ms = getMsUntilNextUtcMidnight();

  if (ms <= 0) {
    if (elements.nextCarCountdown) {
      elements.nextCarCountdown.textContent = 'Available now — refresh';
    }
    stopNextCarCountdown();
    return;
  }

  if (elements.nextCarCountdown) {
    elements.nextCarCountdown.textContent = formatCountdownMs(ms);
  }
}

export function startNextCarCountdown() {
  stopNextCarCountdown();
  updateNextCarCountdown();
  countdownInterval = window.setInterval(updateNextCarCountdown, 1000);
}

export function stopNextCarCountdown() {
  if (countdownInterval === null) return;
  window.clearInterval(countdownInterval);
  countdownInterval = null;
}

/**
 * @param {object} state
 * @param {object} secretCar
 * @param {{ streak?: number|null, showShare?: boolean, celebrate?: boolean, showDailyCountdown?: boolean }} [options]
 */
export function showGameOver(state, secretCar, options = {}) {
  if (!elements.gameOver || !secretCar) return;

  const isWin = state.status === GAME_STATUS.WON;
  const celebrate = options.celebrate !== false && isWin;

  elements.gameOver.classList.remove('hidden');
  elements.gameOver.classList.toggle('game-over-won', isWin);
  elements.gameOver.classList.toggle('game-over-lost', !isWin);
  elements.gameOver.classList.toggle('game-over-enter', celebrate && !prefersReducedMotion());

  if (isWin) {
    setText(elements.gameOverTitle, 'Congratulations! 🥳');
    setText(elements.gameOverTone, pickTone(state.guesses.length));
    setText(
      elements.gameOverMessage,
      `You got it in ${state.guesses.length} / ${state.maxGuesses} Guesses!`,
    );
    setText(elements.gameOverStreak, formatStreakLine(options.streak), {
      hidden: !options.streak,
    });
  } else {
    setText(elements.gameOverTitle, 'Out of guesses! The car was:');
    setText(elements.gameOverTone, '', { hidden: true });
    setText(elements.gameOverMessage, '');
    setText(elements.gameOverStreak, '', { hidden: true });
  }

  elements.shareResultBtn?.classList.toggle('hidden', !isWin || options.showShare === false);
  setText(elements.shareStatus, '', { hidden: true });

  if (elements.secretReveal) {
    elements.secretReveal.replaceChildren();

    const makeRow = document.createElement('div');
    makeRow.className = 'secret-reveal-make';

    const logoWrap = document.createElement('div');
    logoWrap.className = `secret-reveal-logo-wrap${isWin ? ' secret-reveal-logo-wrap--win' : ''}`;

    const logoImg = document.createElement('img');
    logoImg.className = 'secret-reveal-logo';
    logoImg.src = getBrandLogoUrl(secretCar.make);
    logoImg.alt = `${secretCar.make} logo`;
    logoImg.addEventListener('error', () => {
      logoImg.hidden = true;
    });

    logoWrap.appendChild(logoImg);
    makeRow.appendChild(logoWrap);
    elements.secretReveal.appendChild(makeRow);
    elements.secretReveal.appendChild(
      createCarSearchLink(secretCar.displayName, 'secret-reveal-name'),
    );

    const specs = document.createElement('div');
    specs.className = 'secret-reveal-specs';
    const specValues = [
      String(secretCar.year),
      secretCar.drivetrain,
      `${secretCar.horsepower} hp`,
      secretCar.engine,
    ];
    specValues.forEach((value, index) => {
      if (index > 0) {
        const dot = document.createElement('span');
        dot.className = 'secret-spec-dot';
        dot.setAttribute('aria-hidden', 'true');
        dot.textContent = '·';
        specs.appendChild(dot);
      }
      const spec = document.createElement('span');
      spec.className = 'secret-spec';
      spec.style.setProperty('--spec-i', String(index));
      spec.textContent = value;
      specs.appendChild(spec);
    });
    elements.secretReveal.appendChild(specs);

    if (isWin && celebrate) {
      spawnWinParticles(logoWrap);
    }
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

  if (celebrate && !prefersReducedMotion()) {
    window.setTimeout(() => {
      elements.gameOver?.classList.remove('game-over-enter');
    }, 320);
  }

  if (options.showDailyCountdown) {
    startNextCarCountdown();
  } else {
    stopNextCarCountdown();
  }
}

export function hideGameOver() {
  stopNextCarCountdown();
  elements.gameOver?.classList.add('hidden');
  elements.gameOver?.classList.remove('game-over-won', 'game-over-lost', 'game-over-enter');
  if (elements.secretReveal) elements.secretReveal.innerHTML = '';
  setText(elements.gameOverTitle, '');
  setText(elements.gameOverTone, '', { hidden: true });
  setText(elements.gameOverMessage, '');
  setText(elements.gameOverStreak, '', { hidden: true });
  setText(elements.shareStatus, '', { hidden: true });
  elements.shareResultBtn?.classList.add('hidden');
  if (elements.gameOverPhotoImg) {
    elements.gameOverPhotoImg.hidden = true;
    elements.gameOverPhotoImg.removeAttribute('src');
    elements.gameOverPhotoImg.alt = '';
    elements.gameOverPhotoImg.onerror = null;
  }
}

export function setShareStatus(message) {
  setText(elements.shareStatus, message, { hidden: !message });
}

/**
 * Paint the board and control the search UI.
 * Pass `showOverlay: false` when a live win should celebrate the card first.
 */
export function renderGame(
  state,
  catalog,
  { showOverlay = true, streak = null, showShare = true, showDailyCountdown = false } = {},
) {
  updateGuessCounter(state.guesses.length, state.maxGuesses);
  renderGuessTable(state.guesses, catalog);

  if (state.status === GAME_STATUS.PLAYING) {
    hideGameOver();
    setSearchEnabled(true);
    setGuessEnabled(false);
    return;
  }

  setSearchEnabled(false);
  setGuessEnabled(false);
  hideSearchDropdown();

  if (!showOverlay) return;

  const secretCar = catalog.find((car) => car.id === state.secretCarId);
  showGameOver(state, secretCar, {
    streak,
    showShare,
    celebrate: false,
    showDailyCountdown,
  });
}
