#!/usr/bin/env node
/**
 * Sync car brand logos with data/cars.json.
 * - Audits which unique makes already have a logo in assets/logos/
 * - Downloads only missing brands (one modern PNG/JPG each from carlogos.org)
 * - Safe to re-run after adding new brands to the catalog
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CATALOG_PATH = join(ROOT, 'data', 'cars.json');
const LOGOS_DIR = join(ROOT, 'assets', 'logos');
const MANIFEST_PATH = join(LOGOS_DIR, 'manifest.json');
const BASE_URL = 'https://www.carlogos.org';
const REQUEST_DELAY_MS = 400;
const LOGO_EXTENSIONS = ['png', 'jpg', 'jpeg'];

const args = new Set(process.argv.slice(2));
const force = args.has('--force');
const dryRun = args.has('--dry-run');
const checkOnly = args.has('--check') || args.has('--check-only');

/** Manual slug overrides when auto-slugify does not match carlogos.org URLs. */
const SLUG_ALIASES = {
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

function slugify(make) {
  if (SLUG_ALIASES[make]) return SLUG_ALIASES[make];

  return make
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getUniqueMakes(catalog) {
  return [...new Set(catalog.map((car) => car.make))].sort((a, b) =>
    a.localeCompare(b)
  );
}

/** Return filename if assets/logos/{slug}.png or .jpg exists. */
function findExistingLogoFile(slug) {
  for (const ext of LOGO_EXTENSIONS) {
    const normalizedExt = ext === 'jpeg' ? 'jpg' : ext;
    const filename = `${slug}.${normalizedExt}`;
    if (existsSync(join(LOGOS_DIR, filename))) {
      return filename;
    }
  }
  return null;
}

/**
 * Compare catalog makes against files on disk.
 * Returns brands that have logos and brands that still need one.
 */
function auditCatalogLogos(makes) {
  const present = [];
  const missing = [];

  for (const make of makes) {
    const slug = slugify(make);
    const filename = findExistingLogoFile(slug);

    if (filename && !force) {
      present.push({ make, slug, filename });
    } else {
      missing.push({ make, slug, reason: force ? 'force re-download' : 'no logo file' });
    }
  }

  return { present, missing };
}

/** Logo files on disk that are not tied to a current catalog make. */
function findOrphanLogos(makes) {
  const catalogSlugs = new Set(makes.map(slugify));
  const orphans = [];

  if (!existsSync(LOGOS_DIR)) return orphans;

  for (const file of readdirSync(LOGOS_DIR)) {
    if (!/\.(png|jpe?g)$/i.test(file) || file === 'manifest.json') continue;
    const slug = file.replace(/\.(png|jpe?g)$/i, '');
    if (!catalogSlugs.has(slug)) {
      orphans.push(file);
    }
  }

  return orphans.sort();
}

function loadExistingManifest() {
  if (!existsSync(MANIFEST_PATH)) return null;
  try {
    return JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Pick a single modern logo path from brand page HTML.
 * Priority: exact {slug}-logo.png (current logo), then highest-year variant if needed.
 */
function pickModernLogoPath(html, slug) {
  const imagePattern = /\/car-logos\/([a-z0-9-]+-logo(?:-[0-9.]+)?)\.(png|jpe?g)/gi;
  const candidates = new Map();

  for (const match of html.matchAll(imagePattern)) {
    const baseName = match[1].toLowerCase();
    const ext = match[2].toLowerCase().replace('jpeg', 'jpg');
    if (!baseName.startsWith(`${slug}-logo`)) continue;
    candidates.set(baseName, ext);
  }

  if (candidates.size === 0) return null;

  const exactKey = `${slug}-logo`;
  if (candidates.has(exactKey)) {
    return {
      path: `/car-logos/${exactKey}.${candidates.get(exactKey)}`,
      ext: candidates.get(exactKey),
    };
  }

  let best = null;
  let bestYear = -1;

  for (const [baseName, ext] of candidates) {
    const yearMatch = baseName.match(/-logo-([0-9.]+)$/);
    if (!yearMatch) continue;
    const year = parseFloat(yearMatch[1]);
    if (year > bestYear) {
      bestYear = year;
      best = { path: `/car-logos/${baseName}.${ext}`, ext };
    }
  }

  return best;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CarleeLogoFetcher/1.0 (local dev script)' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  return response.text();
}

async function fetchBytes(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'CarleeLogoFetcher/1.0 (local dev script)' },
  });
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }
  const contentType = response.headers.get('content-type') || '';
  const buffer = Buffer.from(await response.arrayBuffer());
  return { buffer, contentType };
}

async function downloadLogo(make, slug) {
  const brandPageUrl = `${BASE_URL}/car-brands/${slug}-logo.html`;

  let html;
  try {
    html = await fetchText(brandPageUrl);
  } catch (err) {
    return {
      make,
      slug,
      filename: null,
      sourceUrl: brandPageUrl,
      status: 'not_found',
      error: err.message,
    };
  }

  const picked = pickModernLogoPath(html, slug);
  if (!picked) {
    return {
      make,
      slug,
      filename: null,
      sourceUrl: brandPageUrl,
      status: 'not_found',
      error: 'No PNG/JPG logo found on brand page',
    };
  }

  const sourceUrl = `${BASE_URL}${picked.path}`;
  const filename = `${slug}.${picked.ext}`;
  const outputPath = join(LOGOS_DIR, filename);

  if (dryRun) {
    return { make, slug, filename, sourceUrl, status: 'dry_run' };
  }

  try {
    const { buffer, contentType } = await fetchBytes(sourceUrl);
    const isImage =
      contentType.includes('image/png') ||
      contentType.includes('image/jpeg') ||
      contentType.includes('image/jpg');

    if (!isImage && buffer.length < 100) {
      throw new Error(`Unexpected content type: ${contentType || 'unknown'}`);
    }

    writeFileSync(outputPath, buffer);

    return { make, slug, filename, sourceUrl, status: 'ok' };
  } catch (err) {
    return {
      make,
      slug,
      filename: null,
      sourceUrl,
      status: 'error',
      error: err.message,
    };
  }
}

function buildManifestEntries(makes, resultsBySlug) {
  return makes.map((make) => {
    const slug = slugify(make);
    return (
      resultsBySlug.get(slug) || {
        make,
        slug,
        filename: findExistingLogoFile(slug),
        sourceUrl: null,
        status: 'missing',
      }
    );
  });
}

async function main() {
  mkdirSync(LOGOS_DIR, { recursive: true });

  const catalog = JSON.parse(readFileSync(CATALOG_PATH, 'utf8'));
  const makes = getUniqueMakes(catalog);
  const { present, missing } = auditCatalogLogos(makes);
  const orphans = findOrphanLogos(makes);

  console.log('Catalog logo audit');
  console.log(`  Database:   ${CATALOG_PATH}`);
  console.log(`  Unique makes in catalog: ${makes.length}`);
  console.log(`  Logos present:           ${present.length}`);
  console.log(`  Logos missing:           ${missing.length}`);

  if (present.length > 0) {
    console.log('\nAlready have logos:');
    present.forEach(({ make, filename }) => console.log(`  ✓ ${make} (${filename})`));
  }

  if (missing.length > 0) {
    console.log('\nMissing logos (will fetch):');
    missing.forEach(({ make, slug }) => console.log(`  · ${make} → ${slug}.png|jpg`));
  } else {
    console.log('\nAll catalog brands have logos.');
  }

  if (orphans.length > 0) {
    console.log('\nExtra logo files not in catalog (left unchanged):');
    orphans.forEach((file) => console.log(`  - ${file}`));
  }

  if (checkOnly) {
    console.log('\nCheck-only mode — no downloads performed.');
    process.exit(missing.length > 0 ? 1 : 0);
  }

  if (missing.length === 0) {
    if (!dryRun) {
      const resultsBySlug = new Map(
        present.map(({ make, slug, filename }) => [
          slug,
          {
            make,
            slug,
            filename,
            sourceUrl: loadExistingManifest()?.entries?.find((e) => e.slug === slug)?.sourceUrl ?? null,
            status: 'present',
          },
        ])
      );
      writeFileSync(
        MANIFEST_PATH,
        JSON.stringify(
          {
            generatedAt: new Date().toISOString(),
            source: 'carlogos.org',
            note: 'One modern logo per catalog make; prefers {slug}-logo.png over year variants.',
            catalogMakes: makes.length,
            entries: buildManifestEntries(makes, resultsBySlug),
          },
          null,
          2
        )
      );
      console.log(`\nManifest updated at ${MANIFEST_PATH}`);
    }
    return;
  }

  if (dryRun) console.log('\n(dry run — missing logos will not be written)\n');

  const resultsBySlug = new Map(
    present.map(({ make, slug, filename }) => [
      slug,
      {
        make,
        slug,
        filename,
        sourceUrl: loadExistingManifest()?.entries?.find((e) => e.slug === slug)?.sourceUrl ?? null,
        status: 'present',
      },
    ])
  );

  const counts = { ok: 0, present: present.length, not_found: 0, error: 0, dry_run: 0 };
  const failed = [];

  for (let i = 0; i < missing.length; i += 1) {
    const { make, slug } = missing[i];
    const result = await downloadLogo(make, slug);
    resultsBySlug.set(slug, result);

    if (result.status === 'ok') {
      counts.ok += 1;
      console.log(`✓ Downloaded ${make} → ${result.filename}`);
    } else if (result.status === 'dry_run') {
      counts.dry_run += 1;
      console.log(`→ Would download ${make} → ${result.filename}`);
    } else {
      counts[result.status] = (counts[result.status] || 0) + 1;
      console.log(`✗ ${make} (${result.status})${result.error ? `: ${result.error}` : ''}`);
      failed.push(make);
    }

    if (i < missing.length - 1) {
      await sleep(REQUEST_DELAY_MS);
    }
  }

  if (!dryRun) {
    writeFileSync(
      MANIFEST_PATH,
      JSON.stringify(
        {
          generatedAt: new Date().toISOString(),
          source: 'carlogos.org',
          note: 'One modern logo per catalog make; prefers {slug}-logo.png over year variants.',
          catalogMakes: makes.length,
          entries: buildManifestEntries(makes, resultsBySlug),
        },
        null,
        2
      )
    );
  }

  console.log('\nSummary:');
  console.log(`  Already present: ${counts.present}`);
  console.log(`  Downloaded:    ${counts.ok || 0}`);
  console.log(`  Not found:     ${counts.not_found || 0}`);
  console.log(`  Errors:        ${counts.error || 0}`);
  if (dryRun) console.log(`  Dry run:       ${counts.dry_run || 0}`);

  if (failed.length > 0) {
    console.log('\nFailed makes:');
    failed.forEach((make) => console.log(`  - ${make}`));
  }

  if (!dryRun) {
    console.log(`\nManifest written to ${MANIFEST_PATH}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
