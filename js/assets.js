/** Shared helpers for brand logos and country flags used in the UI. */

const MAKE_SLUG_ALIASES = {
  'Mercedes-Benz': 'mercedes-benz',
  'Land Rover': 'land-rover',
  'Alfa Romeo': 'alfa-romeo',
  'Aston Martin': 'aston-martin',
  MINI: 'mini',
  GMC: 'gmc',
  BMW: 'bmw',
  BYD: 'byd',
  Citroën: 'citroen',
  DeLorean: 'delorean',
  Oldsmobile: 'oldsmobile',
  Plymouth: 'plymouth',
  Pontiac: 'pontiac',
  Saab: 'saab',
};

const COUNTRY_FLAGS = {
  China: '🇨🇳',
  Croatia: '🇭🇷',
  France: '🇫🇷',
  Germany: '🇩🇪',
  Italy: '🇮🇹',
  Japan: '🇯🇵',
  'South Korea': '🇰🇷',
  Sweden: '🇸🇪',
  UK: '🇬🇧',
  USA: '🇺🇸',
};

export function makeToSlug(make) {
  if (MAKE_SLUG_ALIASES[make]) return MAKE_SLUG_ALIASES[make];

  return make
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Primary logo path; caller should handle onerror fallback. */
export function getBrandLogoUrl(make) {
  return `assets/logos/${makeToSlug(make)}.png`;
}

export function getCountryFlagEmoji(country) {
  return COUNTRY_FLAGS[country] || '';
}

/** Convention for optional per-car photos: assets/cars/{carId}.png */
export function getCarPhotoUrl(carId) {
  return `assets/cars/${carId}.png`;
}
