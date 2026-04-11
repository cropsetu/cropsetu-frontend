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

// ── Image helpers ─────────────────────────────────────────────────────────────
const U = (id, w = 600) => `https://images.unsplash.com/photo-${id}?w=${w}&q=80`;

// Curated Unsplash photo IDs per subject
const IMG = {
  // Seeds & crops
  wheatSeeds:     U('1574323347407-f5e1ad6d020b'),
  riceSeeds:      U('1536304929831-ee1ca9d44906'),
  tomatoSeeds:    U('1592838064572-fcd58f1de3b9'),
  onionSeeds:     U('1618512496248-a07fe83aa8cb'),
  cornSeeds:      U('1567306226416-28f0efdc88ce'),
  // Fertilizers / soil
  fertBag:        U('1416879595882-3373a0480b5b'),
  compost:        U('1500382017468-9049fed747ef'),
  // Crop protection
  pesticide:      U('1530836176759-510dff9ba5d2'),
  // Irrigation
  drip:           U('1563514227-cd0ad0197bb7'),
  sprinkler:      U('1416879595882-3373a0480b5b'),
  // Tools
  khurpi:         U('1416879595882-3373a0480b5b'),
  sickle:         U('1416879595882-3373a0480b5b'),
  // Machinery products
  knapsack:       U('1530836176759-510dff9ba5d2'),
  // Solar
  solar:          U('1509391366360-2e959784a276'),
  // Organic
  organic:        U('1500382017468-9049fed747ef'),
  // Greenhouse
  greenhouse:     U('1416879595882-3373a0480b5b'),
  // Wheat field
  wheatField:     U('1466692476868-9ee5a3a3e93b'),
  // Animals
  murrahBuffalo:  U('1516467508483-a7212febe31a'),
  hfCow:          U('1567450297492-d4b5e6424a2b'),
  girCow:         U('1567450297492-d4b5e6424a2b'),
  osmanabadiGoat: U('1548550023-2bdb3c5beed7'),
  sangamnerGoat:  U('1548550023-2bdb3c5beed7'),
  poultry:        U('1548152434-a2b0b12e8769'),
  broilerChicken: U('1548152434-a2b0b12e8769'),
  desi:           U('1548152434-a2b0b12e8769'),
  // Machinery (rent)
  tractor:        U('1500937386664-56d1dfef3854'),
  harvester:      U('1625246333195-78d9c38ad449'),
  rotavator:      U('1500937386664-56d1dfef3854'),
  droneSpray:     U('1530836176759-510dff9ba5d2'),
  thresher:       U('1625246333195-78d9c38ad449'),
  miniTractor:    U('1500937386664-56d1dfef3854'),
  // Labour
  labourTeam:     U('1574323347407-f5e1ad6d020b'),
};

async function main() {
  console.log('\n🌱  FarmEasy Demo Seed\n');

  // ── 1. Seller users ────────────────────────────────────────────────────────
  console.log('Creating sellers…');
  const sellers = await Promise.all([
    prisma.user.upsert({
      where:  { phone: '9876543210' },
      update: {},
      create: {
        phone: '9876543210', name: 'Rajesh Patil',
        district: 'Nashik', taluka: 'Niphad', village: 'Vinchur',
        state: 'Maharashtra', businessType: 'individual_farmer',
        kycStatus: 'VERIFIED', profileCompletion: 85,
        avatar: U('1567450297492-d4b5e6424a2b', 200),
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
        avatar: U('1618512496248-a07fe83aa8cb', 200),
      },
    }),
    prisma.user.upsert({
      where:  { phone: '9765432109' },
      update: {},
      create: {
        phone: '9765432109', name: 'Manoj Shinde',
        district: 'Aurangabad', taluka: 'Paithan', village: 'Waluj',
        state: 'Maharashtra', businessType: 'agri_business',
        kycStatus: 'VERIFIED', profileCompletion: 95,
        avatar: U('1500937386664-56d1dfef3854', 200),
      },
    }),
  ]);
  console.log(' ✓', sellers.length, 'sellers ready');

  const [rajesh, sunita, manoj] = sellers;

  // ── 2. Category IDs lookup ─────────────────────────────────────────────────
  const cats = await prisma.category.findMany({ select: { id: true, name: true } });
  const catId = (name) => cats.find(c => c.name.includes(name))?.id;

  // ── 3. AgriStore products ──────────────────────────────────────────────────
  console.log('\nCreating products…');

  const PRODUCTS = [
    // Seeds
    {
      name: 'Hybrid Wheat Seeds (HD-3086)',
      nameHi: 'हाइब्रिड गेहूं बीज',
      nameMr: 'संकरित गहू बियाणे',
      description: 'HD-3086 is a high-yielding wheat variety resistant to rust diseases. Gives 50-55 quintals per hectare under proper irrigation. Ideal for Rabi season sowing in Maharashtra.',
      price: 280, mrp: 340, unit: 'kg', stock: 500, minOrderQty: 5,
      images: [IMG.wheatSeeds, IMG.wheatField],
      tags: ['wheat', 'rabi', 'high-yield', 'rust-resistant'],
      rating: 4.5, ratingCount: 128,
      categoryName: 'Seeds',
      sellerId: rajesh.id,
    },
    {
      name: 'Basmati Rice Seeds (Pusa-1121)',
      nameHi: 'बासमती धान बीज',
      nameMr: 'बासमती तांदूळ बियाणे',
      description: 'Pusa-1121 is an extra-long grain basmati variety with excellent cooking quality. Aroma score 8/10. Plant height 115 cm, matures in 140 days.',
      price: 120, mrp: 150, unit: 'kg', stock: 800, minOrderQty: 10,
      images: [IMG.riceSeeds],
      tags: ['rice', 'basmati', 'kharif', 'aromatic'],
      rating: 4.3, ratingCount: 95,
      categoryName: 'Seeds',
      sellerId: sunita.id,
    },
    {
      name: 'Tomato F1 Hybrid Seeds (Arka Rakshak)',
      nameHi: 'टमाटर F1 हाइब्रिड बीज',
      nameMr: 'टोमॅटो F1 संकरित बियाणे',
      description: 'Triple disease resistant (ToBRFV, ToLCNDV, TMV) F1 hybrid with determinate growth. Fruits 180-200g, deep red colour, long shelf life. Yield: 60-70 tonnes/hectare.',
      price: 950, mrp: 1100, unit: '10g pkt', stock: 200, minOrderQty: 1,
      images: [IMG.tomatoSeeds],
      tags: ['tomato', 'hybrid', 'disease-resistant', 'export-quality'],
      rating: 4.7, ratingCount: 203,
      categoryName: 'Seeds',
      sellerId: manoj.id,
    },
    {
      name: 'Nasik Red Onion Seeds (Agrifound Dark Red)',
      nameHi: 'नासिक लाल प्याज बीज',
      nameMr: 'नाशिक लाल कांदा बियाणे',
      description: 'Best suited for Kharif and late Kharif planting in Maharashtra. Globular bulbs with deep red colour. TSS 13-14°Brix. 250-300 q/ha yield potential.',
      price: 1800, mrp: 2100, unit: '500g', stock: 150, minOrderQty: 1,
      images: [IMG.onionSeeds],
      tags: ['onion', 'nasik', 'kharif', 'export'],
      rating: 4.6, ratingCount: 312,
      categoryName: 'Seeds',
      sellerId: rajesh.id,
    },
    {
      name: 'Sweet Corn Seeds (Sugar 75)',
      nameHi: 'मीठा मक्का बीज',
      nameMr: 'स्वीट कॉर्न बियाणे',
      description: 'Excellent sweetness and tenderness. Ready in 75 days. Cob length 22-24 cm. Very suitable for fresh market and processing. Can be grown in two seasons.',
      price: 620, mrp: 750, unit: '500g', stock: 300, minOrderQty: 1,
      images: [IMG.cornSeeds],
      tags: ['corn', 'sweet-corn', 'vegetable', 'fast-growing'],
      rating: 4.4, ratingCount: 76,
      categoryName: 'Seeds',
      sellerId: sunita.id,
    },
    // Fertilizers
    {
      name: 'DAP Fertilizer 50 kg (IFFCO)',
      nameHi: 'डीएपी उर्वरक 50 किग्रा',
      nameMr: 'डीएपी खत 50 किलो',
      description: 'IFFCO DAP (18:46:00) - High phosphorus content for root development and early crop establishment. Suitable for all crops. Apply as basal dose at sowing.',
      price: 1350, mrp: 1520, unit: 'bag', stock: 200, minOrderQty: 1,
      images: [IMG.fertBag],
      tags: ['dap', 'phosphorus', 'basal', 'iffco'],
      rating: 4.5, ratingCount: 445,
      categoryName: 'Fertilizers',
      sellerId: manoj.id,
    },
    {
      name: 'Urea 45 kg (Chambal)',
      nameHi: 'यूरिया 45 किग्रा',
      nameMr: 'युरिया 45 किलो',
      description: 'Chambal Urea (46% N) - Primary nitrogen source for vegetative growth. Neem-coated to slow nitrogen release, reducing losses by 15-20%. BIS certified.',
      price: 390, mrp: 430, unit: 'bag', stock: 500, minOrderQty: 1,
      images: [IMG.fertBag],
      tags: ['urea', 'nitrogen', 'neem-coated', 'chambal'],
      rating: 4.3, ratingCount: 289,
      categoryName: 'Fertilizers',
      sellerId: rajesh.id,
    },
    {
      name: 'Vermicompost Organic Manure (5 kg)',
      nameHi: 'वर्मीकम्पोस्ट जैविक खाद',
      nameMr: 'गांडूळ खत (5 किलो)',
      description: 'Certified organic vermicompost enriched with humic acid. NPK ratio 1.5:1:1. Improves soil structure, water retention and microbial activity. Safe for all crops.',
      price: 180, mrp: 220, unit: 'bag', stock: 350, minOrderQty: 2,
      images: [IMG.compost, IMG.organic],
      tags: ['organic', 'vermicompost', 'soil-health', 'pgpr'],
      rating: 4.8, ratingCount: 167,
      categoryName: 'Organic',
      sellerId: sunita.id,
    },
    // Crop Protection
    {
      name: 'Mancozeb 75% WP Fungicide (1 kg)',
      nameHi: 'मैन्कोज़ेब 75% WP फफूंदनाशी',
      nameMr: 'मॅन्कोझेब 75% बुरशीनाशक',
      description: 'Broad-spectrum contact fungicide for downy mildew, early/late blight in tomato, potato, grape. Mix 2-2.5g per litre water. Pre-harvest interval: 7 days.',
      price: 320, mrp: 380, unit: 'kg', stock: 180, minOrderQty: 1,
      images: [IMG.pesticide],
      tags: ['fungicide', 'mancozeb', 'blight', 'downy-mildew'],
      rating: 4.2, ratingCount: 134,
      categoryName: 'Crop Protection',
      sellerId: manoj.id,
    },
    {
      name: 'Chlorpyrifos 20% EC Insecticide (1 L)',
      nameHi: 'क्लोरपाइरीफॉस 20% EC कीटनाशक',
      nameMr: 'क्लोरपायरीफॉस 20% कीटकनाशक',
      description: 'Broad-spectrum organophosphate insecticide for stem borers, aphids, thrips in cotton, rice, sugarcane. Dose: 2ml/litre. Systemic + contact action.',
      price: 485, mrp: 560, unit: 'litre', stock: 120, minOrderQty: 1,
      images: [IMG.pesticide],
      tags: ['insecticide', 'borers', 'cotton', 'rice'],
      rating: 4.0, ratingCount: 88,
      categoryName: 'Crop Protection',
      sellerId: rajesh.id,
    },
    // Irrigation
    {
      name: 'Drip Irrigation Kit — 1 Acre',
      nameHi: 'ड्रिप सिंचाई किट — 1 एकड़',
      nameMr: 'ठिबक सिंचन संच — 1 एकर',
      description: 'Complete drip kit for 1 acre: 16mm lateral pipes 400m, 4mm microtube 200m, emitters (2 LPH) 400 nos, filter, pressure regulator and fittings. 60% water saving vs flood irrigation.',
      price: 8500, mrp: 10500, unit: 'set', stock: 40, minOrderQty: 1,
      images: [IMG.drip],
      tags: ['drip', 'water-saving', 'subsidy-eligible', 'jain'],
      rating: 4.6, ratingCount: 221,
      categoryName: 'Irrigation',
      sellerId: sunita.id,
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
      categoryName: 'Hand Tools',
      sellerId: manoj.id,
    },
    // Solar
    {
      name: 'Solar Water Pump 3HP (Kirloskar)',
      nameHi: 'सोलर वाटर पम्प 3HP किर्लोस्कर',
      nameMr: 'सौर जल पंप 3HP किर्लोस्कर',
      description: 'Kirloskar 3HP solar submersible pump with 3kW solar panel (10 panels × 300W), MPPT controller and mounting structure. Pumps 45,000 LPH at 10m head. 5yr panel warranty. PM-KUSUM subsidy eligible.',
      price: 75000, mrp: 90000, unit: 'set', stock: 15, minOrderQty: 1,
      images: [IMG.solar],
      tags: ['solar', 'pump', 'pm-kusum', 'subsidy', 'kirloskar'],
      rating: 4.7, ratingCount: 89,
      categoryName: 'Solar',
      sellerId: rajesh.id,
    },
    // Greenhouse
    {
      name: 'Polyhouse Covering Film 200 Micron (4m × 50m)',
      nameHi: 'पॉलीहाउस कवरिंग फिल्म 200 माइक्रोन',
      nameMr: 'पॉलीहाऊस फिल्म 200 मायक्रॉन',
      description: 'UV-stabilised LDPE film with 5-year life. 90% light transmission, anti-drip coating reduces humidity. Suitable for polyhouse/shade net structures. Subsidy available under NHM.',
      price: 4200, mrp: 5000, unit: 'roll', stock: 30, minOrderQty: 1,
      images: [IMG.greenhouse],
      tags: ['polyhouse', 'film', 'uv-stabilised', 'nhm-subsidy'],
      rating: 4.4, ratingCount: 62,
      categoryName: 'Protected Cultivation',
      sellerId: sunita.id,
    },
    // Smart farming
    {
      name: 'Soil NPK Sensor + App (FarmSense Pro)',
      nameHi: 'मिट्टी NPK सेंसर + ऐप',
      nameMr: 'माती NPK सेन्सर + ॲप',
      description: 'FarmSense Pro soil sensor measures N, P, K, pH, moisture and temperature in real-time. Bluetooth + Wi-Fi, syncs with mobile app (iOS/Android). Instant fertilizer recommendation. Battery: 6 months.',
      price: 3500, mrp: 4200, unit: 'piece', stock: 25, minOrderQty: 1,
      images: [IMG.solar],
      tags: ['sensor', 'npk', 'precision-farming', 'iot', 'smart'],
      rating: 4.5, ratingCount: 43,
      categoryName: 'Farm Technology',
      sellerId: manoj.id,
    },
  ];

  let productCount = 0;
  for (const p of PRODUCTS) {
    const catKey = p.categoryName;
    const cId = catId(catKey);
    if (!cId) { console.log(` ⚠ Category not found for "${catKey}", skipping`); continue; }

    // Idempotent: skip if a product with same name already exists
    const existing = await prisma.product.findFirst({ where: { name: p.name } });
    if (existing) { console.log(` – skipping (exists): ${p.name}`); continue; }

    await prisma.product.create({
      data: {
        categoryId: cId,
        sellerId:   p.sellerId,
        name:       p.name,
        nameHi:     p.nameHi,
        nameMr:     p.nameMr,
        description: p.description,
        price:       p.price,
        mrp:         p.mrp,
        unit:        p.unit,
        stock:       p.stock,
        minOrderQty: p.minOrderQty,
        images:      p.images,
        tags:        p.tags,
        rating:      p.rating,
        ratingCount: p.ratingCount || 0,
        isActive:    true,
      },
    });
    console.log(' ✓ Product:', p.name);
    productCount++;
  }
  console.log(` ✓ ${productCount} new products added`);

  // ── 4. Animal listings ─────────────────────────────────────────────────────
  console.log('\nCreating animal listings…');

  const ANIMALS = [
    {
      sellerId:      rajesh.id,
      animal:        'Buffalo',
      breed:         'Murrah',
      age:           '4 years',
      gender:        'FEMALE',
      weight:        '520 kg',
      price:         85000,
      milkYield:     '14–16 litres/day',
      description:   'High-milking Murrah buffalo, 3rd lactation, currently giving 15 litres/day. Recently vaccinated (FMD, HS). Teeth OK, no mastitis history. Available with calf (2-month heifer). Reason for sale: farm consolidation.',
      images:        [IMG.murrahBuffalo],
      tags:          ['murrah', 'buffalo', 'milch', 'high-yield'],
      sellerLocation: 'Niphad, Nashik',
      lat:            20.0833, lng: 74.1500,
    },
    {
      sellerId:      sunita.id,
      animal:        'Cow',
      breed:         'HF (Holstein Friesian)',
      age:           '5 years',
      gender:        'FEMALE',
      weight:        '480 kg',
      price:         62000,
      milkYield:     '18–20 litres/day',
      description:   '4th lactation HF cross cow, currently 45 days into lactation giving 19 litres/day. Up-to-date vaccinations. BIS certified farm. Peaceful temperament. Two previous calvings without complications.',
      images:        [IMG.hfCow],
      tags:          ['hf-cow', 'milch', 'jersey-cross', 'holstein'],
      sellerLocation: 'Baramati, Pune',
      lat:            18.1523, lng: 74.5815,
    },
    {
      sellerId:      manoj.id,
      animal:        'Cow',
      breed:         'Gir',
      age:           '6 years',
      gender:        'FEMALE',
      weight:        '390 kg',
      price:         75000,
      milkYield:     '8–10 litres/day (A2 milk)',
      description:   'Pure Gir cow with pedigree certificate. Produces A2 beta-casein milk, premium market price. Calm, easy to handle. Tested negative for TB and brucellosis. 5th lactation.',
      images:        [IMG.girCow],
      tags:          ['gir', 'a2-milk', 'desi', 'pedigree'],
      sellerLocation: 'Paithan, Aurangabad',
      lat:            19.4760, lng: 75.3860,
    },
    {
      sellerId:      rajesh.id,
      animal:        'Goat',
      breed:         'Osmanabadi',
      age:           '2 years',
      gender:        'FEMALE',
      weight:        '28 kg',
      price:         8500,
      milkYield:     '1–1.2 litres/day',
      description:   'Osmanabadi breed, known for meat and milk dual purpose. Vaccinated against PPR and Enterotoxemia. Healthy, active. Selling set of 5 (4 does + 1 buck) at ₹42,000 for full lot.',
      images:        [IMG.osmanabadiGoat],
      tags:          ['goat', 'osmanabadi', 'dual-purpose', 'meat'],
      sellerLocation: 'Niphad, Nashik',
      lat:            20.0833, lng: 74.1500,
    },
    {
      sellerId:      sunita.id,
      animal:        'Goat',
      breed:         'Sangamner',
      age:           '18 months',
      gender:        'MALE',
      weight:        '32 kg',
      price:         12000,
      description:   'Stud buck, Sangamner breed. Good conformation, strong build. Ideal for improving local breed stock. Vaccinated and dewormed. Papers available.',
      images:        [IMG.sangamnerGoat],
      tags:          ['goat', 'buck', 'stud', 'sangamner'],
      sellerLocation: 'Baramati, Pune',
      lat:            18.1523, lng: 74.5815,
    },
    {
      sellerId:      manoj.id,
      animal:        'Poultry',
      breed:         'Broiler (Cobb-400)',
      age:           '35 days',
      gender:        'MALE',
      weight:        '2.2 kg',
      price:         180,
      description:   'Ready-for-market Cobb-400 broiler batch of 500 birds. Average live weight 2.2 kg. FCR 1.65. All birds vaccinated (Mareks, Gumboro, ND). Available for on-farm pickup.',
      images:        [IMG.broilerChicken],
      tags:          ['broiler', 'poultry', 'cobb-400', 'bulk'],
      sellerLocation: 'Paithan, Aurangabad',
      lat:            19.4760, lng: 75.3860,
    },
    {
      sellerId:      rajesh.id,
      animal:        'Poultry',
      breed:         'Desi Kadaknath',
      age:           '4 months',
      gender:        'MALE',
      weight:        '1.4 kg',
      price:         650,
      description:   'Kadaknath (black chicken) known for high protein, low fat meat. Rich in iron & amino acids. Selling pairs (1M + 1F) at ₹1,200. Organically raised, no antibiotics.',
      images:        [IMG.desi],
      tags:          ['kadaknath', 'desi', 'organic', 'black-chicken'],
      sellerLocation: 'Niphad, Nashik',
      lat:            20.0833, lng: 74.1500,
    },
    {
      sellerId:      sunita.id,
      animal:        'Sheep',
      breed:         'Deccani',
      age:           '2 years',
      gender:        'FEMALE',
      weight:        '30 kg',
      price:         7500,
      description:   'Deccani ewes (5 available), suitable for meat and wool. Hardy breed, thrives on dry fodder. Annual wool yield 1.5 kg. Vaccinated against Enterotoxemia and PPR.',
      images:        [IMG.osmanabadiGoat],
      tags:          ['sheep', 'deccani', 'meat', 'wool'],
      sellerLocation: 'Baramati, Pune',
      lat:            18.1523, lng: 74.5815,
    },
  ];

  let animalCount = 0;
  for (const a of ANIMALS) {
    const existing = await prisma.animalListing.findFirst({
      where: { sellerId: a.sellerId, animal: a.animal, breed: a.breed },
    });
    if (existing) { console.log(` – skipping (exists): ${a.breed} ${a.animal}`); continue; }

    await prisma.animalListing.create({ data: { ...a, status: 'ACTIVE' } });
    console.log(' ✓ Animal:', a.breed, a.animal);
    animalCount++;
  }
  console.log(` ✓ ${animalCount} new animal listings added`);

  // ── 5. Machinery listings (Rent tab) ────────────────────────────────────────
  console.log('\nCreating machinery listings…');

  const now = new Date();
  const future = new Date(now.getTime() + 180 * 24 * 60 * 60 * 1000); // +6 months

  const MACHINERY = [
    {
      ownerId:      rajesh.id,
      name:         'Mahindra 575 DI Tractor (47 HP)',
      category:     'tractor',
      brand:        'Mahindra',
      description:  'Well-maintained Mahindra 575 DI, 2020 model with 1,400 hours of use. 4WD, power steering, dual-clutch. Comes with rotavator, cultivator and MB plough attachments. Driver available at extra ₹600/day.',
      ageYears:     4,
      mileageHours: 1400,
      horsePower:   '47 HP',
      fuelType:     'diesel',
      features:     ['4WD', 'Power Steering', 'Dual Clutch', 'Rotavator Attachment', 'Cultivator'],
      pricePerDay:  2800,
      pricePerAcre: 650,
      pricePerHour: 350,
      images:       [IMG.tractor],
      videos:       [],
      location:     'Niphad, Nashik',
      district:     'Nashik',
      state:        'Maharashtra',
      lat:           20.0833, lng: 74.1500,
      ownerName:    'Rajesh Patil',
      ownerPhone:   '9876543210',
      rating:       4.6, ratingCount: 38,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:      sunita.id,
      name:         'John Deere 5310 Tractor (55 HP)',
      category:     'tractor',
      brand:        'John Deere',
      description:  'John Deere 5310, 2022 model, 700 hours. AC cabin, GPS guidance system. Ideal for large-scale sugarcane and soybean operations. PTO speed 540/1000 RPM. All attachments included.',
      ageYears:     2,
      mileageHours: 700,
      horsePower:   '55 HP',
      fuelType:     'diesel',
      features:     ['AC Cabin', 'GPS Guidance', 'PTO 540/1000', '4WD', 'Front Loader Ready'],
      pricePerDay:  3500,
      pricePerAcre: 800,
      pricePerHour: 450,
      images:       [IMG.tractor],
      videos:       [],
      location:     'Baramati, Pune',
      district:     'Pune',
      state:        'Maharashtra',
      lat:           18.1523, lng: 74.5815,
      ownerName:    'Sunita Deshpande',
      ownerPhone:   '9823456780',
      rating:       4.8, ratingCount: 22,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:      manoj.id,
      name:         'Rotavator 7-Feet (Shaktiman)',
      category:     'rotavator',
      brand:        'Shaktiman',
      description:  'Shaktiman 7-ft rotavator, 48 blades, suitable for 45+ HP tractors. Covers 1 acre in 45 minutes. Excellent for seedbed preparation. Recently serviced, all blades replaced.',
      ageYears:     3,
      horsePower:   '45+ HP required',
      fuelType:     'diesel',
      features:     ['48 Blades', '7-ft Width', 'Side Shift', 'Gear Box Drive'],
      pricePerDay:  1200,
      pricePerAcre: 350,
      pricePerHour: 180,
      images:       [IMG.rotavator],
      videos:       [],
      location:     'Paithan, Aurangabad',
      district:     'Aurangabad',
      state:        'Maharashtra',
      lat:           19.4760, lng: 75.3860,
      ownerName:    'Manoj Shinde',
      ownerPhone:   '9765432109',
      rating:       4.4, ratingCount: 15,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:      rajesh.id,
      name:         'Harvester — Paddy & Wheat (New Holland TC5.30)',
      category:     'harvester',
      brand:        'New Holland',
      description:  'New Holland TC5.30 combine harvester, 2021 model. 4.5m cutting width, grain tank 3500 litres. Harvests wheat at 5 acres/hour, paddy at 4 acres/hour. Driver included. Advance booking required.',
      ageYears:     3,
      horsePower:   '145 HP',
      fuelType:     'diesel',
      features:     ['4.5m Header', '3500L Tank', 'Straw Walker', 'Auto Threshing', 'Driver Included'],
      pricePerDay:  12000,
      pricePerAcre: 1800,
      images:       [IMG.harvester],
      videos:       [],
      location:     'Niphad, Nashik',
      district:     'Nashik',
      state:        'Maharashtra',
      lat:           20.0833, lng: 74.1500,
      ownerName:    'Rajesh Patil',
      ownerPhone:   '9876543210',
      rating:       4.7, ratingCount: 54,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:      sunita.id,
      name:         'Agriculture Drone Sprayer (DJI Agras T40)',
      category:     'other',
      brand:        'DJI',
      description:  'DJI Agras T40 drone, 40L tank, covers 40 acres per day. Precision spraying with obstacle avoidance. 40% less chemical usage vs manual. DGCA licensed operator included. Ideal for tall crops (sugarcane, cotton).',
      ageYears:     1,
      horsePower:   'Electric',
      fuelType:     'electric',
      features:     ['40L Tank', 'DGCA Licensed', 'Obstacle Avoidance', 'RTK GPS', '40 Acres/Day'],
      pricePerDay:  6500,
      pricePerAcre: 280,
      images:       [IMG.droneSpray],
      videos:       [],
      location:     'Baramati, Pune',
      district:     'Pune',
      state:        'Maharashtra',
      lat:           18.1523, lng: 74.5815,
      ownerName:    'Sunita Deshpande',
      ownerPhone:   '9823456780',
      rating:       4.9, ratingCount: 31,
      availableFrom: now, availableTo: future,
    },
    {
      ownerId:      manoj.id,
      name:         'Mini Tractor Kubota B2741 (27 HP)',
      category:     'tractor',
      brand:        'Kubota',
      description:  'Kubota B2741 mini tractor, ideal for orchards, vineyards and small plots. Very low turning radius. Comes with rotavator and front dozer blade. Fuel-efficient: 3L/hr. 2023 model, 400 hours.',
      ageYears:     1,
      mileageHours: 400,
      horsePower:   '27 HP',
      fuelType:     'diesel',
      features:     ['Low Turning Radius', 'Orchard Friendly', 'Front Blade', 'Kubota 3-cyl Engine'],
      pricePerDay:  2200,
      pricePerAcre: 550,
      pricePerHour: 280,
      images:       [IMG.miniTractor],
      videos:       [],
      location:     'Paithan, Aurangabad',
      district:     'Aurangabad',
      state:        'Maharashtra',
      lat:           19.4760, lng: 75.3860,
      ownerName:    'Manoj Shinde',
      ownerPhone:   '9765432109',
      rating:       4.5, ratingCount: 18,
      availableFrom: now, availableTo: future,
    },
  ];

  let machineryCount = 0;
  for (const m of MACHINERY) {
    const existing = await prisma.machineryListing.findFirst({
      where: { ownerId: m.ownerId, name: m.name },
    });
    if (existing) { console.log(` – skipping (exists): ${m.name}`); continue; }

    await prisma.machineryListing.create({ data: { ...m, status: 'ACTIVE', available: true } });
    console.log(' ✓ Machinery:', m.name);
    machineryCount++;
  }
  console.log(` ✓ ${machineryCount} new machinery listings added`);

  // ── 6. Labour listings (Rent tab — Workers section) ───────────────────────
  console.log('\nCreating labour listings…');

  const LABOUR = [
    {
      providerId:   rajesh.id,
      name:         'Ramesh Harvesting Group',
      leader:       'Ramesh Khandare',
      groupName:    'Shramik Shetkari Mandal',
      skills:       ['Wheat Harvesting', 'Paddy Harvesting', 'Sickle Work', 'Threshing'],
      experience:   '12 years',
      description:  'Experienced 20-member harvesting group from Niphad. Available for wheat and paddy harvest. Bring own tools. 1 acre wheat in 6 person-hours. Reliable, punctual, known by 50+ farmers.',
      languages:    ['Marathi', 'Hindi'],
      pricePerDay:  450,
      pricePerHour: 65,
      groupSize:    20,
      image:        IMG.labourTeam,
      images:       [IMG.labourTeam],
      videos:       [],
      phone:        '9823000001',
      location:     'Niphad, Nashik',
      district:     'Nashik',
      state:        'Maharashtra',
      lat:           20.0833, lng: 74.1500,
      rating:       4.7, ratingCount: 63,
      availableFrom: now, availableTo: future,
    },
    {
      providerId:   sunita.id,
      name:         'Vineyard Pruning Specialists',
      leader:       'Vitthal Jadhav',
      groupName:    'Jadhav Pruning Services',
      skills:       ['Grape Pruning', 'Training & Tying', 'Bunch Thinning', 'Canopy Management'],
      experience:   '8 years',
      description:  'Specialised in grape vineyard management — pruning, training, tying and canopy work. Team of 10, all trained under NHB programme. Work in Nashik, Sangli and Solapur districts. Transparent billing per vine.',
      languages:    ['Marathi', 'Hindi'],
      pricePerDay:  600,
      pricePerHour: 85,
      groupSize:    10,
      image:        IMG.labourTeam,
      images:       [IMG.labourTeam],
      videos:       [],
      phone:        '9823000002',
      location:     'Baramati, Pune',
      district:     'Pune',
      state:        'Maharashtra',
      lat:           18.1523, lng: 74.5815,
      rating:       4.8, ratingCount: 44,
      availableFrom: now, availableTo: future,
    },
    {
      providerId:   manoj.id,
      name:         'Sugarcane Cutting & Loading Team',
      leader:       'Bhimrao Mane',
      groupName:    'Mane Shetkari Group',
      skills:       ['Sugarcane Cutting', 'Manual Loading', 'Irrigation Operation', 'Fertilizer Application'],
      experience:   '15 years',
      description:  'Expert sugarcane-cutting gang of 25 workers. Work with or without machinery. Self-sufficient unit with own transport. Complete 15-20 acres/day cutting. Available Oct–March season.',
      languages:    ['Marathi', 'Hindi'],
      pricePerDay:  420,
      pricePerHour: 60,
      groupSize:    25,
      image:        IMG.labourTeam,
      images:       [IMG.labourTeam],
      videos:       [],
      phone:        '9823000003',
      location:     'Paithan, Aurangabad',
      district:     'Aurangabad',
      state:        'Maharashtra',
      lat:           19.4760, lng: 75.3860,
      rating:       4.5, ratingCount: 71,
      availableFrom: now, availableTo: future,
    },
    {
      providerId:   rajesh.id,
      name:         'General Farm Labour (Weed & Spray)',
      leader:       'Sanjay Salunke',
      skills:       ['Weeding', 'Pesticide Spraying', 'Transplanting', 'Irrigation Channels', 'Vegetable Picking'],
      experience:   '5 years',
      description:  'Reliable daily-wage workers for general farm tasks. Weeding, spraying, transplanting and picking. Individual or small groups of 3-5 available on 1-day notice. Daily rate negotiable for 7+ days.',
      languages:    ['Marathi'],
      pricePerDay:  380,
      groupSize:    5,
      image:        IMG.labourTeam,
      images:       [IMG.labourTeam],
      videos:       [],
      phone:        '9823000004',
      location:     'Niphad, Nashik',
      district:     'Nashik',
      state:        'Maharashtra',
      lat:           20.0833, lng: 74.1500,
      rating:       4.3, ratingCount: 28,
      availableFrom: now, availableTo: future,
    },
  ];

  let labourCount = 0;
  for (const l of LABOUR) {
    const existing = await prisma.labourListing.findFirst({
      where: { providerId: l.providerId, name: l.name },
    });
    if (existing) { console.log(` – skipping (exists): ${l.name}`); continue; }

    await prisma.labourListing.create({ data: { ...l, status: 'ACTIVE', available: true } });
    console.log(' ✓ Labour:', l.name);
    labourCount++;
  }
  console.log(` ✓ ${labourCount} new labour listings added`);

  // ── Summary ────────────────────────────────────────────────────────────────
  console.log('\n✅  Demo seed complete!');
  console.log(`   Sellers:   ${sellers.length}`);
  console.log(`   Products:  ${productCount}`);
  console.log(`   Animals:   ${animalCount}`);
  console.log(`   Machinery: ${machineryCount}`);
  console.log(`   Labour:    ${labourCount}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
