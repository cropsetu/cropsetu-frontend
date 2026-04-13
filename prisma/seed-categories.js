/**
 * Seed AgriStore categories — comprehensive agriculture category tree
 * Inspired by BigHaat, Bayer, UPL and Indian agri retail structures.
 *
 * Run: node prisma/seed-categories.js
 */
import prisma from '../src/config/db.js';

const CATEGORIES = [
  {
    name: 'Seeds & Planting Material',
    nameHi: 'बीज एवं रोपण सामग्री',
    nameMr: 'बियाणे व लागवड साहित्य',
    icon: 'leaf',
    color: '#2E7D32',
    sortOrder: 1,
  },
  {
    name: 'Fertilizers & Soil Nutrition',
    nameHi: 'उर्वरक एवं मृदा पोषण',
    nameMr: 'खते व मृदा पोषण',
    icon: 'flask',
    color: '#1565C0',
    sortOrder: 2,
  },
  {
    name: 'Crop Protection',
    nameHi: 'फसल सुरक्षा',
    nameMr: 'पीक संरक्षण',
    icon: 'shield-checkmark',
    color: '#C62828',
    sortOrder: 3,
  },
  {
    name: 'Organic & Natural Farming',
    nameHi: 'जैविक एवं प्राकृतिक खेती',
    nameMr: 'सेंद्रिय व नैसर्गिक शेती',
    icon: 'flower',
    color: '#558B2F',
    sortOrder: 4,
  },
  {
    name: 'Plant Growth Regulators',
    nameHi: 'पादप वृद्धि नियामक',
    nameMr: 'वनस्पती वाढ नियंत्रक',
    icon: 'trending-up',
    color: '#6A1B9A',
    sortOrder: 5,
  },
  {
    name: 'Irrigation & Water Management',
    nameHi: 'सिंचाई एवं जल प्रबंधन',
    nameMr: 'सिंचन व जलव्यवस्थापन',
    icon: 'water',
    color: '#0277BD',
    sortOrder: 6,
  },
  {
    name: 'Farm Machinery & Equipment',
    nameHi: 'कृषि मशीनरी एवं उपकरण',
    nameMr: 'शेती यंत्रसामग्री',
    icon: 'settings',
    color: '#4E342E',
    sortOrder: 7,
  },
  {
    name: 'Hand Tools & Small Equipment',
    nameHi: 'हाथ के उपकरण',
    nameMr: 'हत्याराडे व छोटी साधने',
    icon: 'construct',
    color: '#E65100',
    sortOrder: 8,
  },
  {
    name: 'Protected Cultivation',
    nameHi: 'संरक्षित खेती',
    nameMr: 'संरक्षित शेती',
    icon: 'home',
    color: '#00695C',
    sortOrder: 9,
  },
  {
    name: 'Micronutrients & Specialty Nutrition',
    nameHi: 'सूक्ष्म पोषक तत्व',
    nameMr: 'सूक्ष्म अन्नद्रव्ये',
    icon: 'nutrition',
    color: '#F57F17',
    sortOrder: 10,
  },
  {
    name: 'Seeds Treatment & Additives',
    nameHi: 'बीज उपचार',
    nameMr: 'बीज प्रक्रिया',
    icon: 'color-wand',
    color: '#AD1457',
    sortOrder: 11,
  },
  {
    name: 'Livestock, Dairy & Poultry',
    nameHi: 'पशुपालन, डेयरी एवं मुर्गीपालन',
    nameMr: 'पशुपालन, दुग्धव्यवसाय व कुक्कुटपालन',
    icon: 'paw',
    color: '#795548',
    sortOrder: 12,
  },
  {
    name: 'Fencing & Farm Protection',
    nameHi: 'बाड़बंदी एवं सुरक्षा',
    nameMr: 'कुंपण व शेत संरक्षण',
    icon: 'git-network',
    color: '#37474F',
    sortOrder: 13,
  },
  {
    name: 'Storage & Packaging',
    nameHi: 'भंडारण एवं पैकेजिंग',
    nameMr: 'साठवण व पॅकेजिंग',
    icon: 'archive',
    color: '#5D4037',
    sortOrder: 14,
  },
  {
    name: 'Agri Technology & Smart Farming',
    nameHi: 'कृषि प्रौद्योगिकी',
    nameMr: 'कृषी तंत्रज्ञान',
    icon: 'hardware-chip',
    color: '#1A237E',
    sortOrder: 15,
  },
  {
    name: 'Solar & Energy',
    nameHi: 'सौर एवं ऊर्जा',
    nameMr: 'सौर व ऊर्जा',
    icon: 'sunny',
    color: '#F9A825',
    sortOrder: 16,
  },
  {
    name: 'Safety & Protective Gear',
    nameHi: 'सुरक्षा उपकरण',
    nameMr: 'सुरक्षा साधने',
    icon: 'medkit',
    color: '#B71C1C',
    sortOrder: 17,
  },
  {
    name: 'Spraying Equipment',
    nameHi: 'छिड़काव उपकरण',
    nameMr: 'फवारणी उपकरणे',
    icon: 'cloud',
    color: '#0097A7',
    sortOrder: 18,
  },
  {
    name: 'Harvesting & Post-Harvest',
    nameHi: 'कटाई एवं कटाई पश्चात',
    nameMr: 'काढणी व काढणीपश्चात',
    icon: 'cut',
    color: '#558B2F',
    sortOrder: 19,
  },
  {
    name: 'Aquaculture & Fisheries',
    nameHi: 'जलकृषि एवं मत्स्य पालन',
    nameMr: 'जलशेती व मत्स्यपालन',
    icon: 'fish',
    color: '#01579B',
    sortOrder: 20,
  },
  {
    name: 'Horticulture & Nursery',
    nameHi: 'बागवानी एवं नर्सरी',
    nameMr: 'फलोद्यान व रोपवाटिका',
    icon: 'rose',
    color: '#880E4F',
    sortOrder: 21,
  },
  {
    name: 'Agri Inputs for Home & Kitchen Garden',
    nameHi: 'गृह बागवानी सामग्री',
    nameMr: 'घर व किचन गार्डन साहित्य',
    icon: 'basket',
    color: '#33691E',
    sortOrder: 22,
  },
];

async function main() {
  console.log('Seeding categories...');
  let created = 0, skipped = 0;

  for (const cat of CATEGORIES) {
    const existing = await prisma.category.findUnique({ where: { name: cat.name } });
    if (existing) {
      // Update icon/color/translations if they changed
      await prisma.category.update({ where: { name: cat.name }, data: cat });
      skipped++;
    } else {
      await prisma.category.create({ data: cat });
      created++;
    }
  }

  console.log(`Done — created: ${created}, updated: ${skipped}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
