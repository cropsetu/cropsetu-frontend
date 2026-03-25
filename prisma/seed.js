/**
 * Seed script — run with:  node prisma/seed.js
 * Idempotent: skips categories that already exist.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: 'Fertilizers',    nameHi: 'उर्वरक',          nameMr: 'खते',                icon: 'leaf',      color: '#2E7D32', sortOrder: 1  },
  { name: 'Seeds',          nameHi: 'बीज',             nameMr: 'बियाणे',             icon: 'seed',      color: '#F57F17', sortOrder: 2  },
  { name: 'Pesticides',     nameHi: 'कीटनाशक',        nameMr: 'कीटकनाशक',           icon: 'bug',       color: '#C62828', sortOrder: 3  },
  { name: 'Herbicides',     nameHi: 'खरपतवार नाशक',   nameMr: 'तणनाशक',             icon: 'grass',     color: '#558B2F', sortOrder: 4  },
  { name: 'Fungicides',     nameHi: 'फफूंदनाशक',      nameMr: 'बुरशीनाशक',          icon: 'flask',     color: '#6A1B9A', sortOrder: 5  },
  { name: 'Micronutrients', nameHi: 'सूक्ष्म पोषक',    nameMr: 'सूक्ष्म अन्नद्रव्ये', icon: 'nutrition', color: '#00838F', sortOrder: 6  },
  { name: 'Irrigation',     nameHi: 'सिंचाई',          nameMr: 'सिंचन',              icon: 'water',     color: '#0277BD', sortOrder: 7  },
  { name: 'Farm Tools',     nameHi: 'कृषि उपकरण',     nameMr: 'शेती अवजारे',        icon: 'tools',     color: '#4E342E', sortOrder: 8  },
  { name: 'Soil Treatment', nameHi: 'मिट्टी उपचार',   nameMr: 'माती उपचार',         icon: 'landscape', color: '#795548', sortOrder: 9  },
  { name: 'Bio Products',   nameHi: 'जैव उत्पाद',      nameMr: 'जैव उत्पादने',       icon: 'eco',       color: '#388E3C', sortOrder: 10 },
];

async function main() {
  console.log('Seeding categories…');
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where:  { name: cat.name },
      update: {},
      create: { ...cat, isActive: true },
    });
    console.log(' v', cat.name);
  }
  console.log('Done —', CATEGORIES.length, 'categories ready.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
