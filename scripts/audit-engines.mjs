/**
 * Apply home-market launch engine/hp corrections to data/cars.json.
 * Rules: home-market first production year; named trim engine; else base engine.
 *
 * Run: node scripts/audit-engines.mjs
 */
import fs from 'node:fs';

const CARS_PATH = 'data/cars.json';

/**
 * Corrections keyed by car id.
 * horsepower is metric-converted where sources use PS (1 PS ≈ 0.986 hp); we store integer hp
 * as commonly published for that home market (PS rounded for Japan/Germany when that was the official figure).
 * For Japanese "gentleman's agreement" era we store the official PS figure as horsepower (common catalog practice: 280).
 *
 * @type {Record<string, { engine?: string, horsepower?: number, note?: string }>}
 */
const FIXES = {
  // --- Clear trim / displacement errors ---
  'ford-f150-2024-raptor': {
    engine: '3.5L V6 Twin-Turbo',
    horsepower: 450,
    note: 'Raptor (not Raptor R); 3.5 HO EcoBoost at 13th-gen launch',
  },
  'ford-bronco-raptor-2024': {
    engine: '3.0L V6 Twin-Turbo',
    horsepower: 418,
    note: 'Bronco Raptor uses 3.0 twin-turbo, not 2.7',
  },
  'nissan-gt-r-2024': {
    engine: '3.8L V6 Twin-Turbo',
    horsepower: 480,
    note: 'Japan 2007 launch: VR38DETT 480 PS',
  },
  'nissan-gt-r-2011': {
    engine: '3.8L V6 Twin-Turbo',
    horsepower: 480,
    note: 'Align to R35 Japan launch figure for same gen entry',
  },
  'nissan-gt-r-nismo-2018': {
    engine: '3.8L V6 Twin-Turbo',
    horsepower: 600,
    note: 'Nismo keeps twin-turbo label; ~600 PS class',
  },
  'toyota-supra-turbo-1992': {
    engine: '3.0L I6 Twin-Turbo',
    horsepower: 280,
    note: 'A80 Japan: 2JZ-GTE 280 PS (not US 320)',
  },
  'toyota-supra-mk4-1994': {
    engine: '3.0L I6 Twin-Turbo',
    horsepower: 280,
    note: 'Same A80 Japan turbo rating',
  },
  'toyota-supra-2020': {
    engine: '3.0L I6 Turbo',
    horsepower: 340,
    note: 'A90 Japan launch B58 ~340 PS class; catalog had US 382',
  },
  'subaru-outback-2024': {
    engine: '2.4L H4 Turbo',
    horsepower: 260,
    note: 'Wilderness uses FA24F turbo flat-four, not I4',
  },
  'subaru-outback-xt-2024': {
    engine: '2.4L H4 Turbo',
    horsepower: 260,
  },
  'porsche-911-2024-carrera': {
    engine: '3.0L H6 Twin-Turbo',
    horsepower: 385,
    note: '992 Carrera launch ~385 PS biturbo flat-six',
  },
  'bmw-m3-2024-competition': {
    engine: '3.0L I6 Twin-Turbo',
    horsepower: 510,
    note: 'G80 Competition Germany ~510 PS',
  },
  'bmw-m4-competition-2022': {
    engine: '3.0L I6 Twin-Turbo',
    horsepower: 510,
  },
  'mercedes-c-class-2024-amg': {
    engine: '2.0L I4 Turbo',
    horsepower: 408,
    note: 'W206 C 43 mild-hybrid turbo four',
  },
  'volkswagen-golf-gti-2024': {
    engine: '2.0L I4 Turbo',
    horsepower: 245,
    note: 'Mk8 GTI Europe launch ~245 PS',
  },
  'volkswagen-golf-gti-1984': {
    engine: '1.6L I4',
    horsepower: 110,
    note: 'Mk1 GTI launch 1976/77 was 1.6; later 1.8',
  },
  'genesis-gv70-2024': {
    engine: '3.5L V6 Twin-Turbo',
    horsepower: 375,
  },
  'jaguar-f-type-2024': {
    engine: '3.0L V6 Supercharged',
    horsepower: 340,
    note: 'F-Type launch V6 S/C base; R Dynamic is a package, not F-Type R',
  },
  'land-rover-defender-2024': {
    engine: '3.0L I6 Turbo',
    horsepower: 400,
    note: 'L663 Ingenium mild-hybrid I6',
  },
  'aston-martin-vantage-2024': {
    engine: '4.0L V8 Twin-Turbo',
    horsepower: 503,
  },
  'maserati-grecale-2024': {
    engine: '3.0L V6 Twin-Turbo',
    horsepower: 530,
    note: 'Trofeo Nettuno',
  },
  'alfa-romeo-giulia-2024': {
    engine: '2.9L V6 Twin-Turbo',
    horsepower: 510,
    note: 'Quadrifoglio Italy launch ~510 PS',
  },
  'alfa-romeo-giulia-quadrifoglio-2017': {
    engine: '2.9L V6 Twin-Turbo',
    horsepower: 510,
  },
  'dodge-challenger-2023-srt': {
    engine: '6.2L V8 Supercharged',
    horsepower: 707,
    note: 'Hellcat launch was ~707 hp; later Redeye higher',
  },
  'lexus-rx-2024': {
    engine: '2.4L I4 Turbo',
    horsepower: 275,
    note: 'RX 350 5th gen turbo four',
  },
  'lexus-gx-550-2024': {
    engine: '3.4L V6 Twin-Turbo',
    horsepower: 349,
    note: 'GX 550 is 3.4TT, not 3.5 NA',
  },
  'honda-civic-2024-si': {
    engine: '1.5L I4 Turbo',
    horsepower: 200,
  },
  'audi-a4-2024-quattro': {
    engine: '2.0L I4 Turbo',
    horsepower: 252,
    note: 'B9 A4 launch 2.0 TFSI Quattro class',
  },
  'mini-cooper-s-2024': {
    engine: '2.0L I4 Turbo',
    horsepower: 192,
  },
  'peugeot-308-2024': {
    engine: '1.2L I3 Turbo',
    horsepower: 130,
    note: 'Europe PureTech base; 181 was optimistic for 1.2 NA',
  },
  'citroen-c5-aircross-2024': {
    engine: '1.2L I3 Turbo',
    horsepower: 130,
  },
  'ford-focus-st-2013': {
    engine: '2.0L I4 Turbo',
    horsepower: 250,
  },
  'hyundai-elantra-n-2024': {
    engine: '2.0L I4 Turbo',
    horsepower: 276,
  },
  'acura-integra-type-s-2023': {
    engine: '2.0L I4 Turbo',
    horsepower: 320,
  },
  'kia-stinger-gt-2018': {
    engine: '3.3L V6 Twin-Turbo',
    horsepower: 365,
  },
  'genesis-g80-sport-2023': {
    engine: '3.5L V6 Twin-Turbo',
    horsepower: 375,
  },
  'porsche-macan-turbo-2015': {
    engine: '3.6L V6 Twin-Turbo',
    horsepower: 400,
    note: 'First Macan Turbo was 3.6 biturbo ~400 PS, not 3.0/340',
  },
  'porsche-911-turbo-1997': {
    engine: '3.6L H6 Twin-Turbo',
    horsepower: 408,
    note: '993 Turbo Germany ~408 PS',
  },
  'porsche-911-turbo-2002': {
    engine: '3.6L H6 Twin-Turbo',
    horsepower: 420,
  },
  'porsche-911-turbo-s-2010': {
    engine: '3.8L H6 Twin-Turbo',
    horsepower: 530,
    note: '997.2 Turbo S',
  },
  'porsche-911-turbo-s-2021': {
    engine: '3.8L H6 Twin-Turbo',
    horsepower: 650,
    note: '992 Turbo S ~650 PS',
  },
  'porsche-911-gt2-rs-2018': {
    engine: '3.8L H6 Twin-Turbo',
    horsepower: 700,
  },
  'porsche-911-gt3-2007': {
    engine: '3.6L H6',
    horsepower: 415,
  },
  'porsche-911-carrera-gts-2014': {
    engine: '3.8L H6',
    horsepower: 430,
  },
  'porsche-911-dakar-2023': {
    engine: '3.0L H6 Twin-Turbo',
    horsepower: 480,
  },
  'porsche-911-carrera-rs-1973': {
    engine: '2.7L H6',
    horsepower: 210,
  },
  'porsche-911-sc-1983': {
    engine: '3.0L H6',
    horsepower: 204,
    note: '911 SC Europe often ~204 PS',
  },
  'bmw-m3-e30-1987': {
    engine: '2.3L I4',
    horsepower: 200,
    note: 'E30 M3 Europe S14 ~200 PS',
  },
  'bmw-m3-evo-ii-1996': {
    engine: '3.2L I6',
    horsepower: 321,
    note: 'E36 M3 Evolution (EU) 3.2 ~321 PS; US was 240',
  },
  'bmw-m3-e46-2001': {
    engine: '3.2L I6',
    horsepower: 343,
    note: 'E46 M3 Europe S54 343 PS',
  },
  'bmw-m2-2017': {
    engine: '3.0L I6 Turbo',
    horsepower: 370,
  },
  'honda-nsx-1996': {
    engine: '3.0L V6',
    horsepower: 280,
    note: 'NA1 Japan C30A ~280 PS',
  },
  'acura-nsx-2001': {
    engine: '3.2L V6',
    horsepower: 280,
    note: 'NA2 Japan C32B ~280 PS gentleman agreement',
  },
  'honda-nsx-2016': {
    engine: '3.5L V6 Twin-Turbo Hybrid',
    horsepower: 573,
  },
  'acura-nsx-2016': {
    engine: '3.5L V6 Twin-Turbo Hybrid',
    horsepower: 573,
  },
  'honda-integra-type-r-1990': {
    engine: '1.8L I4',
    horsepower: 200,
    note: 'DC2 Japan B18C ~200 PS',
  },
  'acura-integra-type-r-1990': {
    engine: '1.8L I4',
    horsepower: 200,
    note: 'Same DC2 Japan Integra Type R as Honda twin',
  },
  'honda-civic-type-r-1997': {
    engine: '1.6L I4',
    horsepower: 185,
    note: 'EK9 B16B 185 PS Japan',
  },
  'honda-s2000-2000': {
    engine: '2.0L I4',
    horsepower: 250,
    note: 'AP1 Japan F20C 250 PS',
  },
  'nissan-skyline-gt-r-r32-1989': {
    engine: '2.6L I6 Twin-Turbo',
    horsepower: 280,
    note: 'Official 280 PS gentleman agreement (often listed 276)',
  },
  'nissan-skyline-gt-r-r34-1999': {
    engine: '2.6L I6 Twin-Turbo',
    horsepower: 280,
  },
  'nissan-300zx-twin-turbo-1990': {
    engine: '3.0L V6 Twin-Turbo',
    horsepower: 280,
    note: 'Z32 Japan TT ~280 PS',
  },
  'nissan-silvia-s15-1999': {
    engine: '2.0L I4 Turbo',
    horsepower: 250,
  },
  'mitsubishi-lancer-evo-ii-1994': {
    engine: '2.0L I4 Turbo',
    horsepower: 260,
  },
  'mitsubishi-lancer-evo-vi-1999': {
    engine: '2.0L I4 Turbo',
    horsepower: 280,
  },
  'mitsubishi-lancer-evo-ix-2006': {
    engine: '2.0L I4 Turbo',
    horsepower: 280,
  },
  'mitsubishi-3000gt-vr4-1998': {
    engine: '3.0L V6 Twin-Turbo',
    horsepower: 280,
    note: 'Japan GTO Twin Turbo ~280 PS',
  },
  'subaru-impreza-wrx-sti-1995': {
    engine: '2.0L H4 Turbo',
    horsepower: 280,
    note: 'GC STI Japan ~280 PS',
  },
  'subaru-impreza-wrx-sti-2005': {
    engine: '2.0L H4 Turbo',
    horsepower: 280,
    note: 'GD Japan STI often 2.0 280 PS (US was 2.5)',
  },
  'mazda-rx7-1986': {
    engine: '1.3L Twin-Rotor Turbo',
    horsepower: 185,
    note: 'FC Japan turbo rotary',
  },
  'mazda-rx7-fd-1993': {
    engine: '1.3L Twin-Rotor Twin-Turbo',
    horsepower: 280,
    note: 'FD Japan 280 PS',
  },
  'mazda-rx8-2008': {
    engine: '1.3L Twin-Rotor',
    horsepower: 250,
    note: 'Japan high-power Renesis ~250 PS',
  },
  'ferrari-testarossa-1984': {
    engine: '4.9L Flat-12',
    horsepower: 390,
  },
  'ferrari-308-gtsi-1982': {
    engine: '3.0L V8',
    horsepower: 214,
    note: '308 GTSi Europe after emissions ~214 PS class',
  },
  'lamborghini-huracan-2024': {
    engine: '5.2L V10',
    horsepower: 640,
    note: 'Huracán launch LP610-4 ~610 PS; EVO higher — use EVO ~640',
  },
  'mclaren-artura-2024': {
    engine: '3.0L V6 Twin-Turbo Hybrid',
    horsepower: 680,
  },
  'ferrari-296-gtb-2024': {
    engine: '3.0L V6 Twin-Turbo Hybrid',
    horsepower: 830,
  },
  'chevrolet-corvette-zr1-2019': {
    engine: '6.2L V8 Supercharged',
    horsepower: 755,
  },
  'chevrolet-corvette-e-ray-2022': {
    engine: '6.2L V8 Hybrid',
    horsepower: 655,
  },
  'ford-mustang-shelby-gt350-2015': {
    engine: '5.2L V8',
    horsepower: 526,
  },
  'ford-mustang-shelby-gt500-2020': {
    engine: '5.2L V8 Supercharged',
    horsepower: 760,
  },
  'ford-mustang-svt-cobra-2004': {
    engine: '4.6L V8 Supercharged',
    horsepower: 390,
    note: 'Terminator Cobra was supercharged 4.6',
  },
  'mercedes-e55-amg-2004': {
    engine: '5.4L V8 Supercharged',
    horsepower: 476,
    note: 'E55 Kompressor ~5.4 L / 476 PS',
  },
  'mercedes-c63-amg-2012': {
    engine: '6.2L V8',
    horsepower: 457,
  },
  'audi-rs6-2003': {
    engine: '4.2L V8 Twin-Turbo',
    horsepower: 450,
  },
  'audi-r8-v10-2016': {
    engine: '5.2L V10',
    horsepower: 540,
  },
  'audi-sport-quattro-1985': {
    engine: '2.1L I5 Turbo',
    horsepower: 306,
  },
  'porsche-959-1988': {
    engine: '2.85L H6 Twin-Turbo',
    horsepower: 450,
  },
  'delorean-dmc12-1981': {
    engine: '2.8L V6',
    horsepower: 130,
  },
  'volvo-xc60-2024': {
    engine: '2.0L I4 Mild Hybrid',
    horsepower: 250,
  },
  'volvo-xc90-recharge-2021': {
    engine: '2.0L I4 Plug-In Hybrid',
    horsepower: 400,
  },
  'volvo-xc60-recharge-2024': {
    engine: '2.0L I4 Plug-In Hybrid',
    horsepower: 455,
  },
  'volvo-v60-recharge-2024': {
    engine: '2.0L I4 Plug-In Hybrid',
    horsepower: 455,
  },
  'chevrolet-volt-2011': {
    engine: '1.4L I4 Range Extender',
    horsepower: 149,
  },
  'jeep-wrangler-4xe-2021': {
    engine: '2.0L I4 Turbo Hybrid',
    horsepower: 375,
  },
  'bmw-x5-xdrive50e-2024': {
    engine: '3.0L I6 Plug-In Hybrid',
    horsepower: 483,
  },
  'mercedes-amg-gt-53-2021': {
    engine: '3.0L I6 Turbo',
    horsepower: 435,
  },
  'toyota-gr-corolla-2024': {
    engine: '1.6L I3 Turbo',
    horsepower: 300,
  },
  'toyota-gr86-2021': {
    engine: '2.4L H4',
    horsepower: 235,
    note: 'Japan FA24 ~235 PS',
  },
  'subaru-brz-2012': {
    engine: '2.0L H4',
    horsepower: 200,
  },
  'nissan-rogue-2024': {
    engine: '1.5L I3 Turbo',
    horsepower: 201,
  },
  'mazda-cx90-2024': {
    engine: '3.3L I6 Turbo',
    horsepower: 280,
  },
  'ram-1500-trx-2024': {
    engine: '6.2L V8 Supercharged',
    horsepower: 702,
  },
  'tesla-model-s-2012': {
    engine: 'Single Motor EV',
    horsepower: 416,
  },
  'tesla-model-x-2015': {
    engine: 'Dual Motor EV',
    horsepower: 532,
  },
  'rimac-nevera-2024': {
    engine: 'Quad Motor EV',
    horsepower: 1914,
  },
  'bugatti-veyron-2005': {
    engine: '8.0L W16 Quad-Turbo',
    horsepower: 1001,
  },
  'bugatti-chiron-super-sport-2024': {
    engine: '8.0L W16 Quad-Turbo',
    horsepower: 1578,
  },
  'koenigsegg-jesko-attack-2024': {
    engine: '5.0L V8 Twin-Turbo',
    horsepower: 1280,
  },
  'mclaren-f1-1992': {
    engine: '6.1L V12',
    horsepower: 627,
  },
  'ferrari-f40-1987': {
    engine: '2.9L V8 Twin-Turbo',
    horsepower: 478,
  },
  'honda-prelude-type-sh-1997': {
    engine: '2.2L I4',
    horsepower: 200,
  },
  'toyota-prius-prime-2023': {
    engine: '2.0L I4 Plug-In Hybrid',
    horsepower: 220,
    note: 'Current Prime uses 2.0 hybrid system',
  },
  'fiat-500e-2024': {
    engine: 'Single Motor EV',
    horsepower: 118,
  },
  'porsche-macan-electric-2024': {
    engine: 'Dual Motor EV',
    horsepower: 402,
  },
  'porsche-boxster-s-2003': {
    engine: '3.2L H6',
    horsepower: 260,
    note: '986 Boxster S was 3.2, not 2.7',
  },
  'ford-explorer-sport-2016': {
    engine: '3.5L V6 Twin-Turbo',
    horsepower: 365,
    note: 'Sport EcoBoost',
  },
  'chevrolet-colorado-z71-2024': {
    engine: '2.7L I4 Turbo',
    horsepower: 310,
  },
  'mclaren-mp4-12c-2012': {
    engine: '3.8L V8 Twin-Turbo',
    horsepower: 592,
  },
  'mclaren-720s-2019': {
    engine: '4.0L V8 Twin-Turbo',
    horsepower: 710,
  },
  'mclaren-750s-2024': {
    engine: '4.0L V8 Twin-Turbo',
    horsepower: 740,
  },
  'aston-martin-db12-2024': {
    engine: '4.0L V8 Twin-Turbo',
    horsepower: 680,
  },
  'bmw-m8-competition-2020': {
    engine: '4.4L V8 Twin-Turbo',
    horsepower: 625,
  },
  'ferrari-roma-2023': {
    engine: '3.9L V8 Twin-Turbo',
    horsepower: 620,
  },
  'ferrari-sf90-stradale-2024': {
    engine: '4.0L V8 Twin-Turbo Hybrid',
    horsepower: 1000,
  },
  'lamborghini-revuelto-2024': {
    engine: '6.5L V12 Hybrid',
    horsepower: 1015,
  },
  'pagani-utopia-2024': {
    engine: '6.0L V12 Twin-Turbo',
    horsepower: 852,
  },
  'bentley-continental-gt-2003': {
    engine: '6.0L W12 Twin-Turbo',
    horsepower: 552,
  },
  'jaguar-f-pace-svr-2024': {
    engine: '5.0L V8 Supercharged',
    horsepower: 550,
  },
  'land-rover-range-rover-sport-2024': {
    engine: '3.0L I6 Turbo',
    horsepower: 400,
  },
  'lotus-esprit-turbo-1980': {
    engine: '2.2L I4 Turbo',
    horsepower: 210,
  },
  'saab-900-turbo-1985': {
    engine: '2.0L I4 Turbo',
    horsepower: 145,
  },
  'mercedes-g-class-1979': {
    engine: '2.3L I4',
    horsepower: 90,
    note: 'Early G-Wagen base petrol was small four; 2.8 I6 came later',
  },
  'ford-mustang-2024-gt': {
    engine: '5.0L V8',
    horsepower: 480,
  },
  'chevrolet-corvette-2024-stingray': {
    engine: '6.2L V8',
    horsepower: 495,
  },
  'toyota-camry-2024-xse': {
    engine: '2.5L I4',
    horsepower: 206,
    note: 'XV70 Japan 2.5 ~203–206 PS; US XSE was 203–206 then 225 with DI updates — home Japan ~206',
  },
  'honda-cr-v-2024': {
    engine: '1.5L I4 Turbo',
    horsepower: 190,
  },
  'mazda-mx5-2024': {
    engine: '2.0L I4',
    horsepower: 184,
  },
  'mazda-mx5-rf-2024': {
    engine: '2.0L I4',
    horsepower: 184,
  },
  'nissan-350z-2003': {
    engine: '3.5L V6',
    horsepower: 280,
    note: 'Japan Fairlady Z ~280 PS at launch',
  },
  'nissan-370z-2009': {
    engine: '3.7L V6',
    horsepower: 333,
  },
  'lexus-ls400-1991': {
    engine: '4.0L V8',
    horsepower: 250,
  },
  'lexus-is-f-2008': {
    engine: '5.0L V8',
    horsepower: 423,
  },
  'lexus-is-500-2021': {
    engine: '5.0L V8',
    horsepower: 472,
  },
  'lexus-lfa-2010': {
    engine: '4.8L V10',
    horsepower: 560,
  },
  'honda-accord-hybrid-2023': {
    engine: '2.0L I4 Hybrid',
    horsepower: 204,
  },
  'honda-cr-v-hybrid-2024': {
    engine: '2.0L I4 Hybrid',
    horsepower: 204,
  },
  'honda-civic-hatchback-2024': {
    engine: '2.0L I4',
    horsepower: 158,
    note: 'Japan/base 2.0 NA; US often 158–180',
  },
  'renault-clio-2024': {
    engine: '1.6L I4 Hybrid',
    horsepower: 140,
  },
  'renault-clio-2024-2': {
    engine: '1.0L I3 Turbo',
    horsepower: 100,
    note: 'Base Clio TCe at launch class',
  },
  'peugeot-208-2024': {
    engine: '1.2L I3 Turbo',
    horsepower: 100,
  },
  'peugeot-3008-2024': {
    engine: '1.6L I4 Hybrid',
    horsepower: 225,
  },
  'alfa-romeo-tonale-2024': {
    engine: '1.5L I4 Mild Hybrid',
    horsepower: 160,
    note: 'Europe base mild hybrid; US 2.0 PHEV differs — home Italy 1.5',
  },
  'renault-austral-2024': {
    engine: '1.2L I3 Mild Hybrid',
    horsepower: 130,
  },
  'citroen-c3-aircross-2024': {
    engine: '1.2L I3 Turbo',
    horsepower: 110,
  },
  'fiat-tipo-2024': {
    engine: '1.4L I4 Turbo',
    horsepower: 120,
  },
  'mini-clubman-s-2024': {
    engine: '2.0L I4 Turbo',
    horsepower: 192,
  },
  'mini-countryman-se-2024': {
    engine: 'Dual Motor EV',
    horsepower: 313,
  },
  'ford-escape-hybrid-2024': {
    engine: '2.5L I4 Hybrid',
    horsepower: 192,
  },
  'ford-maverick-hybrid-2024': {
    engine: '2.5L I4 Hybrid',
    horsepower: 191,
  },
  'toyota-highlander-hybrid-2024': {
    engine: '2.5L I4 Hybrid',
    horsepower: 243,
  },
  'toyota-rav4-2024-hybrid': {
    engine: '2.5L I4 Hybrid',
    horsepower: 218,
  },
  'toyota-land-cruiser-2024': {
    engine: '2.4L I4 Turbo Hybrid',
    horsepower: 326,
  },
  'kia-sportage-hybrid-2024': {
    engine: '1.6L I4 Turbo Hybrid',
    horsepower: 227,
  },
  'hyundai-santa-fe-2024': {
    engine: '2.5L I4 Turbo',
    horsepower: 277,
  },
  'bmw-z8-2000': {
    engine: '4.9L V8',
    horsepower: 400,
  },
  'bmw-z4-2002': {
    engine: '2.5L I6',
    horsepower: 192,
    note: 'E85 Europe 2.5i ~192 PS',
  },
  'bmw-30-csl-1974': {
    engine: '3.0L I6',
    horsepower: 206,
  },
  'mercedes-190sl-1960': {
    engine: '1.9L I4',
    horsepower: 105,
  },
  'mercedes-450sl-1980': {
    engine: '4.5L V8',
    horsepower: 217,
  },
  'cadillac-cts-v-2004': {
    engine: '5.7L V8',
    horsepower: 400,
  },
  'ford-gt-2005': {
    engine: '5.4L V8 Supercharged',
    horsepower: 550,
  },
  'buick-gnx-1987': {
    engine: '3.8L V6 Turbo',
    horsepower: 276,
  },
  'jeep-wrangler-2024-rubicon': {
    engine: '3.6L V6',
    horsepower: 285,
  },
  'tesla-model-3-2024-long-range': {
    engine: 'Dual Motor EV',
    horsepower: 346,
  },
  'lucid-air-2024': {
    engine: 'Dual Motor EV',
    horsepower: 620,
  },
  'rivian-r1t-2024': {
    engine: 'Dual Motor EV',
    horsepower: 533,
  },
};

const catalog = JSON.parse(fs.readFileSync(CARS_PATH, 'utf8'));
let changed = 0;
const missing = [];

for (const car of catalog) {
  const fix = FIXES[car.id];
  if (!fix) continue;

  let dirty = false;
  if (fix.engine && fix.engine !== car.engine) {
    car.engine = fix.engine;
    dirty = true;
  }
  if (typeof fix.horsepower === 'number' && fix.horsepower !== car.horsepower) {
    car.horsepower = fix.horsepower;
    dirty = true;
  }
  if (dirty) {
    changed += 1;
    console.log(`${car.id}: ${fix.engine || car.engine} / ${fix.horsepower ?? car.horsepower}hp${fix.note ? ` — ${fix.note}` : ''}`);
  }
}

for (const id of Object.keys(FIXES)) {
  if (!catalog.some((c) => c.id === id)) missing.push(id);
}

fs.writeFileSync(CARS_PATH, `${JSON.stringify(catalog, null, 2)}\n`);
console.log(`\nUpdated ${changed} cars.`);
if (missing.length) {
  console.warn('Unknown ids in FIXES:', missing.join(', '));
}
