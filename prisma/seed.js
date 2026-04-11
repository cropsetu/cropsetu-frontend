/**
 * Seed script — run with:  node prisma/seed.js
 * Idempotent: skips categories that already exist (upsert on name).
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  {
    name: 'Seeds & Planting Material',
    nameHi: 'बीज एवं रोपण सामग्री',
    nameMr: 'बियाणे आणि लागवड साहित्य',
    icon: 'leaf',
    color: '#388E3C',
    sortOrder: 1,
  },
  {
    name: 'Fertilizers & Soil Nutrition',
    nameHi: 'उर्वरक एवं मृदा पोषण',
    nameMr: 'खते आणि मातीचे पोषण',
    icon: 'nutrition',
    color: '#2E7D32',
    sortOrder: 2,
  },
  {
    name: 'Crop Protection',
    nameHi: 'फसल सुरक्षा',
    nameMr: 'पीक संरक्षण',
    icon: 'bug',
    color: '#C62828',
    sortOrder: 3,
  },
  {
    name: 'Irrigation & Water Management',
    nameHi: 'सिंचाई एवं जल प्रबंधन',
    nameMr: 'सिंचन आणि पाणी व्यवस्थापन',
    icon: 'water',
    color: '#0277BD',
    sortOrder: 4,
  },
  {
    name: 'Farm Machinery & Equipment',
    nameHi: 'कृषि यंत्र एवं उपकरण',
    nameMr: 'शेती यंत्रे आणि उपकरणे',
    icon: 'car',
    color: '#BF360C',
    sortOrder: 5,
  },
  {
    name: 'Hand Tools & Small Equipment',
    nameHi: 'हाथ उपकरण',
    nameMr: 'हाताची अवजारे',
    icon: 'construct',
    color: '#4E342E',
    sortOrder: 6,
  },
  {
    name: 'Protected Cultivation & Structures',
    nameHi: 'संरक्षित खेती',
    nameMr: 'संरक्षित शेती',
    icon: 'home',
    color: '#00695C',
    sortOrder: 7,
  },
  {
    name: 'Fencing & Farm Protection',
    nameHi: 'बाड़बंदी एवं संरक्षण',
    nameMr: 'कुंपण आणि संरक्षण',
    icon: 'shield',
    color: '#37474F',
    sortOrder: 8,
  },
  {
    name: 'Storage & Packaging',
    nameHi: 'भंडारण एवं पैकेजिंग',
    nameMr: 'साठवण आणि पॅकेजिंग',
    icon: 'archive',
    color: '#6A1B9A',
    sortOrder: 9,
  },
  {
    name: 'Livestock, Dairy & Poultry',
    nameHi: 'पशुपालन, डेयरी एवं मुर्गीपालन',
    nameMr: 'पशुधन, दुग्धव्यवसाय आणि कुक्कुटपालन',
    icon: 'paw',
    color: '#E65100',
    sortOrder: 10,
  },
  {
    name: 'Safety & Protective Gear',
    nameHi: 'सुरक्षा एवं संरक्षक वस्त्र',
    nameMr: 'सुरक्षा आणि संरक्षक कपडे',
    icon: 'warning',
    color: '#F57F17',
    sortOrder: 11,
  },
  {
    name: 'Solar & Energy',
    nameHi: 'सौर एवं ऊर्जा',
    nameMr: 'सौर आणि ऊर्जा',
    icon: 'sunny',
    color: '#F9A825',
    sortOrder: 12,
  },
  {
    name: 'Farm Infrastructure & Construction',
    nameHi: 'कृषि अवसंरचना एवं निर्माण',
    nameMr: 'शेती बांधकाम साहित्य',
    icon: 'business',
    color: '#546E7A',
    sortOrder: 13,
  },
  {
    name: 'Farm Technology & Smart Farming',
    nameHi: 'स्मार्ट खेती तकनीक',
    nameMr: 'स्मार्ट शेती तंत्रज्ञान',
    icon: 'hardware-chip',
    color: '#1565C0',
    sortOrder: 14,
  },
  {
    name: 'Organic & Natural Farming',
    nameHi: 'जैविक एवं प्राकृतिक खेती सामग्री',
    nameMr: 'सेंद्रिय शेती साहित्य',
    icon: 'eco',
    color: '#558B2F',
    sortOrder: 15,
  },
  {
    name: 'Books, Education & Services',
    nameHi: 'पुस्तकें, शिक्षा एवं सेवाएं',
    nameMr: 'पुस्तके, शिक्षण आणि सेवा',
    icon: 'book',
    color: '#455A64',
    sortOrder: 16,
  },
  {
    name: 'Miscellaneous Farm Supplies',
    nameHi: 'विविध कृषि सामग्री',
    nameMr: 'इतर शेती साहित्य',
    icon: 'apps',
    color: '#78909C',
    sortOrder: 17,
  },
];

async function main() {
  // Deactivate any old categories no longer in the canonical list
  const newNames = CATEGORIES.map(c => c.name);
  const deactivated = await prisma.category.updateMany({
    where: { name: { notIn: newNames } },
    data:  { isActive: false },
  });
  if (deactivated.count > 0) {
    console.log(` ⚠ Deactivated ${deactivated.count} legacy categories`);
  }

  console.log('Seeding categories…');
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where:  { name: cat.name },
      update: { nameHi: cat.nameHi, nameMr: cat.nameMr, icon: cat.icon, color: cat.color, sortOrder: cat.sortOrder, isActive: true },
      create: { ...cat, isActive: true },
    });
    console.log(' ✓', cat.name);
  }
  console.log('Done —', CATEGORIES.length, 'categories ready.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
