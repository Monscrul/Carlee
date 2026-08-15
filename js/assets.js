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

/** Maps catalog bodyStyle → SVG filename in assets/cars/ */
const BODY_STYLE_SVG = {
  Sedan: 'Sedan.svg',
  Coupe: 'Coupe.svg',
  Convertible: 'Convertible.svg',
  SUV: 'SUV.svg',
  Truck: 'Truck.svg',
  Wagon: 'Wagon.svg',
  Hatchback: 'Hatchback.svg',
  // Closest available silhouette when a dedicated SVG is not present yet
  Roadster: 'Convertible.svg',
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

/** Body-style silhouette SVG for guess cards / game over. */
export function getBodyStyleSvgUrl(bodyStyle) {
  const file = BODY_STYLE_SVG[bodyStyle] || BODY_STYLE_SVG.Sedan;
  return `assets/cars/${file}`;
}

/** @deprecated Prefer getBodyStyleSvgUrl(car.bodyStyle) */
export function getCarPhotoUrl(carId) {
  return `assets/cars/${carId}.png`;
}
