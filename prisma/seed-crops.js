/**
 * Crop Master Seed — 15 Major Maharashtra Crops
 * Source: ICAR Package of Practices + MPKV Rahuri recommendations
 *
 * Run: node prisma/seed-crops.js
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const crops = [
  {
    name: 'soybean', nameHi: 'सोयाबीन', nameMr: 'सोयाबीन',
    category: 'oilseed', seasons: ['kharif'], maturityDays: 95,
    kcInitial: 0.4, kcMid: 1.15, kcLate: 0.5,
    seedRate: { value: 30, unit: 'kg/acre' },
    spacing: { rowToRow: '30 cm', plantToPlant: '5 cm' },
    varieties: [
      { name: 'JS 9560', suitableRegions: ['Vidarbha', 'Marathwada'], maturityDays: 90, yieldPerAcre: '8-12 q' },
      { name: 'MAUS 71', suitableRegions: ['Maharashtra'], maturityDays: 95, yieldPerAcre: '10-14 q' },
      { name: 'Phule Kalyani', suitableRegions: ['Konkan', 'Western Maharashtra'], maturityDays: 100, yieldPerAcre: '10-15 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal (at sowing)', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 50, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 20, unit: 'kg' }] },
      { stage: 'First top-dress (30 days)', stageDays: 30, fertilizers: [{ name: 'Urea', quantityPerAcre: 10, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Germination (0-10 days)', criticalPeriod: true, waterRequirement: '30mm', method: 'light irrigation or sprinkler' },
      { stage: 'Flowering (40-55 days)', criticalPeriod: true, waterRequirement: '50mm', method: 'furrow or sprinkler' },
      { stage: 'Pod fill (65-80 days)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow or drip' },
    ],
    commonPests: [
      { pest: 'Stem fly', pestHi: 'तना मक्खी', season: 'kharif', solution: 'Thiamethoxam 25WG @ 3g/10L spray at 15 and 30 DAS' },
      { pest: 'Girdle beetle', pestHi: 'करधनी बीटल', season: 'kharif', solution: 'Profenofos 50EC @ 2ml/L at 30-40 DAS' },
      { pest: 'Tobacco caterpillar', pestHi: 'तंबाकू इल्ली', season: 'kharif', solution: 'SpineSad 45SC @ 0.75ml/L or Chlorpyrifos 20EC @ 2ml/L' },
    ],
    commonDiseases: [
      { disease: 'Yellow Mosaic Virus', diseaseHi: 'पीला मोज़ेक वायरस', symptoms: 'Yellow patches on leaves, stunted growth', solution: 'Control whitefly vector with Imidacloprid 70WG @ 0.3g/L. Remove infected plants.' },
      { disease: 'Bacterial Pustule', diseaseHi: 'बैक्टीरियल पस्ट्युल', symptoms: 'Small pale green water-soaked spots with pustules on leaves', solution: 'Copper oxychloride 50WP @ 3g/L spray + avoid overhead irrigation' },
    ],
    harvestIndicators: ['Leaves turn yellow and fall', 'Pod rattles when shaken', '95% pods brown', 'Moisture < 15%'],
    mspCommodityCode: 'SOYABEAN', agmarknetCode: 'Soyabean',
  },
  {
    name: 'tur', nameHi: 'तुअर (अरहर)', nameMr: 'तूर',
    category: 'pulse', seasons: ['kharif'], maturityDays: 170,
    kcInitial: 0.4, kcMid: 1.05, kcLate: 0.55,
    seedRate: { value: 5, unit: 'kg/acre' },
    spacing: { rowToRow: '90 cm', plantToPlant: '30 cm' },
    varieties: [
      { name: 'BDN 711', suitableRegions: ['Marathwada', 'Vidarbha'], maturityDays: 160, yieldPerAcre: '6-8 q' },
      { name: 'ICPL 87119 (Asha)', suitableRegions: ['Maharashtra'], maturityDays: 180, yieldPerAcre: '8-12 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 25, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 25, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Flowering (70-80 days)', criticalPeriod: true, waterRequirement: '50mm', method: 'furrow or basin' },
      { stage: 'Pod fill (130-150 days)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow' },
    ],
    commonPests: [
      { pest: 'Pod borer', pestHi: 'फली भेदक', season: 'kharif', solution: 'Emamectin Benzoate 5SG @ 0.4g/L at pod formation. Pheromone traps @ 5/acre.' },
      { pest: 'Tur aphid', pestHi: 'माहू', season: 'kharif', solution: 'Dimethoate 30EC @ 2ml/L or Imidacloprid 17.8SL @ 0.5ml/L' },
    ],
    commonDiseases: [
      { disease: 'Fusarium Wilt', diseaseHi: 'फ्यूजेरियम म्लान', symptoms: 'Sudden wilting, roots turn brown', solution: 'Resistant variety + Trichoderma seed treatment @ 5g/kg seed' },
      { disease: 'Sterility Mosaic', diseaseHi: 'बंझपन मोज़ेक', symptoms: 'Mosaic, leaf distortion, no pod formation', solution: 'Control eriophyid mite with Wettable Sulphur 80WP @ 3g/L' },
    ],
    harvestIndicators: ['80% pods brown', 'Leaves dry and fallen', 'Stem turns brown'],
    mspCommodityCode: 'TUR_DAL', agmarknetCode: 'Arhar/Tur',
  },
  {
    name: 'cotton', nameHi: 'कपास (Bt)', nameMr: 'कापूस',
    category: 'cash_crop', seasons: ['kharif'], maturityDays: 180,
    kcInitial: 0.35, kcMid: 1.15, kcLate: 0.7,
    seedRate: { value: 0.9, unit: 'kg/acre (Bt hybrid packet)' },
    spacing: { rowToRow: '90 cm', plantToPlant: '60 cm' },
    varieties: [
      { name: 'Bollgard II hybrids', suitableRegions: ['Vidarbha', 'Marathwada', 'North Maharashtra'], maturityDays: 180, yieldPerAcre: '8-15 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 50, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 33, unit: 'kg' }] },
      { stage: '30 DAS', stageDays: 30, fertilizers: [{ name: 'Urea', quantityPerAcre: 35, unit: 'kg' }] },
      { stage: '60 DAS (bud stage)', stageDays: 60, fertilizers: [{ name: 'Urea', quantityPerAcre: 35, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 17, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Square formation (40-50 DAS)', criticalPeriod: true, waterRequirement: '60mm', method: 'furrow or drip' },
      { stage: 'Flowering (65-80 DAS)', criticalPeriod: true, waterRequirement: '70mm', method: 'furrow or drip' },
      { stage: 'Boll development (90-120 DAS)', criticalPeriod: true, waterRequirement: '60mm', method: 'furrow or drip' },
    ],
    commonPests: [
      { pest: 'Pink Bollworm', pestHi: 'गुलाबी इल्ली', season: 'kharif', solution: 'Emamectin Benzoate 5SG @ 0.4g/L + pheromone traps @ 5/acre' },
      { pest: 'Whitefly', pestHi: 'सफेद मक्खी', season: 'kharif', solution: 'Pyriproxyfen 5EC @ 1ml/L or Spiromesifen 22.9SC @ 0.9ml/L' },
      { pest: 'Thrips', pestHi: 'थ्रिप्स', season: 'kharif', solution: 'Spinosad 45SC @ 0.3ml/L or Fipronil 5SC @ 1.5ml/L' },
    ],
    commonDiseases: [
      { disease: 'Alternaria Leaf Spot', diseaseHi: 'अल्टरनेरिया पत्ती धब्बा', symptoms: 'Brown circular spots with concentric rings', solution: 'Mancozeb 75WP @ 2.5g/L spray' },
    ],
    harvestIndicators: ['Bolls fully open (4-5 locks open)', 'Lint white and fluffy', 'Moisture < 8%'],
    mspCommodityCode: 'COTTON', agmarknetCode: 'Cotton',
  },
  {
    name: 'onion', nameHi: 'प्याज', nameMr: 'कांदा',
    category: 'vegetable', seasons: ['kharif', 'rabi'], maturityDays: 130,
    kcInitial: 0.5, kcMid: 1.0, kcLate: 0.75,
    seedRate: { value: 4, unit: 'kg/acre (transplanted)' },
    spacing: { rowToRow: '15 cm', plantToPlant: '10 cm' },
    varieties: [
      { name: 'Bhima Shakti', suitableRegions: ['Nashik', 'Pune', 'Solapur'], maturityDays: 95, yieldPerAcre: '80-100 q' },
      { name: 'Bhima Raj', suitableRegions: ['Nashik', 'Ahmednagar'], maturityDays: 110, yieldPerAcre: '100-120 q' },
      { name: 'N 2-4-1', suitableRegions: ['Maharashtra'], maturityDays: 130, yieldPerAcre: '100-140 q (long storage)' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal (at transplanting)', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 50, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 50, unit: 'kg' }] },
      { stage: '30 DAT', stageDays: 30, fertilizers: [{ name: 'Urea', quantityPerAcre: 30, unit: 'kg' }] },
      { stage: '60 DAT', stageDays: 60, fertilizers: [{ name: 'Urea', quantityPerAcre: 25, unit: 'kg' }, { name: 'SOP', quantityPerAcre: 25, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'After transplanting', criticalPeriod: true, waterRequirement: '30mm', method: 'light drip or sprinkler' },
      { stage: 'Bulb formation (60-90 DAT)', criticalPeriod: true, waterRequirement: '50mm every 7 days', method: 'drip or furrow' },
    ],
    commonPests: [
      { pest: 'Thrips', pestHi: 'थ्रिप्स', season: 'both', solution: 'Fipronil 5SC @ 1.5ml/L or Spinosad 45SC @ 0.3ml/L' },
      { pest: 'Onion fly maggot', pestHi: 'प्याज मक्खी', season: 'rabi', solution: 'Soil drench with Chlorpyrifos 20EC @ 2.5ml/L' },
    ],
    commonDiseases: [
      { disease: 'Purple Blotch', diseaseHi: 'बैंगनी धब्बा', symptoms: 'Pale purple lesions with white center on leaves', solution: 'Mancozeb 75WP @ 2.5g/L + Metalaxyl 8% @ 2g/L spray every 10 days' },
      { disease: 'Stemphylium Blight', diseaseHi: 'स्टेम्फिलियम ब्लाइट', symptoms: 'Yellow-orange water-soaked lesions on leaves', solution: 'Iprodione 50WP @ 2g/L spray' },
    ],
    harvestIndicators: ['50% neck fall', 'Leaves turn yellow', 'Bulb skin dry and papery'],
    mspCommodityCode: 'ONION', agmarknetCode: 'Onion',
  },
  {
    name: 'tomato', nameHi: 'टमाटर', nameMr: 'टोमॅटो',
    category: 'vegetable', seasons: ['kharif', 'rabi', 'zaid'], maturityDays: 100,
    kcInitial: 0.6, kcMid: 1.15, kcLate: 0.8,
    seedRate: { value: 0.25, unit: 'kg/acre (hybrid)' },
    spacing: { rowToRow: '60 cm', plantToPlant: '45 cm' },
    varieties: [
      { name: 'Arka Rakshak', suitableRegions: ['Maharashtra'], maturityDays: 80, yieldPerAcre: '200-250 q' },
      { name: 'Syngenta 6242', suitableRegions: ['Pune', 'Nashik'], maturityDays: 75, yieldPerAcre: '250-300 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'FYM', quantityPerAcre: 2000, unit: 'kg' }, { name: 'DAP', quantityPerAcre: 50, unit: 'kg' }] },
      { stage: '21 DAT', stageDays: 21, fertilizers: [{ name: 'Urea', quantityPerAcre: 25, unit: 'kg' }] },
      { stage: '45 DAT (flowering)', stageDays: 45, fertilizers: [{ name: 'Urea', quantityPerAcre: 25, unit: 'kg' }, { name: '0:52:34', quantityPerAcre: 5, unit: 'kg (fertigation)' }] },
    ],
    irrigationSchedule: [
      { stage: 'After transplanting', criticalPeriod: true, waterRequirement: '20mm', method: 'drip' },
      { stage: 'Fruit set (40-60 DAT)', criticalPeriod: true, waterRequirement: '40mm every 4-5 days', method: 'drip' },
    ],
    commonPests: [
      { pest: 'Fruit borer', pestHi: 'फल छेदक', season: 'all', solution: 'Emamectin Benzoate 5SG @ 0.4g/L. Pheromone traps @ 5/acre.' },
      { pest: 'Whitefly / Leaf curl', pestHi: 'सफेद मक्खी', season: 'all', solution: 'Imidacloprid 70WG @ 0.3g/L or Thiamethoxam 25WG @ 0.3g/L' },
    ],
    commonDiseases: [
      { disease: 'Early Blight', diseaseHi: 'अर्ली ब्लाइट', symptoms: 'Brown spots with concentric rings — "target board" appearance', solution: 'Mancozeb 75WP @ 2.5g/L spray every 7-10 days' },
      { disease: 'Late Blight', diseaseHi: 'लेट ब्लाइट', symptoms: 'Water-soaked spots turning brown, white mold underneath in humid conditions', solution: 'Metalaxyl + Mancozeb 72WP @ 2.5g/L spray immediately' },
    ],
    harvestIndicators: ['75% color break (pink/red)', 'Firm flesh', 'Easy detachment from calyx'],
    mspCommodityCode: 'TOMATO', agmarknetCode: 'Tomato',
  },
  {
    name: 'wheat', nameHi: 'गेहूँ', nameMr: 'गहू',
    category: 'cereal', seasons: ['rabi'], maturityDays: 115,
    kcInitial: 0.3, kcMid: 1.15, kcLate: 0.4,
    seedRate: { value: 40, unit: 'kg/acre' },
    spacing: { rowToRow: '22.5 cm', plantToPlant: 'broadcast or line sowing' },
    varieties: [
      { name: 'NW 1014', suitableRegions: ['North Maharashtra', 'Marathwada'], maturityDays: 110, yieldPerAcre: '16-20 q' },
      { name: 'GW 496', suitableRegions: ['Maharashtra'], maturityDays: 115, yieldPerAcre: '18-22 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 60, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 20, unit: 'kg' }] },
      { stage: 'CRI (21 days)', stageDays: 21, fertilizers: [{ name: 'Urea', quantityPerAcre: 30, unit: 'kg' }] },
      { stage: 'Tillering (45 days)', stageDays: 45, fertilizers: [{ name: 'Urea', quantityPerAcre: 25, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'CRI (20-22 DAS)', criticalPeriod: true, waterRequirement: '50mm', method: 'flood or sprinkler' },
      { stage: 'Tillering (40-45 DAS)', criticalPeriod: true, waterRequirement: '50mm', method: 'flood or sprinkler' },
      { stage: 'Flowering (75-80 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'sprinkler preferred' },
      { stage: 'Grain fill (95-100 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'sprinkler' },
    ],
    commonPests: [
      { pest: 'Aphid', pestHi: 'माहू', season: 'rabi', solution: 'Dimethoate 30EC @ 2ml/L spray at ETL (5 aphids/shoot)' },
      { pest: 'Termite', pestHi: 'दीमक', season: 'rabi', solution: 'Chlorpyrifos 20EC @ 3L/acre soil treatment before sowing' },
    ],
    commonDiseases: [
      { disease: 'Yellow Rust', diseaseHi: 'पीला रतुआ', symptoms: 'Yellow pustule stripes on leaves', solution: 'Propiconazole 25EC @ 1ml/L at first sign' },
      { disease: 'Powdery Mildew', diseaseHi: 'चूर्णिल फफूंद', symptoms: 'White powdery coating on leaves', solution: 'Sulphur 80WP @ 3g/L or Carbendazim 50WP @ 1g/L' },
    ],
    harvestIndicators: ['Golden yellow crop', 'Grains hard (thumbnail test)', 'Moisture < 12%'],
    mspCommodityCode: 'WHEAT', agmarknetCode: 'Wheat',
  },
  {
    name: 'gram', nameHi: 'चना (हरभरा)', nameMr: 'हरभरा',
    category: 'pulse', seasons: ['rabi'], maturityDays: 110,
    kcInitial: 0.4, kcMid: 1.0, kcLate: 0.5,
    seedRate: { value: 30, unit: 'kg/acre (desi)' },
    spacing: { rowToRow: '30 cm', plantToPlant: '10 cm' },
    varieties: [
      { name: 'Vijay (ICCC 37)', suitableRegions: ['Marathwada', 'Vidarbha'], maturityDays: 100, yieldPerAcre: '8-12 q' },
      { name: 'Phule G 5', suitableRegions: ['Maharashtra'], maturityDays: 105, yieldPerAcre: '10-14 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'SSP', quantityPerAcre: 100, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 25, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Pre-sowing', criticalPeriod: false, waterRequirement: '50mm', method: 'life irrigation' },
      { stage: 'Flowering (40-45 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow or sprinkler' },
      { stage: 'Pod fill (70-80 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow or sprinkler' },
    ],
    commonPests: [
      { pest: 'Pod borer (H. armigera)', pestHi: 'हेलिकोवर्पा इल्ली', season: 'rabi', solution: 'Emamectin Benzoate 5SG @ 0.4g/L + pheromone traps @ 5/acre from 40 DAS' },
    ],
    commonDiseases: [
      { disease: 'Fusarium Wilt', diseaseHi: 'फ्यूजेरियम म्लान', symptoms: 'Sudden wilting of plants, roots show brown discoloration', solution: 'Resistant variety + Trichoderma viride 5g/kg seed treatment' },
      { disease: 'Botrytis Grey Mold', diseaseHi: 'बॉट्रिटिस ग्रे मोल्ड', symptoms: 'Grayish-brown fluffy mold on flowers/pods in cool humid weather', solution: 'Iprodione 50WP @ 2g/L spray. Avoid dense canopy.' },
    ],
    harvestIndicators: ['80% pods brown', 'Rattling sound in pods', 'Moisture 12-14%'],
    mspCommodityCode: 'GRAM', agmarknetCode: 'Gram',
  },
  {
    name: 'maize', nameHi: 'मक्का', nameMr: 'मका',
    category: 'cereal', seasons: ['kharif', 'rabi', 'zaid'], maturityDays: 110,
    kcInitial: 0.3, kcMid: 1.2, kcLate: 0.6,
    seedRate: { value: 8, unit: 'kg/acre (hybrid)' },
    spacing: { rowToRow: '60 cm', plantToPlant: '25 cm' },
    varieties: [
      { name: 'DKC 9144', suitableRegions: ['Maharashtra'], maturityDays: 110, yieldPerAcre: '25-35 q' },
      { name: 'NK 6240', suitableRegions: ['Vidarbha', 'Marathwada'], maturityDays: 105, yieldPerAcre: '22-30 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 50, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 33, unit: 'kg' }] },
      { stage: 'Knee-height (30 DAS)', stageDays: 30, fertilizers: [{ name: 'Urea', quantityPerAcre: 40, unit: 'kg' }] },
      { stage: 'Tasseling (50-55 DAS)', stageDays: 52, fertilizers: [{ name: 'Urea', quantityPerAcre: 35, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Germination (0-10 DAS)', criticalPeriod: true, waterRequirement: '30mm', method: 'furrow or sprinkler' },
      { stage: 'Knee height (25-30 DAS)', criticalPeriod: true, waterRequirement: '50mm', method: 'furrow' },
      { stage: 'Tasseling (50-55 DAS)', criticalPeriod: true, waterRequirement: '60mm', method: 'furrow' },
      { stage: 'Grain fill (70-90 DAS)', criticalPeriod: true, waterRequirement: '50mm every 7-8 days', method: 'furrow' },
    ],
    commonPests: [
      { pest: 'Fall Armyworm', pestHi: 'फॉल आर्मीवर्म', season: 'kharif', solution: 'Emamectin Benzoate 5SG @ 0.4g/L or Chlorantraniliprole 18.5SC @ 0.4ml/L. Apply into leaf whorl.' },
      { pest: 'Stem borer', pestHi: 'तना भेदक', season: 'kharif', solution: 'Carbofuran 3G @ 6kg/acre in whorl at 15 and 30 DAS' },
    ],
    commonDiseases: [
      { disease: 'Turcicum Leaf Blight', diseaseHi: 'टर्सिकम पत्ती झुलसा', symptoms: 'Long elliptical grayish lesions on leaves', solution: 'Mancozeb 75WP @ 2.5g/L spray at early infection' },
    ],
    harvestIndicators: ['Black layer at kernel base', 'Husk brown and dry', 'Moisture 25-30% at harvest, dry to 12%'],
    mspCommodityCode: 'MAIZE', agmarknetCode: 'Maize',
  },
  {
    name: 'groundnut', nameHi: 'मूंगफली', nameMr: 'भुईमूग',
    category: 'oilseed', seasons: ['kharif', 'rabi'], maturityDays: 110,
    kcInitial: 0.4, kcMid: 1.0, kcLate: 0.6,
    seedRate: { value: 50, unit: 'kg/acre (pods)' },
    spacing: { rowToRow: '30 cm', plantToPlant: '10 cm' },
    varieties: [
      { name: 'TAG 24', suitableRegions: ['Konkan', 'Western Maharashtra'], maturityDays: 100, yieldPerAcre: '10-14 q' },
      { name: 'ICGV 91114', suitableRegions: ['Maharashtra'], maturityDays: 110, yieldPerAcre: '12-16 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'SSP', quantityPerAcre: 100, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 25, unit: 'kg' }, { name: 'Gypsum', quantityPerAcre: 100, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Germination', criticalPeriod: false, waterRequirement: '30mm', method: 'light flood' },
      { stage: 'Pegging (30-40 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow or sprinkler' },
      { stage: 'Pod fill (60-80 DAS)', criticalPeriod: true, waterRequirement: '50mm every 8-10 days', method: 'furrow' },
    ],
    commonPests: [
      { pest: 'Leaf miner', pestHi: 'पत्ती सुरंग मक्खी', season: 'kharif', solution: 'Neem oil 1500ppm @ 5ml/L spray + triazophos 40EC @ 2ml/L' },
    ],
    commonDiseases: [
      { disease: 'Tikka Leaf Spot', diseaseHi: 'टिक्का पत्ती धब्बा', symptoms: 'Small necrotic spots with yellow halo on leaves', solution: 'Mancozeb 75WP @ 2.5g/L + Chlorothalonil 75WP @ 2g/L spray every 10 days from 30 DAS' },
      { disease: 'Collar Rot', diseaseHi: 'कॉलर रॉट', symptoms: 'Water-soaked lesion at collar region, plant collapse', solution: 'Thiram 75WP seed treatment @ 3g/kg seed + Carbendazim soil drench' },
    ],
    harvestIndicators: ['Inner shell reticulation visible', '80% pods with dark inner surface', 'Vein network on pod shell prominent'],
    mspCommodityCode: 'GROUNDNUT', agmarknetCode: 'Groundnut',
  },
  {
    name: 'sugarcane', nameHi: 'गन्ना', nameMr: 'ऊस',
    category: 'cash_crop', seasons: ['kharif', 'rabi'], maturityDays: 360,
    kcInitial: 0.4, kcMid: 1.25, kcLate: 0.75,
    seedRate: { value: 2500, unit: 'kg/acre (setts)' },
    spacing: { rowToRow: '90 cm', plantToPlant: '30-45 cm (paired row)' },
    varieties: [
      { name: 'Co 86032', suitableRegions: ['Pune', 'Kolhapur', 'Sangli'], maturityDays: 360, yieldPerAcre: '300-400 q' },
      { name: 'MS 10001', suitableRegions: ['Marathwada', 'Vidarbha'], maturityDays: 365, yieldPerAcre: '280-380 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal (at planting)', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 100, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 60, unit: 'kg' }] },
      { stage: '60 days', stageDays: 60, fertilizers: [{ name: 'Urea', quantityPerAcre: 55, unit: 'kg' }] },
      { stage: '120 days', stageDays: 120, fertilizers: [{ name: 'Urea', quantityPerAcre: 55, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 30, unit: 'kg' }] },
      { stage: '180 days', stageDays: 180, fertilizers: [{ name: 'Urea', quantityPerAcre: 40, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Germination (0-30 days)', criticalPeriod: true, waterRequirement: '60mm every 7 days', method: 'flood or drip' },
      { stage: 'Grand growth (90-240 days)', criticalPeriod: true, waterRequirement: '80mm every 10 days', method: 'drip preferred' },
    ],
    commonPests: [
      { pest: 'Early shoot borer', pestHi: 'प्रारंभिक टहनी भेदक', season: 'kharif', solution: 'Chlorpyrifos 20EC @ 400ml/acre soil drench at 30 days' },
      { pest: 'Woolly aphid', pestHi: 'ऊनी माहू', season: 'kharif', solution: 'Dimethoate 30EC @ 2ml/L spray on infested shoots' },
    ],
    commonDiseases: [
      { disease: 'Red Rot', diseaseHi: 'लाल सड़न', symptoms: 'Internal red discoloration of stalk, sour smell', solution: 'Use disease-free seed material + Carbendazim 50WP sett treatment' },
      { disease: 'Smut', diseaseHi: 'काली फफूंद (कांडखोड)', symptoms: 'Long black whip-like structure emerging from growing point', solution: 'Uproot and destroy infected plants. Use resistant variety.' },
    ],
    harvestIndicators: ['Brix > 18%', '12-14 months after planting', 'Tops dry, rind hard'],
    mspCommodityCode: 'SUGARCANE', agmarknetCode: 'Sugarcane',
  },
  {
    name: 'jowar', nameHi: 'ज्वार', nameMr: 'ज्वारी',
    category: 'cereal', seasons: ['kharif', 'rabi'], maturityDays: 110,
    kcInitial: 0.35, kcMid: 1.0, kcLate: 0.55,
    seedRate: { value: 5, unit: 'kg/acre (hybrid)' },
    spacing: { rowToRow: '45 cm', plantToPlant: '15 cm' },
    varieties: [
      { name: 'CSH 16', suitableRegions: ['Marathwada', 'Vidarbha'], maturityDays: 105, yieldPerAcre: '15-20 q' },
      { name: 'SPV 462', suitableRegions: ['Solapur', 'Latur'], maturityDays: 115, yieldPerAcre: '12-16 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 50, unit: 'kg' }] },
      { stage: 'Knee height (30 DAS)', stageDays: 30, fertilizers: [{ name: 'Urea', quantityPerAcre: 30, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Germination', criticalPeriod: false, waterRequirement: '30mm', method: 'light irrigation' },
      { stage: 'Panicle initiation (60-65 DAS)', criticalPeriod: true, waterRequirement: '50mm', method: 'furrow' },
      { stage: 'Grain fill (80-90 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow' },
    ],
    commonPests: [
      { pest: 'Shoot fly', pestHi: 'तना मक्खी', season: 'kharif', solution: 'Imidacloprid 600FS seed treatment @ 3ml/kg seed. Carbofuran 3G @ 4kg/acre in whorl.' },
      { pest: 'Stem borer', pestHi: 'तना भेदक', season: 'kharif', solution: 'Chlorpyrifos 20EC @ 2ml/L whorl spray at 25-30 DAS' },
    ],
    commonDiseases: [
      { disease: 'Grain Smut', diseaseHi: 'दाना कोड़ (अनाज काला)', symptoms: 'Grain heads replaced by black smut balls', solution: 'Carboxin 75WP seed treatment @ 2g/kg seed' },
      { disease: 'Charcoal Rot', diseaseHi: 'चारकोल सड़न', symptoms: 'Grey shredded pith in stalk, plant lodging', solution: 'Avoid moisture stress at grain fill. Thiram seed treatment.' },
    ],
    harvestIndicators: ['Grains hard (thumb nail test)', 'Panicle turns brown', 'Moisture 12-14%'],
    mspCommodityCode: 'JOWAR', agmarknetCode: 'Jowar',
  },
  {
    name: 'bajra', nameHi: 'बाजरा', nameMr: 'बाजरी',
    category: 'cereal', seasons: ['kharif'], maturityDays: 80,
    kcInitial: 0.35, kcMid: 1.0, kcLate: 0.55,
    seedRate: { value: 2, unit: 'kg/acre (hybrid)' },
    spacing: { rowToRow: '45 cm', plantToPlant: '15 cm' },
    varieties: [
      { name: 'HHB 67 Improved', suitableRegions: ['Maharashtra'], maturityDays: 78, yieldPerAcre: '10-14 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 50, unit: 'kg' }] },
      { stage: '25 DAS', stageDays: 25, fertilizers: [{ name: 'Urea', quantityPerAcre: 25, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Germination', criticalPeriod: false, waterRequirement: '25mm', method: 'light flood' },
      { stage: 'Panicle initiation (35-40 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow' },
    ],
    commonPests: [
      { pest: 'Shoot fly', pestHi: 'तना मक्खी', season: 'kharif', solution: 'Imidacloprid 600FS seed treatment @ 3ml/kg seed' },
    ],
    commonDiseases: [
      { disease: 'Downy Mildew (Grassy shoot)', diseaseHi: 'अंगारा रोग (हरित बाल)', symptoms: 'Pale green streaking on leaves, excessive tillering ("Crazy Top")', solution: 'Metalaxyl 8% + Mancozeb 64% WP @ 2g/kg seed treatment' },
    ],
    harvestIndicators: ['Grain hard', 'Earhead turns brown', 'Moisture 12-15%'],
    mspCommodityCode: 'BAJRA', agmarknetCode: 'Bajra',
  },
  {
    name: 'sunflower', nameHi: 'सूरजमुखी', nameMr: 'सूर्यफूल',
    category: 'oilseed', seasons: ['kharif', 'rabi', 'zaid'], maturityDays: 95,
    kcInitial: 0.35, kcMid: 1.1, kcLate: 0.7,
    seedRate: { value: 2, unit: 'kg/acre (hybrid)' },
    spacing: { rowToRow: '60 cm', plantToPlant: '30 cm' },
    varieties: [
      { name: 'MSFH 8', suitableRegions: ['Maharashtra'], maturityDays: 90, yieldPerAcre: '5-8 q' },
      { name: 'Hysun 33', suitableRegions: ['Maharashtra'], maturityDays: 95, yieldPerAcre: '6-9 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Basal', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 50, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 33, unit: 'kg' }] },
      { stage: '30 DAS', stageDays: 30, fertilizers: [{ name: 'Urea', quantityPerAcre: 25, unit: 'kg' }] },
    ],
    irrigationSchedule: [
      { stage: 'Germination', criticalPeriod: false, waterRequirement: '25mm', method: 'sprinkler' },
      { stage: 'Flower bud (50-55 DAS)', criticalPeriod: true, waterRequirement: '50mm', method: 'furrow' },
      { stage: 'Grain fill (70-80 DAS)', criticalPeriod: true, waterRequirement: '40mm', method: 'furrow' },
    ],
    commonPests: [
      { pest: 'Capitulum borer', pestHi: 'शीर्ष छेदक', season: 'all', solution: 'Carbaryl 50WP @ 3g/L spray at head formation' },
    ],
    commonDiseases: [
      { disease: 'Alternaria Leaf Blight', diseaseHi: 'अल्टरनेरिया पत्ती झुलसा', symptoms: 'Small brown circular spots with yellow halo', solution: 'Mancozeb 75WP @ 2.5g/L spray every 10 days from 30 DAS' },
    ],
    harvestIndicators: ['Back of head turns brown/yellow', 'Seeds hard and plump', 'Moisture 10-12%'],
    mspCommodityCode: 'SUNFLOWER', agmarknetCode: 'Sunflower Seed',
  },
  {
    name: 'pomegranate', nameHi: 'अनार', nameMr: 'डाळिंब',
    category: 'fruit', seasons: ['kharif', 'rabi', 'zaid'], maturityDays: 180,
    kcInitial: 0.5, kcMid: 0.85, kcLate: 0.7,
    seedRate: { value: 0, unit: 'N/A — transplanted from cuttings' },
    spacing: { rowToRow: '4.5 m', plantToPlant: '3 m (high density: 2.5×1.8m)' },
    varieties: [
      { name: 'Bhagwa', suitableRegions: ['Solapur', 'Sangli', 'Nashik'], maturityDays: 180, yieldPerAcre: '80-120 q (mature orchard)' },
      { name: 'Mridula', suitableRegions: ['Maharashtra'], maturityDays: 175, yieldPerAcre: '60-100 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Before bahar treatment', stageDays: 0, fertilizers: [{ name: 'FYM', quantityPerAcre: 4000, unit: 'kg' }, { name: 'DAP', quantityPerAcre: 30, unit: 'kg' }] },
      { stage: '60 days after bahar', stageDays: 60, fertilizers: [{ name: 'Urea', quantityPerAcre: 20, unit: 'kg' }, { name: '0:52:34', quantityPerAcre: 3, unit: 'kg (fertigation)' }] },
    ],
    irrigationSchedule: [
      { stage: 'Stress period (pre-bahar)', criticalPeriod: true, waterRequirement: 'withhold for 60 days to induce dormancy', method: 'no irrigation' },
      { stage: 'After bahar treatment', criticalPeriod: true, waterRequirement: '40-50mm every 5-7 days', method: 'drip (mandatory)' },
      { stage: 'Fruit development (60-150 days)', criticalPeriod: true, waterRequirement: '40mm every 4-5 days', method: 'drip' },
    ],
    commonPests: [
      { pest: 'Pomegranate Butterfly / Fruit borer', pestHi: 'अनार तितली', season: 'all', solution: 'Deltamethrin 2.8EC @ 1ml/L + bag fruits at pea stage. Pheromone traps @ 5/acre.' },
      { pest: 'Thrips', pestHi: 'थ्रिप्स', season: 'all', solution: 'Spinosad 45SC @ 0.3ml/L at fruit set. Repeat after 15 days.' },
    ],
    commonDiseases: [
      { disease: 'Bacterial Blight (Oily Spot)', diseaseHi: 'जीवाणु झुलसा', symptoms: 'Water-soaked oily spots on fruit rind, dark lesions on leaves/shoots', solution: 'Copper oxychloride 50WP @ 3g/L spray. Remove infected shoots. Avoid overhead irrigation.' },
      { disease: 'Cercospora Fruit Spot', diseaseHi: 'सर्कोस्पोरा फल धब्बा', symptoms: 'Circular brown spots on fruit', solution: 'Carbendazim 50WP @ 1g/L + Mancozeb 75WP @ 2g/L spray' },
    ],
    harvestIndicators: ['Fruit skin turns pink-red', 'Metallic sound on tapping', '135-175 days after fruit set'],
    mspCommodityCode: 'POMEGRANATE', agmarknetCode: 'Pomegranate',
  },
  {
    name: 'grapes', nameHi: 'अंगूर', nameMr: 'द्राक्षे',
    category: 'fruit', seasons: ['rabi', 'zaid'], maturityDays: 150,
    kcInitial: 0.3, kcMid: 0.85, kcLate: 0.45,
    seedRate: { value: 0, unit: 'N/A — planted from cuttings/grafts' },
    spacing: { rowToRow: '3 m', plantToPlant: '1.5 m (trellis system)' },
    varieties: [
      { name: 'Thompson Seedless', suitableRegions: ['Nashik', 'Sangli', 'Pune'], maturityDays: 150, yieldPerAcre: '100-150 q (mature vineyard)' },
      { name: 'Sharad Seedless', suitableRegions: ['Nashik', 'Pune'], maturityDays: 145, yieldPerAcre: '120-180 q' },
    ],
    fertilizerSchedule: [
      { stage: 'Pruning (Oct/Nov)', stageDays: 0, fertilizers: [{ name: 'DAP', quantityPerAcre: 60, unit: 'kg' }, { name: 'MOP', quantityPerAcre: 60, unit: 'kg' }, { name: 'FYM', quantityPerAcre: 2000, unit: 'kg' }] },
      { stage: 'Shoot growth (30-60 days)', stageDays: 45, fertilizers: [{ name: 'Urea', quantityPerAcre: 20, unit: 'kg (fertigation)' }] },
      { stage: 'Fruit set (90-120 days)', stageDays: 100, fertilizers: [{ name: '0:52:34', quantityPerAcre: 5, unit: 'kg (fertigation)' }] },
    ],
    irrigationSchedule: [
      { stage: 'After pruning (establishment)', criticalPeriod: true, waterRequirement: '50mm every 5-7 days', method: 'drip (mandatory)' },
      { stage: 'Berry development (60-120 days)', criticalPeriod: true, waterRequirement: '40-50mm every 4-5 days', method: 'drip' },
      { stage: 'Ripening (120-150 days)', criticalPeriod: false, waterRequirement: 'reduce water for colour/sugar development', method: 'drip — reduce frequency' },
    ],
    commonPests: [
      { pest: 'Thrips', pestHi: 'थ्रिप्स', season: 'all', solution: 'Spinosad 45SC @ 0.3ml/L or Abamectin 1.9EC @ 0.5ml/L at berry formation' },
      { pest: 'Mealy bug', pestHi: 'माइली बग', season: 'all', solution: 'Profenofos 50EC @ 2ml/L spray on bunches + trunk banding with sticky tape' },
    ],
    commonDiseases: [
      { disease: 'Downy Mildew', diseaseHi: 'मृदु रोमिल फफूंद', symptoms: 'White fluffy mass on underside of leaves, oil spots on top surface', solution: 'Metalaxyl 8% + Mancozeb 64% WP @ 2.5g/L spray every 7-10 days in humid weather' },
      { disease: 'Powdery Mildew', diseaseHi: 'चूर्णिल फफूंद', symptoms: 'White powdery coating on leaves, shoots, and berries', solution: 'Wettable Sulphur 80WP @ 3g/L or Triadimefon 25WP @ 0.5g/L spray' },
    ],
    harvestIndicators: ['TSS > 20% Brix', 'Colour fully developed', 'Easy berry detachment from bunch'],
    mspCommodityCode: 'GRAPES', agmarknetCode: 'Grapes',
  },
];

async function main() {
  console.log('Seeding crop master data (15 Maharashtra crops)...');
  let created = 0;
  let skipped = 0;

  for (const crop of crops) {
    const result = await prisma.cropMaster.upsert({
      where:  { name: crop.name },
      create: crop,
      update: crop,
    });
    console.log(`  ✓ ${result.nameHi} (${result.name})`);
    created++;
  }

  console.log(`\nDone! ${created} crops seeded, ${skipped} skipped.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
