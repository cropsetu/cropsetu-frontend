/**
 * MSP Rates Seed — Kharif 2025 + Rabi 2025-26
 * Source: CACP / Ministry of Agriculture & Farmers Welfare, GoI
 *
 * Run: node prisma/seed-msp.js
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const kharif2025 = [
  { commodity: 'Rice (Common)', commodityHi: 'धान (सामान्य)', season: 'kharif', year: '2025-26', mspPrice: 2300, previousYearMSP: 2183, increasePercent: 5.4, procurementAgency: 'FCI / State agencies', procurementStartDate: new Date('2025-10-01'), procurementEndDate: new Date('2026-03-31') },
  { commodity: 'Rice (Grade A)', commodityHi: 'धान (ग्रेड A)', season: 'kharif', year: '2025-26', mspPrice: 2320, previousYearMSP: 2203, increasePercent: 5.3, procurementAgency: 'FCI / State agencies', procurementStartDate: new Date('2025-10-01'), procurementEndDate: new Date('2026-03-31') },
  { commodity: 'Jowar (Hybrid)', commodityHi: 'ज्वार (हाइब्रिड)', season: 'kharif', year: '2025-26', mspPrice: 3371, previousYearMSP: 3180, increasePercent: 6.0, procurementAgency: 'NAFED / State agencies' },
  { commodity: 'Jowar (Maldandi)', commodityHi: 'ज्वार (मालदांडी)', season: 'kharif', year: '2025-26', mspPrice: 3421, previousYearMSP: 3225, increasePercent: 6.1, procurementAgency: 'NAFED / State agencies' },
  { commodity: 'Bajra', commodityHi: 'बाजरा', season: 'kharif', year: '2025-26', mspPrice: 2625, previousYearMSP: 2500, increasePercent: 5.0, procurementAgency: 'NAFED / State agencies' },
  { commodity: 'Maize', commodityHi: 'मक्का', season: 'kharif', year: '2025-26', mspPrice: 2225, previousYearMSP: 2090, increasePercent: 6.5, procurementAgency: 'NAFED / State agencies' },
  { commodity: 'Tur (Arhar)', commodityHi: 'तुअर (अरहर)', season: 'kharif', year: '2025-26', mspPrice: 7550, previousYearMSP: 7000, increasePercent: 7.9, procurementAgency: 'NAFED', procurementStartDate: new Date('2025-11-01'), procurementEndDate: new Date('2026-04-30') },
  { commodity: 'Moong', commodityHi: 'मूंग', season: 'kharif', year: '2025-26', mspPrice: 8682, previousYearMSP: 8558, increasePercent: 1.4, procurementAgency: 'NAFED' },
  { commodity: 'Urad', commodityHi: 'उड़द', season: 'kharif', year: '2025-26', mspPrice: 7400, previousYearMSP: 7400, increasePercent: 0.0, procurementAgency: 'NAFED' },
  { commodity: 'Groundnut', commodityHi: 'मूंगफली', season: 'kharif', year: '2025-26', mspPrice: 6783, previousYearMSP: 6377, increasePercent: 6.4, procurementAgency: 'NAFED', procurementStartDate: new Date('2025-10-01'), procurementEndDate: new Date('2026-03-31') },
  { commodity: 'Sunflower Seed', commodityHi: 'सूरजमुखी बीज', season: 'kharif', year: '2025-26', mspPrice: 7280, previousYearMSP: 6760, increasePercent: 7.7, procurementAgency: 'NAFED' },
  { commodity: 'Soybean (Yellow)', commodityHi: 'सोयाबीन (पीला)', season: 'kharif', year: '2025-26', mspPrice: 4892, previousYearMSP: 4600, increasePercent: 6.3, procurementAgency: 'NAFED', procurementStartDate: new Date('2025-10-15'), procurementEndDate: new Date('2026-03-31') },
  { commodity: 'Sesame', commodityHi: 'तिल', season: 'kharif', year: '2025-26', mspPrice: 9267, previousYearMSP: 8635, increasePercent: 7.3, procurementAgency: 'NAFED' },
  { commodity: 'Niger Seed', commodityHi: 'रामतिल', season: 'kharif', year: '2025-26', mspPrice: 8717, previousYearMSP: 7734, increasePercent: 12.7, procurementAgency: 'TRIFED' },
  { commodity: 'Cotton (Medium Staple)', commodityHi: 'कपास (मध्यम रेशा)', season: 'kharif', year: '2025-26', mspPrice: 7121, previousYearMSP: 6620, increasePercent: 7.6, procurementAgency: 'CCI', procurementStartDate: new Date('2025-10-01'), procurementEndDate: new Date('2026-03-31') },
  { commodity: 'Cotton (Long Staple)', commodityHi: 'कपास (लंबा रेशा)', season: 'kharif', year: '2025-26', mspPrice: 7521, previousYearMSP: 7020, increasePercent: 7.1, procurementAgency: 'CCI', procurementStartDate: new Date('2025-10-01'), procurementEndDate: new Date('2026-03-31') },
];

const rabi202526 = [
  { commodity: 'Wheat', commodityHi: 'गेहूँ', season: 'rabi', year: '2025-26', mspPrice: 2425, previousYearMSP: 2275, increasePercent: 6.6, procurementAgency: 'FCI / State agencies', procurementStartDate: new Date('2026-04-01'), procurementEndDate: new Date('2026-06-30') },
  { commodity: 'Barley', commodityHi: 'जौ', season: 'rabi', year: '2025-26', mspPrice: 1975, previousYearMSP: 1735, increasePercent: 13.8, procurementAgency: 'NAFED' },
  { commodity: 'Gram (Chana)', commodityHi: 'चना (हरभरा)', season: 'rabi', year: '2025-26', mspPrice: 5650, previousYearMSP: 5440, increasePercent: 3.9, procurementAgency: 'NAFED', procurementStartDate: new Date('2026-03-01'), procurementEndDate: new Date('2026-06-30') },
  { commodity: 'Masur (Lentil)', commodityHi: 'मसूर', season: 'rabi', year: '2025-26', mspPrice: 6700, previousYearMSP: 6425, increasePercent: 4.3, procurementAgency: 'NAFED' },
  { commodity: 'Rapeseed/Mustard', commodityHi: 'सरसों', season: 'rabi', year: '2025-26', mspPrice: 5950, previousYearMSP: 5650, increasePercent: 5.3, procurementAgency: 'NAFED', procurementStartDate: new Date('2026-03-01'), procurementEndDate: new Date('2026-05-31') },
  { commodity: 'Safflower', commodityHi: 'करडी (सूर्यफूल)', season: 'rabi', year: '2025-26', mspPrice: 5940, previousYearMSP: 5800, increasePercent: 2.4, procurementAgency: 'NAFED' },
];

async function main() {
  console.log('Seeding MSP rates...');
  const all = [...kharif2025, ...rabi202526];

  for (const rate of all) {
    await prisma.mSPRate.upsert({
      where: { commodity_season_year: { commodity: rate.commodity, season: rate.season, year: rate.year } },
      create: rate,
      update: { mspPrice: rate.mspPrice, previousYearMSP: rate.previousYearMSP, increasePercent: rate.increasePercent, procurementAgency: rate.procurementAgency, procurementStartDate: rate.procurementStartDate, procurementEndDate: rate.procurementEndDate },
    });
    console.log(`  ✓ ${rate.commodityHi} — ₹${rate.mspPrice}/q (${rate.season} ${rate.year})`);
  }

  console.log(`\nDone! ${all.length} MSP rates seeded.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
