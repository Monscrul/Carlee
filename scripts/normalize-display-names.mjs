/**
 * Normalize displayName to: Make Model Trim (Gen) · debutYear
 * Adds optional generation field for search (chassis codes).
 *
 * Run: node scripts/normalize-display-names.mjs
 */
import fs from 'node:fs';

const CARS_PATH = 'data/cars.json';

/** @type {Record<string, string>} */
const GENERATION_BY_ID = {
  'porsche-911-2024-carrera': '992',
  'porsche-911-carrera-gts-2017': '991',
  'porsche-911-gt3-2007': '997',
  'porsche-911-turbo-s-2010': '997',
  'porsche-911-turbo-s-2021': '992',
  'porsche-911-gt2-rs-2018': '991',
  'porsche-911-dakar-2023': '992',
  'porsche-911-turbo-1997': '993',
  'porsche-911-turbo-2002': '996',
  'porsche-911-sc-1983': 'G-Series',
  'porsche-911-carrera-rs-1973': 'Classic',
  'chevrolet-corvette-2024-stingray': 'C8',
  'chevrolet-corvette-c7-stingray-2014': 'C7',
  'chevrolet-corvette-zr1-2019': 'C7',
  'chevrolet-corvette-e-ray-2024': 'C8',
  'chevrolet-corvette-sting-ray-1962': 'C2',
  'ford-mustang-2024-gt': 'S650',
  'ford-mustang-shelby-gt350-2016': 'S550',
  'ford-mustang-shelby-gt500-2020': 'S550',
  'ford-mustang-svt-cobra-1993': 'Fox Body',
  'ford-mustang-mach-e-2021': 'Mach-E',
  'ford-mustang-1964': '1st Gen',
  'ford-mustang-fastback-1965': '1st Gen',
  'volkswagen-golf-gti-2024': 'Mk8',
  'volkswagen-golf-gti-1984': 'Mk1',
  'honda-nsx-1996': 'NA1',
  'honda-nsx-2016': 'NC1',
  'acura-nsx-2001': 'NA1',
  'acura-nsx-2016': 'NC1',
  'honda-integra-type-r-1990': 'DC2',
  'acura-integra-type-r-1990': 'DC2',
  'acura-integra-type-s-2023': '11th Gen',
  'honda-civic-type-r-2023': '11th Gen',
  'honda-civic-hatchback-2024': '11th Gen',
  'honda-civic-2024-si': '11th Gen',
  'bmw-m3-e30-1987': 'E30',
  'bmw-m3-evo-ii-1996': 'E36',
  'bmw-m3-e46-2003': 'E46',
  'bmw-m3-2024-competition': 'G80',
  'nissan-skyline-gt-r-r32-1989': 'R32',
  'nissan-skyline-gt-r-r34-1999': 'R34',
  'nissan-gt-r-2024': 'R35',
  'nissan-gt-r-2009': 'R35',
  'nissan-gt-r-nismo-2015': 'R35',
  'toyota-supra-turbo-1992': 'A80',
  'toyota-gr-supra-2020': 'A90',
  'mazda-rx7-1986': 'FC',
  'mazda-rx7-1993': 'FD',
  'subaru-impreza-wrx-sti-1995': 'GC',
  'subaru-impreza-wrx-sti-2005': 'GD',
  'chevrolet-camaro-z28-1969': '1st Gen',
  'chevrolet-camaro-z28-1979': '2nd Gen',
  'cadillac-eldorado-1959': '3rd Gen',
  'cadillac-eldorado-1975': '4th Gen',
};

function inferPorsche911Generation(year, model) {
  if (year >= 2019) return '992';
  if (year >= 2012) return '991';
  if (year >= 2005) return '997';
  if (year >= 1999) return '996';
  if (year >= 1994) return '993';
  if (year >= 1989) return '964';
  if (model.includes('Turbo') && year >= 1974) return '930';
  if (year >= 1964) return 'Classic';
  return null;
}

function inferCorvetteGeneration(year) {
  if (year >= 2020) return 'C8';
  if (year >= 2014) return 'C7';
  if (year >= 2005) return 'C6';
  if (year >= 1997) return 'C5';
  if (year >= 1984) return 'C4';
  if (year >= 1968) return 'C3';
  if (year >= 1963) return 'C2';
  if (year >= 1953) return 'C1';
  return null;
}

function inferMustangGeneration(year, model) {
  if (model.includes('Mach-E')) return 'Mach-E';
  if (year >= 2023) return 'S650';
  if (year >= 2015) return 'S550';
  if (year >= 2005) return 'S197';
  if (year >= 1994) return 'SN95';
  if (year >= 1979) return 'Fox Body';
  if (year >= 1964) return '1st Gen';
  return null;
}

function inferFromModel(model) {
  const match = model.match(
    /\b(E30|E36|E46|E90|E92|F80|G80|R32|R33|R34|R35|AP1|AP2|NA|NB|NC|ND|FC|FD|GC|GD|A80|A90|DC2|DC5|996|993|992|991|997|964|930)\b/i,
  );
  return match ? match[1].toUpperCase() : null;
}

function inferGeneration(car) {
  if (GENERATION_BY_ID[car.id]) return GENERATION_BY_ID[car.id];

  const fromModel = inferFromModel(car.model);
  if (fromModel) return fromModel;

  if (car.make === 'Porsche' && car.model.startsWith('911')) {
    return inferPorsche911Generation(car.year, car.model);
  }

  if (
    car.make === 'Chevrolet' &&
    (car.model.includes('Corvette') || car.id.includes('corvette'))
  ) {
    return inferCorvetteGeneration(car.year);
  }

  if (car.make === 'Ford' && car.model.includes('Mustang')) {
    return inferMustangGeneration(car.year, car.model);
  }

  if (car.make === 'Volkswagen' && car.model.includes('Golf GTI')) {
    return car.year >= 2020 ? 'Mk8' : car.year >= 1974 ? 'Mk1' : null;
  }

  return null;
}

function stripTrailingYears(name) {
  return name.replace(/\s+(19|20)\d{2}\b/g, '').trim();
}

function stripGenerationToken(name, generation) {
  if (!generation) return name;

  let next = name;
  const escaped = generation.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  next = next.replace(new RegExp(`\\s*\\(${escaped}\\)`, 'gi'), '');
  next = next.replace(new RegExp(`\\b${escaped}\\b`, 'gi'), '');
  return next.replace(/\s+/g, ' ').trim();
}

function buildDisplayName(car, generation, modelYearSuffix = '') {
  let base = stripTrailingYears(car.displayName);
  base = stripGenerationToken(base, generation);

  if (generation) {
    base = `${base} (${generation})`;
  }

  if (modelYearSuffix) {
    base = `${base} (${modelYearSuffix})`;
  }

  return `${base} · ${car.year}`;
}

function extractModelYearFromId(id) {
  const matches = [...id.matchAll(/-(19|20)\d{2}(?=-|$)/g)];
  if (matches.length === 0) return null;
  return matches[matches.length - 1][0].slice(1);
}

function normalizeCatalog(catalog) {
  const firstPass = catalog.map((car) => {
    const generation = inferGeneration(car) || '';
    return {
      car,
      generation,
      displayName: buildDisplayName(car, generation || null),
    };
  });

  const nameCounts = new Map();
  for (const entry of firstPass) {
    nameCounts.set(entry.displayName, (nameCounts.get(entry.displayName) || 0) + 1);
  }

  return firstPass.map(({ car, generation }) => {
    let modelYearSuffix = '';
    const baseName = buildDisplayName(car, generation || null);

    if ((nameCounts.get(baseName) || 0) > 1) {
      const modelYear = extractModelYearFromId(car.id);
      if (modelYear) modelYearSuffix = modelYear;
    }

    const displayName = buildDisplayName(car, generation || null, modelYearSuffix);

    return {
      ...car,
      displayName,
      ...(generation ? { generation } : {}),
    };
  });
}
const catalog = JSON.parse(fs.readFileSync(CARS_PATH, 'utf8'));
const normalized = normalizeCatalog(catalog);

const names = new Set();
for (const car of normalized) {
  if (names.has(car.displayName)) {
    console.error(`Duplicate displayName after normalize: ${car.displayName} (${car.id})`);
    process.exit(1);
  }
  names.add(car.displayName);
}

fs.writeFileSync(CARS_PATH, `${JSON.stringify(normalized, null, 2)}\n`);
console.log(`Updated ${normalized.length} cars in ${CARS_PATH}`);
