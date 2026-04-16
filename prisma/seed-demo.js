/**
 * Demo seed — adds realistic dummy data for all tabs.
 * Run with:  node prisma/seed-demo.js
 * Safe to re-run (skips rows that already exist via upsert/findFirst guard).
 *
 * SAFETY: Refuses to run in production to prevent demo data contamination.
 */
if (process.env.NODE_ENV === 'production') {
  console.error('[seed-demo] Refusing to run demo seed in production. Set NODE_ENV != production.');
  process.exit(1);
}

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Image URLs — all verified working (Pexels + Unsplash only, no Pixabay) ──
const P = (id) => `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&w=600`;

const IMG = {
  // ── Cows ────────────────────────────────────────────────────────────────────
  girCow:          P('30649600'),   // Brown cow with curved horns
  sahiwalCow:      'https://images.unsplash.com/photo-1600880292089-90a7e086ee0c?w=600&q=80',
  hfCow:           P('8637756'),    // Holstein Friesian black-white cow

  // ── Buffaloes ───────────────────────────────────────────────────────────────
  murrahBuffalo:   P('17647186'),   // Murrah buffalo

  // ── Goats & Sheep ──────────────────────────────────────────────────────────
  osmanabadi:      P('12035402'),   // Black goat close-up

  // ── Poultry ─────────────────────────────────────────────────────────────────
  broiler:         P('1769279'),    // Chicken / poultry
  kadaknath:       P('14654827'),   // Dark rooster

  // ── Machinery (Rent) ──────────────────────────────────────────────────────
  mahindraTractor: P('20327958'),   // Red Indian tractor in field
  johnDeere:       P('2889440'),    // Green tractor with sprayer
  harvester:       P('13239503'),   // Combine harvester on field
  rotavator:       P('10745253'),   // Tractor plowing / tilling soil
  droneSpray:      P('34182367'),   // Agricultural drone sprayer
  thresher:        P('9487554'),    // Farmers threshing rice crops

  // ── Labour ──────────────────────────────────────────────────────────────────
  farmWorkers:     P('12619953'),   // Farmers working in field
  sugarcaneWorker: P('9622885'),    // Man harvesting sugarcane
  vineyardWorker:  P('5529574'),    // Grape harvesting in vineyard

  // ── AgriStore: Seeds ──────────────────────────────────────────────────────
  wheatSeeds:      P('326082'),     // Wheat close-up
  riceSeeds:       P('247599'),     // Rice paddy scenic view
  tomatoSeeds:     P('1327838'),    // Tomatoes close-up
  onionSeeds:      P('4197447'),    // Onions
  cornSeeds:       P('547263'),     // Corn / maize

  // ── AgriStore: Fertilizers ────────────────────────────────────────────────
  dapBag:          P('3696170'),    // Earthworms in compost/soil (fertilizer context)
  ureaBag:         P('3696170'),    // Same compost context
  vermicompost:    P('3696170'),    // Earthworms on soil/compost

  // ── AgriStore: Crop Protection ──────────────────────────────────────────
  fungicide:       P('13882449'),   // Man spraying field with pesticides

  // ── AgriStore: Hand Tools ─────────────────────────────────────────────────
  khurpi:          P('4270181'),    // Hand tool
  sickle:          P('2252584'),    // Farm harvesting tool
  spade:           P('1301856'),    // Person digging with garden shovel

  // ── AgriStore: Farm Machinery Products ────────────────────────────────────
  seedDrill:       P('16407472'),   // Seed drill planting machine
  cultivator:      P('1325715'),    // Green cultivator farm implement
  plough:          P('4872437'),    // Traditional ploughing with oxen

  // ── AgriStore: Irrigation ─────────────────────────────────────────────────
  drip:            P('4750273'),    // Close-up watering/irrigation of plants
  sprinkler:       P('12887876'),   // Water sprinklers on green grass
  knapsack:        P('13882449'),   // Man spraying field (knapsack sprayer)

  // ── AgriStore: Solar & Energy ─────────────────────────────────────────────
  solarPump:       P('2800832'),    // Solar panels

  // ── AgriStore: Protected Cultivation ───────────────────────────────────────
  polyhouse:       P('2886937'),    // Plants in greenhouse

  // ── AgriStore: Smart Farming ──────────────────────────────────────────────
  soilSensor:      P('31374933'),   // Hands holding dark soil (soil testing)

  // ── AgriStore: Livestock supplies ─────────────────────────────────────────
  cattleFeed:      P('10759382'),   // Cow eating hay
  milkingMachine:  P('8064207'),    // Hands milking a cow
  chaff:           P('13218185'),   // Farmers gathering straw bales

  // ── Bullock cart / misc ───────────────────────────────────────────────────
  bullockCart:     P('11299267'),   // Farmer riding bullock cart
};

async function main() {
  console.log('\n  FarmEasy Demo Seed (v2 — Maharashtra Edition)\n');

  // ── 1. Seller users ────────────────────────────────────────────────────────
  console.log('Creating sellers...');
  const sellers = await Promise.all([
    prisma.user.upsert({
      where:  { phone: '9876543210' },
      update: {},
      create: {
        phone: '9876543210', name: 'Rajesh Patil',
        district: 'Nashik', taluka: 'Niphad', village: 'Vinchur',
        state: 'Maharashtra', businessType: 'individual_farmer',
        kycStatus: 'VERIFIED', profileCompletion: 85,
        avatar: 'https://images.pexels.com/photos/2382665/pexels-photo-2382665.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
    }),
    prisma.user.upsert({
      where:  { phone: '9823456780' },
      update: {},
      create: {
        phone: '9823456780', name: 'Sunita Deshpande',
        district: 'Pune', taluka: 'Baramati', village: 'Malegaon',
        state: 'Maharashtra', businessType: 'farmer_group',
        kycStatus: 'VERIFIED', profileCompletion: 90,
        avatar: 'https://images.pexels.com/photos/5407203/pexels-photo-5407203.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
    }),
    prisma.user.upsert({
      where:  { phone: '9765432109' },
      update: {},
      create: {
        phone: '9765432109', name: 'Manoj Shinde',
        district: 'Chhatrapati Sambhajinagar', taluka: 'Paithan', village: 'Waluj',
        state: 'Maharashtra', businessType: 'agri_business',
        kycStatus: 'VERIFIED', profileCompletion: 95,
        avatar: 'https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=200',
      },
    }),
  ]);
  console.log(' >', sellers.length, 'sellers ready');

  const [rajesh, sunita, manoj] = sellers;

  // ── 2. Category IDs lookup ─────────────────────────────────────────────────
  const cats = await prisma.category.findMany({ select: { id: true, name: true } });
  const catId = (name) => cats.find(c => c.name.includes(name))?.id;

  // ══════════════════════════════════════════════════════════════════════════════
  //  3. AgriStore Products — 3 per category with proper images
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\nCreating products...');

  const PRODUCTS = [
    // ── Seeds & Planting Material (3) ──────────────────────────────────────
    {
      name: 'Hybrid Wheat Seeds (HD-3086)',
      nameHi: 'हाइब्रिड गेहूं बीज (HD-3086)',
      nameMr: 'संकरित गहू बियाणे (HD-3086)',
      description: 'HD-3086 is a high-yielding wheat variety resistant to rust diseases. Gives 50-55 quintals per hectare under proper irrigation. Ideal for Rabi season sowing in Maharashtra. Recommended by ICAR for peninsular zone.',
      price: 280, mrp: 340, unit: 'kg', stock: 500, minOrderQty: 5,
      images: [IMG.wheatSeeds],
      tags: ['wheat', 'rabi', 'high-yield', 'rust-resistant'],
      rating: 4.5, ratingCount: 128,
      categoryName: 'Seeds', sellerId: rajesh.id,
    },
    {
      name: 'Basmati Rice Seeds (Pusa-1121)',
      nameHi: 'बासमती धान बीज (पूसा-1121)',
      nameMr: 'बासमती तांदूळ बियाणे (पूसा-1121)',
      description: 'Pusa-1121 is an extra-long grain basmati variety with excellent cooking quality. Aroma score 8/10. Plant height 115 cm, matures in 140 days. Best for Kharif planting.',
      price: 120, mrp: 150, unit: 'kg', stock: 800, minOrderQty: 10,
      images: [IMG.riceSeeds],
      tags: ['rice', 'basmati', 'kharif', 'aromatic'],
      rating: 4.3, ratingCount: 95,
      categoryName: 'Seeds', sellerId: sunita.id,
    },
    {
      name: 'Nasik Red Onion Seeds (Agrifound Dark Red)',
      nameHi: 'नासिक लाल प्याज बीज',
      nameMr: 'नाशिक लाल कांदा बियाणे',
      description: 'Best suited for Kharif and late Kharif planting in Maharashtra. Globular bulbs with deep red colour. TSS 13-14 Brix. 250-300 q/ha yield potential. Nashik origin.',
      price: 1800, mrp: 2100, unit: '500g', stock: 150, minOrderQty: 1,
      images: [IMG.onionSeeds],
      tags: ['onion', 'nasik', 'kharif', 'export'],
      rating: 4.6, ratingCount: 312,
      categoryName: 'Seeds', sellerId: rajesh.id,
    },

    // ── Fertilizers & Soil Nutrition (3) ────────────────────────────────────
    {
      name: 'DAP Fertilizer 50 kg (IFFCO)',
      nameHi: 'डीएपी उर्वरक 50 किग्रा (इफको)',
      nameMr: 'डीएपी खत 50 किलो (इफको)',
      description: 'IFFCO DAP (18:46:00) - High phosphorus content for root development and early crop establishment. Suitable for all crops. Apply as basal dose at sowing. Government subsidised.',
      price: 1350, mrp: 1520, unit: 'bag', stock: 200, minOrderQty: 1,
      images: [IMG.dapBag],
      tags: ['dap', 'phosphorus', 'basal', 'iffco'],
      rating: 4.5, ratingCount: 445,
      categoryName: 'Fertilizers', sellerId: manoj.id,
    },
    {
      name: 'Urea 45 kg (Chambal Neem-Coated)',
      nameHi: 'यूरिया 45 किग्रा (चंबल नीम लेपित)',
      nameMr: 'युरिया 45 किलो (चंबल निम लेपित)',
      description: 'Chambal Urea (46% N) - Primary nitrogen source for vegetative growth. Neem-coated to slow nitrogen release, reducing losses by 15-20%. BIS certified. Government price controlled.',
      price: 390, mrp: 430, unit: 'bag', stock: 500, minOrderQty: 1,
      images: [IMG.ureaBag],
      tags: ['urea', 'nitrogen', 'neem-coated', 'chambal'],
      rating: 4.3, ratingCount: 289,
      categoryName: 'Fertilizers', sellerId: rajesh.id,
    },
    {
      name: 'Vermicompost Organic Manure (5 kg)',
      nameHi: 'वर्मीकम्पोस्ट जैविक खाद (5 किग्रा)',
      nameMr: 'गांडूळ खत (5 किलो)',
      description: 'Certified organic vermicompost enriched with humic acid. NPK ratio 1.5:1:1. Improves soil structure, water retention and microbial activity. Safe for all crops. Made in Maharashtra.',
      price: 180, mrp: 220, unit: 'bag', stock: 350, minOrderQty: 2,
      images: [IMG.vermicompost],
      tags: ['organic', 'vermicompost', 'soil-health'],
      rating: 4.8, ratingCount: 167,
      categoryName: 'Organic', sellerId: sunita.id,
    },

    // ── Crop Protection (3) ────────────────────────────────────────────────
    {
      name: 'Mancozeb 75% WP Fungicide (1 kg)',
      nameHi: 'मैन्कोज़ेब 75% WP फफूंदनाशी (1 किग्रा)',
      nameMr: 'मॅन्कोझेब 75% WP बुरशीनाशक (1 किलो)',
      description: 'Broad-spectrum contact fungicide for downy mildew, early/late blight in tomato, potato, grape. Mix 2-2.5g per litre water. Pre-harvest interval: 7 days.',
      price: 320, mrp: 380, unit: 'kg', stock: 180, minOrderQty: 1,
      images: [IMG.fungicide],
      tags: ['fungicide', 'mancozeb', 'blight', 'downy-mildew'],
      rating: 4.2, ratingCount: 134,
      categoryName: 'Crop Protection', sellerId: manoj.id,
    },
    {
      name: 'Imidacloprid 17.8% SL Insecticide (250 ml)',
      nameHi: 'इमिडाक्लोप्रिड 17.8% SL कीटनाशक',
      nameMr: 'इमिडाक्लोप्रिड 17.8% SL कीटकनाशक',
      description: 'Systemic insecticide for sucking pests — aphids, jassids, whiteflies in cotton, sugarcane, chilli. Dose: 0.5ml/litre. Neonicotinoid class. Quick knockdown + residual action.',
      price: 290, mrp: 350, unit: '250ml', stock: 200, minOrderQty: 1,
      images: [IMG.fungicide],
      tags: ['insecticide', 'imidacloprid', 'aphids', 'cotton'],
      rating: 4.1, ratingCount: 98,
      categoryName: 'Crop Protection', sellerId: rajesh.id,
    },
    {
      name: 'Neem Oil Organic Pesticide (1 litre)',
      nameHi: 'नीम तेल जैविक कीटनाशक (1 लीटर)',
      nameMr: 'निम तेल सेंद्रिय कीटकनाशक (1 लीटर)',
      description: 'Cold-pressed neem oil with 3000 ppm Azadirachtin. Controls 200+ pests including mealybugs, mites, thrips. Safe for beneficial insects. Organic certified. Mix 5ml/litre.',
      price: 380, mrp: 450, unit: 'litre', stock: 150, minOrderQty: 1,
      images: [IMG.fungicide],
      tags: ['neem', 'organic', 'bio-pesticide', 'safe'],
      rating: 4.6, ratingCount: 210,
      categoryName: 'Crop Protection', sellerId: sunita.id,
    },

    // ── Hand Tools & Small Equipment (3) ────────────────────────────────────
    {
      name: 'Khurpi Steel Hand Weeder (Set of 2)',
      nameHi: 'खुरपी स्टील हैंड वीडर (2 का सेट)',
      nameMr: 'खुरपी स्टील हँड वीडर (2 चा सेट)',
      description: 'Heavy-duty forged steel khurpi with ergonomic wooden handle. Ideal for weeding between rows, transplanting seedlings and loosening soil. Rust-resistant coating. Made in Kolhapur.',
      price: 120, mrp: 160, unit: 'set', stock: 300, minOrderQty: 1,
      images: [IMG.khurpi],
      tags: ['khurpi', 'weeder', 'hand-tool', 'steel'],
      rating: 4.4, ratingCount: 187,
      categoryName: 'Hand Tools', sellerId: manoj.id,
    },
    {
      name: 'Sickle / Vilayti Darant (Stainless Steel)',
      nameHi: 'हंसिया / विलायती दरांती (स्टेनलेस स्टील)',
      nameMr: 'विळा / विलायती दरांती (स्टेनलेस स्टील)',
      description: 'Sharp serrated-edge stainless steel sickle for harvesting wheat, paddy, jowar. Comfortable grip handle. Blade length 25cm. Stays sharp 3x longer than carbon steel.',
      price: 85, mrp: 120, unit: 'piece', stock: 400, minOrderQty: 1,
      images: [IMG.sickle],
      tags: ['sickle', 'harvesting', 'hand-tool', 'stainless'],
      rating: 4.3, ratingCount: 156,
      categoryName: 'Hand Tools', sellerId: rajesh.id,
    },
    {
      name: 'Garden Spade / Phaavda (Heavy Duty)',
      nameHi: 'गार्डन फावड़ा (हैवी ड्यूटी)',
      nameMr: 'फावडे (हेवी ड्युटी)',
      description: 'Industrial-grade carbon steel spade with long wooden handle (120cm). For digging irrigation channels, transplanting, mixing compost. Weight: 2.1 kg. D-grip handle.',
      price: 350, mrp: 420, unit: 'piece', stock: 150, minOrderQty: 1,
      images: [IMG.spade],
      tags: ['spade', 'phavda', 'digging', 'heavy-duty'],
      rating: 4.5, ratingCount: 102,
      categoryName: 'Hand Tools', sellerId: sunita.id,
    },

    // ── Farm Machinery & Equipment (3) — for AgriStore purchase ─────────────
    {
      name: 'Seed Drill 9-Row (Balwan)',
      nameHi: 'सीड ड्रिल 9-रो (बलवान)',
      nameMr: 'सीड ड्रिल 9-रो (बलवान)',
      description: 'Balwan 9-row seed drill for precise sowing of wheat, gram, soybean, maize. Adjustable row spacing 20-30cm. Fertilizer box included. Requires 35+ HP tractor. Covers 3 acres/hour.',
      price: 42000, mrp: 48000, unit: 'piece', stock: 10, minOrderQty: 1,
      images: [IMG.seedDrill],
      tags: ['seed-drill', 'sowing', 'precision', 'balwan'],
      rating: 4.6, ratingCount: 58,
      categoryName: 'Farm Machinery', sellerId: manoj.id,
    },
    {
      name: 'Spring Loaded Cultivator 9-Tyne',
      nameHi: 'स्प्रिंग लोडेड कल्टीवेटर 9-टाइन',
      nameMr: 'स्प्रिंग लोडेड कल्टिव्हेटर 9-टाइन',
      description: 'Heavy-duty spring-loaded cultivator with 9 tynes for deep tillage and weed control. Working width 7 ft. Suitable for 35-50 HP tractors. Reversible shovels for long life.',
      price: 18500, mrp: 22000, unit: 'piece', stock: 15, minOrderQty: 1,
      images: [IMG.cultivator],
      tags: ['cultivator', 'tillage', 'weed-control', 'spring-loaded'],
      rating: 4.4, ratingCount: 76,
      categoryName: 'Farm Machinery', sellerId: rajesh.id,
    },
    {
      name: 'MB Plough 2-Bottom (Maschio Gaspardo)',
      nameHi: 'एमबी प्लाउ 2-बॉटम (मास्कियो गैस्पार्डो)',
      nameMr: 'एमबी नांगर 2-बॉटम (मास्कियो गस्पार्डो)',
      description: 'Maschio Gaspardo reversible mould-board plough, 2-bottom, for primary tillage. Cuts depth up to 30cm. Ideal for black cotton soil of Marathwada. Requires 45+ HP tractor.',
      price: 35000, mrp: 40000, unit: 'piece', stock: 8, minOrderQty: 1,
      images: [IMG.plough],
      tags: ['plough', 'mb-plough', 'primary-tillage', 'maschio'],
      rating: 4.7, ratingCount: 44,
      categoryName: 'Farm Machinery', sellerId: sunita.id,
    },

    // ── Irrigation & Water Management (3) ──────────────────────────────────
    {
      name: 'Drip Irrigation Kit - 1 Acre',
      nameHi: 'ड्रिप सिंचाई किट - 1 एकड़',
      nameMr: 'ठिबक सिंचन संच - 1 एकर',
      description: 'Complete drip kit for 1 acre: 16mm lateral pipes 400m, 4mm microtube 200m, emitters (2 LPH) 400 nos, filter, pressure regulator and fittings. 60% water saving vs flood irrigation. PMKSY subsidy eligible.',
      price: 8500, mrp: 10500, unit: 'set', stock: 40, minOrderQty: 1,
      images: [IMG.drip],
      tags: ['drip', 'water-saving', 'subsidy-eligible'],
      rating: 4.6, ratingCount: 221,
      categoryName: 'Irrigation', sellerId: sunita.id,
    },
    {
      name: 'Rain Gun Sprinkler (1 inch, 20m radius)',
      nameHi: 'रेन गन स्प्रिंकलर (1 इंच, 20 मीटर)',
      nameMr: 'रेन गन स्प्रिंकलर (1 इंच, 20 मीटर)',
      description: 'Heavy-duty rain gun sprinkler with 360-degree rotation. Covers 20m radius. Ideal for sugarcane, maize, groundnut. Flow: 5000 LPH. Brass nozzle with adjustable angle.',
      price: 2800, mrp: 3400, unit: 'piece', stock: 60, minOrderQty: 1,
      images: [IMG.sprinkler],
      tags: ['sprinkler', 'rain-gun', 'sugarcane', 'wide-area'],
      rating: 4.3, ratingCount: 89,
      categoryName: 'Irrigation', sellerId: rajesh.id,
    },
    {
      name: 'Knapsack Manual Sprayer 16L (Neptune)',
      nameHi: 'नेपच्यून मैनुअल स्प्रेयर 16L',
      nameMr: 'नेपच्यून मॅन्युअल स्प्रेयर 16L',
      description: 'Heavy-duty HDPE tank with brass pump, adjustable nozzle (cone/flat), padded shoulder straps. Ideal for small farms, orchards. Pressure: 3-4 bar. Weight: 4.5 kg empty.',
      price: 750, mrp: 950, unit: 'piece', stock: 80, minOrderQty: 1,
      images: [IMG.knapsack],
      tags: ['sprayer', 'manual', 'pesticide', 'portable'],
      rating: 4.1, ratingCount: 156,
      categoryName: 'Hand Tools', sellerId: manoj.id,
    },

    // ── Solar & Energy (3) ─────────────────────────────────────────────────
    {
      name: 'Solar Water Pump 3HP (Kirloskar)',
      nameHi: 'सोलर वाटर पम्प 3HP (किर्लोस्कर)',
      nameMr: 'सौर जल पंप 3HP (किर्लोस्कर)',
      description: 'Kirloskar 3HP solar submersible pump with 3kW solar panel (10 panels x 300W), MPPT controller and mounting structure. Pumps 45,000 LPH at 10m head. 5yr panel warranty. PM-KUSUM subsidy eligible.',
      price: 75000, mrp: 90000, unit: 'set', stock: 15, minOrderQty: 1,
      images: [IMG.solarPump],
      tags: ['solar', 'pump', 'pm-kusum', 'kirloskar'],
      rating: 4.7, ratingCount: 89,
      categoryName: 'Solar', sellerId: rajesh.id,
    },

    // ── Protected Cultivation (1) ──────────────────────────────────────────
    {
      name: 'Polyhouse Covering Film 200 Micron (4m x 50m)',
      nameHi: 'पॉलीहाउस कवरिंग फिल्म 200 माइक्रोन',
      nameMr: 'पॉलीहाऊस फिल्म 200 मायक्रॉन',
      description: 'UV-stabilised LDPE film with 5-year life. 90% light transmission, anti-drip coating reduces humidity. Suitable for polyhouse/shade net structures. Subsidy available under NHM.',
      price: 4200, mrp: 5000, unit: 'roll', stock: 30, minOrderQty: 1,
      images: [IMG.polyhouse],
      tags: ['polyhouse', 'film', 'uv-stabilised', 'nhm-subsidy'],
      rating: 4.4, ratingCount: 62,
      categoryName: 'Protected Cultivation', sellerId: sunita.id,
    },

    // ── Livestock, Dairy & Poultry (3) ─────────────────────────────────────
    {
      name: 'Cattle Feed 50 kg (Amul Dan)',
      nameHi: 'पशु आहार 50 किग्रा (अमूल दाना)',
      nameMr: 'गुरांचे खाद्य 50 किलो (अमूल दाणा)',
      description: 'Amul balanced cattle feed with 20% crude protein, fortified with vitamins and minerals. Increases milk yield by 15-20%. Suitable for cows, buffaloes. Pelletised for easy digestion.',
      price: 1200, mrp: 1400, unit: 'bag', stock: 100, minOrderQty: 1,
      images: [IMG.cattleFeed],
      tags: ['cattle-feed', 'dairy', 'amul', 'protein'],
      rating: 4.5, ratingCount: 320,
      categoryName: 'Livestock', sellerId: rajesh.id,
    },
    {
      name: 'Portable Milking Machine (Single Bucket)',
      nameHi: 'पोर्टेबल मिल्किंग मशीन (सिंगल बकेट)',
      nameMr: 'पोर्टेबल दूध काढणी यंत्र (सिंगल बकेट)',
      description: 'Single-bucket milking machine with 25L SS bucket. Vacuum pump 250 LPM. Milks 1 cow in 5-7 minutes. Teat cup liners made of food-grade silicone. 1 HP motor. 1 year warranty.',
      price: 18000, mrp: 22000, unit: 'piece', stock: 20, minOrderQty: 1,
      images: [IMG.milkingMachine],
      tags: ['milking', 'machine', 'dairy', 'portable'],
      rating: 4.3, ratingCount: 45,
      categoryName: 'Livestock', sellerId: sunita.id,
    },
    {
      name: 'Chaff Cutter Machine (Electric, 1HP)',
      nameHi: 'चारा कटाई मशीन (इलेक्ट्रिक, 1HP)',
      nameMr: 'चारा कटर मशीन (इलेक्ट्रिक, 1HP)',
      description: 'Electric chaff cutter for cutting fodder (jowar, bajra, sugarcane tops, napier grass). Capacity: 500 kg/hour. 3 blades, adjustable cut length 5-25mm. Safety guard included.',
      price: 8500, mrp: 10000, unit: 'piece', stock: 25, minOrderQty: 1,
      images: [IMG.chaff],
      tags: ['chaff-cutter', 'fodder', 'electric', 'dairy'],
      rating: 4.4, ratingCount: 67,
      categoryName: 'Livestock', sellerId: manoj.id,
    },

    // ── Smart Farming (1) ──────────────────────────────────────────────────
    {
      name: 'Soil NPK Sensor + App (FarmSense Pro)',
      nameHi: 'मिट्टी NPK सेंसर + ऐप',
      nameMr: 'माती NPK सेन्सर + ॲप',
      description: 'FarmSense Pro soil sensor measures N, P, K, pH, moisture and temperature in real-time. Bluetooth + Wi-Fi, syncs with mobile app (iOS/Android). Instant fertilizer recommendation. Battery: 6 months.',
      price: 3500, mrp: 4200, unit: 'piece', stock: 25, minOrderQty: 1,
      images: [IMG.soilSensor],
      tags: ['sensor', 'npk', 'precision-farming', 'iot'],
      rating: 4.5, ratingCount: 43,
      categoryName: 'Farm Technology', sellerId: manoj.id,
    },
  ];

  let productCount = 0;
  for (const p of PRODUCTS) {
    const cId = catId(p.categoryName);
    if (!cId) { console.log(` ! Category not found for "${p.categoryName}", skipping`); continue; }

    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) { console.log(` - skip (exists): ${p.name}`); continue; }

    await prisma.product.create({
      data: {
        categoryId: cId, sellerId: p.sellerId,
        name: p.name, nameHi: p.nameHi, nameMr: p.nameMr,
        description: p.description,
        price: p.price, mrp: p.mrp, unit: p.unit,
        stock: p.stock, minOrderQty: p.minOrderQty,
        images: p.images, tags: p.tags,
        rating: p.rating, ratingCount: p.ratingCount || 0,
        isActive: true,
      },
    });
    console.log(' + Product:', p.name);
    productCount++;
  }
  console.log(` > ${productCount} new products added`);

  // ══════════════════════════════════════════════════════════════════════════════
  //  4. Animal Listings — 3 cows + buffalo + goats + poultry (Maharashtra)
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\nCreating animal listings...');

  const ANIMALS = [
    // ── 3 Cows (Maharashtra) ───────────────────────────────────────────────
    {
      sellerId:       rajesh.id,
      animal:         'Cow',
      breed:          'Gir',
      age:            '5 years',
      gender:         'FEMALE',
      weight:         '380 kg',
      price:          78000,
      milkYield:      '8-12 litres/day (A2 milk)',
      description:    'Pure Gir cow from Junnar, Pune district. Pedigree certificate available. Produces premium A2 beta-casein milk fetching Rs 80-100/litre. 4th lactation, calm temperament, easy to handle. Vaccinated for FMD, HS, BQ. Tested negative for TB and Brucellosis. Original Gujarat bloodline maintained through AI from Junagadh breeding center.',
      images:         [IMG.girCow],
      tags:           ['gir', 'a2-milk', 'desi-cow', 'pedigree', 'maharashtra'],
      sellerLocation: 'Niphad, Nashik',
      lat:            20.0833, lng: 74.1500,
    },
    {
      sellerId:       sunita.id,
      animal:         'Cow',
      breed:          'Sahiwal',
      age:            '4 years',
      gender:         'FEMALE',
      weight:         '420 kg',
      price:          65000,
      milkYield:      '10-14 litres/day',
      description:    'Sahiwal cow, 3rd lactation, currently giving 12 litres/day. Known for heat tolerance and tick resistance — ideal for Maharashtra climate. Fat percentage 4.5-5%. Calved 3 times without complications. Vaccinated (FMD, HS). Dewormed last month. Located in Baramati, Pune. Can deliver within 50km radius.',
      images:         [IMG.sahiwalCow],
      tags:           ['sahiwal', 'heat-resistant', 'high-fat', 'desi-cow'],
      sellerLocation: 'Baramati, Pune',
      lat:            18.1523, lng: 74.5815,
    },
    {
      sellerId:       manoj.id,
      animal:         'Cow',
      breed:          'HF Cross (Holstein Friesian)',
      age:            '3 years',
      gender:         'FEMALE',
      weight:         '490 kg',
      price:          55000,
      milkYield:      '18-22 litres/day',
      description:    'High-yielding HF cross cow, 2nd lactation, currently 60 days into lactation giving 20 litres/day. Peak yield reached 24 litres. Up-to-date vaccinations (FMD, HS, BQ, Theileriosis). Peaceful temperament, machine-milking trained. Maintained on balanced ration — Amul Dan + green fodder. Located at Waluj, Chhatrapati Sambhajinagar.',
      images:         [IMG.hfCow],
      tags:           ['hf-cross', 'holstein', 'high-yield', 'dairy'],
      sellerLocation: 'Paithan, Chhatrapati Sambhajinagar',
      lat:            19.4760, lng: 75.3860,
    },

    // ── Buffalo ────────────────────────────────────────────────────────────
    {
      sellerId:       rajesh.id,
      animal:         'Buffalo',
      breed:          'Murrah',
      age:            '4 years',
      gender:         'FEMALE',
      weight:         '520 kg',
      price:          85000,
      milkYield:      '14-16 litres/day',
      description:    'High-milking Murrah buffalo, 3rd lactation, currently giving 15 litres/day. Fat content 7-8%. Recently vaccinated (FMD, HS). No mastitis history. Available with 2-month heifer calf. Imported from Haryana, adapted to Maharashtra climate for 2 years.',
      images:         [IMG.murrahBuffalo],
      tags:           ['murrah', 'buffalo', 'milch', 'high-yield'],
      sellerLocation: 'Niphad, Nashik',
      lat:            20.0833, lng: 74.1500,
    },

    // ── Goats ──────────────────────────────────────────────────────────────
    {
      sellerId:       sunita.id,
      animal:         'Goat',
      breed:          'Osmanabadi',
      age:            '2 years',
      gender:         'FEMALE',
      weight:         '28 kg',
      price:          8500,
      milkYield:      '1-1.2 litres/day',
      description:    'Osmanabadi breed doe, dual purpose (meat + milk). Vaccinated against PPR and Enterotoxemia. Healthy, active. Lot of 5 available (4 does + 1 buck) at Rs 42,000. Hardy breed, thrives on dry fodder. Originated from Osmanabad district.',
      images:         [IMG.osmanabadi],
      tags:           ['goat', 'osmanabadi', 'dual-purpose', 'meat'],
      sellerLocation: 'Baramati, Pune',
      lat:            18.1523, lng: 74.5815,
    },

    // ── Poultry ────────────────────────────────────────────────────────────
    {
      sellerId:       manoj.id,
      animal:         'Poultry',
      breed:          'Broiler (Cobb-400)',
      age:            '35 days',
      gender:         'MALE',
      weight:         '2.2 kg',
      price:          180,
      description:    'Ready-for-market Cobb-400 broiler batch of 500 birds. Average live weight 2.2 kg. FCR 1.65. All birds vaccinated (Mareks, Gumboro, ND). Farm located at Waluj industrial area. Available for on-farm pickup.',
      images:         [IMG.broiler],
      tags:           ['broiler', 'poultry', 'cobb-400', 'bulk'],
      sellerLocation: 'Paithan, Chhatrapati Sambhajinagar',
      lat:            19.4760, lng: 75.3860,
    },
    {
      sellerId:       rajesh.id,
      animal:         'Poultry',
      breed:          'Kadaknath (Black Chicken)',
      age:            '4 months',
      gender:         'MALE',
      weight:         '1.4 kg',
      price:          650,
      description:    'Kadaknath (black chicken) known for high protein, low fat, low cholesterol meat. Rich in iron and amino acids. Selling pairs (1M + 1F) at Rs 1,200. Organically raised on farm near Nashik — no antibiotics, free-range.',
      images:         [IMG.kadaknath],
      tags:           ['kadaknath', 'desi', 'organic', 'black-chicken'],
      sellerLocation: 'Niphad, Nashik',
      lat:            20.0833, lng: 74.1500,
    },
  ];

  let animalCount = 0;
  for (const a of ANIMALS) {
    const existing = await prisma.animalListing.findFirst({
      where: { sellerId: a.sellerId, animal: a.animal, breed: a.breed },
    });
    if (existing) { console.log(` - skip (exists): ${a.breed} ${a.animal}`); continue; }

    await prisma.animalListing.create({ data: { ...a, status: 'ACTIVE' } });
    console.log(' + Animal:', a.breed, a.animal);
    animalCount++;
  }
  console.log(` > ${animalCount} new animal listings added`);

  // ══════════════════════════════════════════════════════════════════════════════
  //  5. Machinery Listings (Rent tab) — 3+ with matching images
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\nCreating machinery listings...');

  const now = new Date();
  const future = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // +6 months

  const MACHINERY = [
    {
      ownerId:       rajesh.id,
      name:          'Mahindra 575 DI Tractor (47 HP)',
      category:      'tractor',
      brand:         'Mahindra',
      description:   'Well-maintained Mahindra 575 DI, 2020 model with 1,400 hours of use. 4WD, power steering, dual-clutch. Comes with rotavator, cultivator and MB plough attachments. Driver available at extra Rs 600/day. Popular choice for grape vineyards and sugarcane fields of Nashik district.',
      ageYears:      4,
      mileageHours:  1400,
      horsePower:    '47 HP',
      fuelType:      'diesel',
      features:      ['4WD', 'Power Steering', 'Dual Clutch', 'Rotavator Attachment', 'Cultivator'],
      pricePerDay:   2800,
      pricePerAcre:  650,
      pricePerHour:  350,
      images:        [IMG.mahindraTractor],
      videos:        [],
      location:      'Niphad, Nashik',
      district:      'Nashik',
      state:         'Maharashtra',
      lat:           20.0833, lng: 74.1500,
      ownerName:     'Rajesh Patil',
      ownerPhone:    '9876543210',
      rating:        4.6, ratingCount: 38,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:       sunita.id,
      name:          'John Deere 5310 Tractor (55 HP)',
      category:      'tractor',
      brand:         'John Deere',
      description:   'John Deere 5310, 2022 model, 700 hours. AC cabin, GPS guidance system. Ideal for large-scale sugarcane and soybean operations in western Maharashtra. PTO speed 540/1000 RPM. All attachments included.',
      ageYears:      2,
      mileageHours:  700,
      horsePower:    '55 HP',
      fuelType:      'diesel',
      features:      ['AC Cabin', 'GPS Guidance', 'PTO 540/1000', '4WD', 'Front Loader Ready'],
      pricePerDay:   3500,
      pricePerAcre:  800,
      pricePerHour:  450,
      images:        [IMG.johnDeere],
      videos:        [],
      location:      'Baramati, Pune',
      district:      'Pune',
      state:         'Maharashtra',
      lat:           18.1523, lng: 74.5815,
      ownerName:     'Sunita Deshpande',
      ownerPhone:    '9823456780',
      rating:        4.8, ratingCount: 22,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:       manoj.id,
      name:          'Combine Harvester — Wheat & Soybean (New Holland TC5.30)',
      category:      'harvester',
      brand:         'New Holland',
      description:   'New Holland TC5.30 combine harvester, 2021 model. 4.5m cutting width, grain tank 3500 litres. Harvests wheat at 5 acres/hour, soybean at 4 acres/hour. Driver included. Advance booking 3 days required. Operates across Marathwada region.',
      ageYears:      3,
      horsePower:    '145 HP',
      fuelType:      'diesel',
      features:      ['4.5m Header', '3500L Tank', 'Straw Walker', 'Auto Threshing', 'Driver Included'],
      pricePerDay:   12000,
      pricePerAcre:  1800,
      images:        [IMG.harvester],
      videos:        [],
      location:      'Paithan, Chhatrapati Sambhajinagar',
      district:      'Chhatrapati Sambhajinagar',
      state:         'Maharashtra',
      lat:           19.4760, lng: 75.3860,
      ownerName:     'Manoj Shinde',
      ownerPhone:    '9765432109',
      rating:        4.7, ratingCount: 54,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:       rajesh.id,
      name:          'Rotavator 7-Feet (Shaktiman)',
      category:      'rotavator',
      brand:         'Shaktiman',
      description:   'Shaktiman 7-ft rotavator, 48 blades, suitable for 45+ HP tractors. Covers 1 acre in 45 minutes. Excellent for seedbed preparation before rabi sowing. Recently serviced, all blades replaced.',
      ageYears:      3,
      horsePower:    '45+ HP required',
      fuelType:      'diesel',
      features:      ['48 Blades', '7-ft Width', 'Side Shift', 'Gear Box Drive'],
      pricePerDay:   1200,
      pricePerAcre:  350,
      pricePerHour:  180,
      images:        [IMG.rotavator],
      videos:        [],
      location:      'Niphad, Nashik',
      district:      'Nashik',
      state:         'Maharashtra',
      lat:           20.0833, lng: 74.1500,
      ownerName:     'Rajesh Patil',
      ownerPhone:    '9876543210',
      rating:        4.4, ratingCount: 15,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:       sunita.id,
      name:          'Agriculture Drone Sprayer (DJI Agras T40)',
      category:      'other',
      brand:         'DJI',
      description:   'DJI Agras T40 drone, 40L tank, covers 40 acres per day. Precision spraying with obstacle avoidance. 40% less chemical usage vs manual. DGCA licensed operator included. Ideal for tall crops — sugarcane, cotton, pomegranate orchards.',
      ageYears:      1,
      horsePower:    'Electric',
      fuelType:      'electric',
      features:      ['40L Tank', 'DGCA Licensed', 'Obstacle Avoidance', 'RTK GPS', '40 Acres/Day'],
      pricePerDay:   6500,
      pricePerAcre:  280,
      images:        [IMG.droneSpray],
      videos:        [],
      location:      'Baramati, Pune',
      district:      'Pune',
      state:         'Maharashtra',
      lat:           18.1523, lng: 74.5815,
      ownerName:     'Sunita Deshpande',
      ownerPhone:    '9823456780',
      rating:        4.9, ratingCount: 31,
      availableFrom: now, availableTo: future,
    },
  ];

  let machineryCount = 0;
  for (const m of MACHINERY) {
    const existing = await prisma.machineryListing.findFirst({
      where: { ownerId: m.ownerId, name: m.name },
    });
    if (existing) { console.log(` - skip (exists): ${m.name}`); continue; }

    await prisma.machineryListing.create({ data: { ...m, status: 'ACTIVE', available: true } });
    console.log(' + Machinery:', m.name);
    machineryCount++;
  }
  console.log(` > ${machineryCount} new machinery listings added`);

  // ══════════════════════════════════════════════════════════════════════════════
  //  6. Labour Listings (Rent tab — Workers) — 3 with matching images
  // ══════════════════════════════════════════════════════════════════════════════
  console.log('\nCreating labour listings...');

  const LABOUR = [
    {
      providerId:    rajesh.id,
      name:          'Ramesh Harvesting Group',
      leader:        'Ramesh Khandare',
      groupName:     'Shramik Shetkari Mandal',
      skills:        ['Wheat Harvesting', 'Paddy Harvesting', 'Sickle Work', 'Threshing', 'Winnowing'],
      experience:    '12 years',
      description:   'Experienced 20-member harvesting group from Niphad taluka. Available for wheat and paddy harvest across Nashik district. Bring own tools (sickles, ropes). Complete 1 acre wheat in 6 person-hours. Reliable, punctual, trusted by 50+ farmers. Can also handle onion harvesting and grading.',
      languages:     ['Marathi', 'Hindi'],
      pricePerDay:   450,
      pricePerHour:  65,
      groupSize:     20,
      image:         IMG.farmWorkers,
      images:        [IMG.farmWorkers],
      videos:        [],
      phone:         '9823000001',
      location:      'Niphad, Nashik',
      district:      'Nashik',
      state:         'Maharashtra',
      lat:           20.0833, lng: 74.1500,
      rating:        4.7, ratingCount: 63,
      availableFrom: now, availableTo: future,
    },
    {
      providerId:    sunita.id,
      name:          'Vineyard Pruning Specialists',
      leader:        'Vitthal Jadhav',
      groupName:     'Jadhav Pruning Services',
      skills:        ['Grape Pruning', 'Training & Tying', 'Bunch Thinning', 'Canopy Management', 'Berry Sizing'],
      experience:    '8 years',
      description:   'Specialised in grape vineyard management — October pruning, April pruning, training, tying, canopy management and berry thinning. Team of 10, all trained under NHB programme. Work in Nashik, Sangli and Solapur districts. Transparent billing per vine or per acre.',
      languages:     ['Marathi', 'Hindi'],
      pricePerDay:   600,
      pricePerHour:  85,
      groupSize:     10,
      image:         IMG.vineyardWorker,
      images:        [IMG.vineyardWorker],
      videos:        [],
      phone:         '9823000002',
      location:      'Baramati, Pune',
      district:      'Pune',
      state:         'Maharashtra',
      lat:           18.1523, lng: 74.5815,
      rating:        4.8, ratingCount: 44,
      availableFrom: now, availableTo: future,
    },
    {
      providerId:    manoj.id,
      name:          'Sugarcane Cutting & Loading Team',
      leader:        'Bhimrao Mane',
      groupName:     'Mane Shetkari Group',
      skills:        ['Sugarcane Cutting', 'Manual Loading', 'Irrigation Channel Digging', 'Fertilizer Application'],
      experience:    '15 years',
      description:   'Expert sugarcane-cutting gang of 25 workers from Paithan taluka. Work with or without machinery. Self-sufficient unit with own transport. Complete 15-20 acres/day cutting + loading. Available Oct-March (crushing season). Well known to sugar factories in Marathwada.',
      languages:     ['Marathi', 'Hindi'],
      pricePerDay:   420,
      pricePerHour:  60,
      groupSize:     25,
      image:         IMG.sugarcaneWorker,
      images:        [IMG.sugarcaneWorker],
      videos:        [],
      phone:         '9823000003',
      location:      'Paithan, Chhatrapati Sambhajinagar',
      district:      'Chhatrapati Sambhajinagar',
      state:         'Maharashtra',
      lat:           19.4760, lng: 75.3860,
      rating:        4.5, ratingCount: 71,
      availableFrom: now, availableTo: future,
    },
  ];

  let labourCount = 0;
  for (const l of LABOUR) {
    const existing = await prisma.labourListing.findFirst({
      where: { providerId: l.providerId, name: l.name },
    });
    if (existing) { console.log(` - skip (exists): ${l.name}`); continue; }

    await prisma.labourListing.create({ data: { ...l, status: 'ACTIVE', available: true } });
    console.log(' + Labour:', l.name);
    labourCount++;
  }
  console.log(` > ${labourCount} new labour listings added`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n  Demo seed complete!');
  console.log(`   Sellers:   ${sellers.length}`);
  console.log(`   Products:  ${productCount}`);
  console.log(`   Animals:   ${animalCount}`);
  console.log(`   Machinery: ${machineryCount}`);
  console.log(`   Labour:    ${labourCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
