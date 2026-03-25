/**
 * Chat seed — dummy farmers, DMs, groups and group messages.
 * Run: npm run db:seed:chat
 */
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

// ── Dummy farmer avatars (DiceBear initials style via UI Avatars) ──────────────
const AV = (initials, color) =>
  `https://ui-avatars.com/api/?name=${encodeURIComponent(initials)}&background=${color}&color=fff&size=128&bold=true`;

// ── Dummy users ────────────────────────────────────────────────────────────────
const FARMERS = [
  {
    phone: '+919876543201',
    name: 'Ramesh Patil',
    statusQuote: 'Shetkari ahe, अभिमान ahe 🌾',
    district: 'Ahmednagar',
    city: 'Sangamner',
    pincode: '422605',
    state: 'Maharashtra',
    avatar: AV('Ramesh Patil', '1a6b3c'),
  },
  {
    phone: '+919876543202',
    name: 'Sunita Devi',
    statusQuote: 'Organic farming is the future 🌿',
    district: 'Pune',
    city: 'Baramati',
    pincode: '413102',
    state: 'Maharashtra',
    avatar: AV('Sunita Devi', 'e07b39'),
  },
  {
    phone: '+919876543203',
    name: 'Mahesh Jadhav',
    statusQuote: 'गाव माझं सुंदर, शेत माझं धन 🐄',
    district: 'Nashik',
    city: 'Niphad',
    pincode: '422303',
    state: 'Maharashtra',
    avatar: AV('Mahesh Jadhav', '2e7d32'),
  },
  {
    phone: '+919876543204',
    name: 'Priya Sharma',
    statusQuote: 'Growing hopes, harvesting happiness',
    district: 'Solapur',
    city: 'Pandharpur',
    pincode: '413304',
    state: 'Maharashtra',
    avatar: AV('Priya Sharma', 'ad1457'),
  },
  {
    phone: '+919876543205',
    name: 'Arun Wagh',
    statusQuote: 'मी शेतकरी, मी देशाचा पोशिंदा 💪',
    district: 'Aurangabad',
    city: 'Paithan',
    pincode: '431107',
    state: 'Maharashtra',
    avatar: AV('Arun Wagh', '4527a0'),
  },
  {
    phone: '+919876543206',
    name: 'Lakshmi Bai',
    statusQuote: 'Cotton is gold 🌼',
    district: 'Nagpur',
    city: 'Wardha',
    pincode: '442001',
    state: 'Maharashtra',
    avatar: AV('Lakshmi Bai', 'c62828'),
  },
  {
    phone: '+919876543207',
    name: 'Vijay Mane',
    statusQuote: 'Proud farmer of Kolhapur 🙏',
    district: 'Kolhapur',
    city: 'Hatkanangle',
    pincode: '416109',
    state: 'Maharashtra',
    avatar: AV('Vijay Mane', '00695c'),
  },
];

// ── DM conversations ───────────────────────────────────────────────────────────
// [senderIndex, receiverIndex, messages[]]
const DM_THREADS = [
  {
    a: 0, b: 1, // Ramesh ↔ Sunita
    messages: [
      { from: 0, text: 'Namaskar Sunita ji! Kanda rate kai aahe aaj?' },
      { from: 1, text: 'Ramesh bhai, aaj Baramati market madhye ₹1800 per quintal aahe.' },
      { from: 0, text: 'Theek aahe. Mi udya market la janar aahe. Tumhi yenaar ka?' },
      { from: 1, text: 'Hoy, mi pan yein. Sathe jayila bara hoin 😊' },
      { from: 0, text: 'Maaz soyabean pan aahe, te pan vikaychay aaj.' },
      { from: 1, text: 'Soyabean la pun changla rate milel. ₹4200 per quintal chalala aahe.' },
      { from: 0, text: '👍 Acha! Udya 7 vajeta ready raha, mi pick karato.' },
    ],
  },
  {
    a: 0, b: 2, // Ramesh ↔ Mahesh
    messages: [
      { from: 2, text: 'Ramesh bhai, tumchakade Murrah buffalo vikaychi aahe ka?' },
      { from: 0, text: 'Hoy aahe. 4 liter dudh dete roz. Kimat sangto — ₹75,000.' },
      { from: 2, text: 'Thodi kami kara. ₹65,000 dein.' },
      { from: 0, text: '₹70,000 final. Buffalo khup changali aahe, aajar nahi kabhi.' },
      { from: 2, text: 'Baghu. Ek vel padhu ka udya?' },
      { from: 0, text: 'Ya, udya subahi 9 vajeta ya. Shetat ahe ti.' },
      { from: 2, text: 'Theek aahe. Yeinto 🙏' },
    ],
  },
  {
    a: 1, b: 3, // Sunita ↔ Priya
    messages: [
      { from: 3, text: 'Sunita tai, tumhi konte soyabean seed vaparata?' },
      { from: 1, text: 'Mi JS-335 vaparate, changala yield miltey — 20 q/acre.' },
      { from: 3, text: 'MAUS-71 spasht aahe ka? Maaz neighbor ne suggest kela.' },
      { from: 1, text: 'Paus kami asla ki MAUS-71 bara hote. Tumhi Solapur la aahat na? Tithe suggest karain.' },
      { from: 3, text: 'Hoy. Pun yanda paus bare aahe, so JS-335 vaparun baghu.' },
      { from: 1, text: 'Sure! Sangamner APMC madhye biyan milel. Ramesh Patil janat aahe tithe.' },
    ],
  },
  {
    a: 4, b: 6, // Arun ↔ Vijay
    messages: [
      { from: 4, text: 'Vijay, tumchakade tractor rent la milel ka pudi mahina?' },
      { from: 6, text: 'Hoy milel! 50 HP tractor aahe. ₹800 per day.' },
      { from: 4, text: 'Ek aathavada lagel. 5 divas aahet. Deal?' },
      { from: 6, text: '5 divas ₹4000 — discount dein ₹3500. OK?' },
      { from: 4, text: 'Done! Kiti tarkhela available aahe?' },
      { from: 6, text: '15 tarikh nantarcha konitihi din chalel.' },
      { from: 4, text: '18 tarikh pakki kara. Advance transfer karato 🙏' },
      { from: 6, text: 'Done! UPI: vijay.mane@ybl karate advance paathva.' },
    ],
  },
  {
    a: 2, b: 5, // Mahesh ↔ Lakshmi
    messages: [
      { from: 5, text: 'Mahesh ji, cotton madhe koni paan rog aahe ka yanda? Maaze paan pivale hotyat.' },
      { from: 2, text: 'Lakshmi tai, Alternaria leaf spot aseil. Mancozeb 75% WP spray kara 2.5 g/L.' },
      { from: 5, text: 'Kitivel spray karaycha?' },
      { from: 2, text: '10 divas antaran 2-3 vel spray kara. Paus nantarcha spray bar hote.' },
      { from: 5, text: 'Acha! FarmEasy app var pathved disel ka article?' },
      { from: 2, text: 'Hoy! Community madhye "Pest/Disease" filter lava, milin articles 📱' },
    ],
  },
];

// ── Community Groups ───────────────────────────────────────────────────────────
const GROUPS_DATA = [
  {
    name: 'Ahmednagar Shetkari Mandal',
    description: 'Ahmednagar jilhyatil shethri ek vyasapith. Bhav, havaaman, aur navi technology share karnya sathi.',
    isPublic: true,
    district: 'Ahmednagar',
    creatorIndex: 0, // Ramesh
    memberIndices: [0, 1, 2, 4],
    avatar: 'https://ui-avatars.com/api/?name=ASM&background=1a6b3c&color=fff&size=128&bold=true',
    messages: [
      { fromIdx: 0, text: 'Namaskar Mandal madhye sadar swaagat! 🙏 Amchi group madhye sheti vishayak mahiti share karu.' },
      { fromIdx: 2, text: 'Khup changala uddyog Ramesh bhai! Mi Nashik la aaho, pan Ahmednagar la pan sheti aahe maaji.' },
      { fromIdx: 1, text: 'Mala organic farming vishayak group hava hota. Ithe pan share karun.' },
      { fromIdx: 4, text: 'Aaj Pune mandirchya bazarat soyabean ₹4150/quintal gela. Saadar sambhaala 🌾' },
      { fromIdx: 0, text: 'Yanda Kharif season sathi biyan kiti kimat dili tumhi?' },
      { fromIdx: 2, text: 'BT Cotton ₹960/bag. Thodi jast aahe, pan Bollgard II aahe mhanun gheto.' },
      { fromIdx: 1, text: 'Organic cotton la kami input cost, jast price miltey. Koni trial karaychay?' },
      { fromIdx: 4, text: 'Mi magchya varshi kela. Certification la 3 varsha lagtay, pan worth ahe 👍' },
    ],
  },
  {
    name: 'Maharashtra Cotton Farmers',
    description: 'Cotton cultivation tips, market prices, pest alerts and government scheme updates for Maharashtra farmers.',
    isPublic: true,
    district: null,
    creatorIndex: 5, // Lakshmi
    memberIndices: [5, 0, 2, 4, 6],
    avatar: 'https://ui-avatars.com/api/?name=MCF&background=c62828&color=fff&size=128&bold=true',
    messages: [
      { fromIdx: 5, text: 'Welcome to Maharashtra Cotton Farmers group! Please share market prices from your area daily 🌼' },
      { fromIdx: 0, text: 'Ahmednagar APMC: Cotton ₹6800/quintal today (spot). Fair price!' },
      { fromIdx: 4, text: 'Aurangabad: ₹6950/quintal. Yanda rate bare aahet 😊' },
      { fromIdx: 2, text: 'Alert: Pink bollworm infestation reported in Jalgaon. Keep monitoring pheromone traps.' },
      { fromIdx: 6, text: 'Kolhapur: ₹6650 only. MSP ₹6620 so barely above. Hoping for improvement.' },
      { fromIdx: 5, text: 'ATMA office ne navi scheme announce keli: 50% subsidy on BT cotton seed this year!' },
      { fromIdx: 0, text: 'Koni apply kela ka scheme la? Link share kara plz 🙏' },
      { fromIdx: 5, text: 'https://mahaagri.gov.in/schemes — ithe apply kara. Last date 30 tarikh.' },
    ],
  },
  {
    name: 'Organic Farming Network MH',
    description: 'Zero budget natural farming | Organic certification help | Jaivik Kheti discussions | Premium market linkage',
    isPublic: true,
    district: null,
    creatorIndex: 1, // Sunita
    memberIndices: [1, 3, 6],
    avatar: 'https://ui-avatars.com/api/?name=OFN&background=2e7d32&color=fff&size=128&bold=true',
    messages: [
      { fromIdx: 1, text: 'ZBNF (Zero Budget Natural Farming) group madhye welcome! Subhash Palekar ji chya method follow karo.' },
      { fromIdx: 3, text: 'Mi 2 acres convert kela last year. First crop yield thodi kami, pan mati sudharly 🌱' },
      { fromIdx: 6, text: 'Beejamrit recipe share kara koni? Mala accurate measurements nahi mahit.' },
      { fromIdx: 1, text: '🌿 Beejamrit Recipe:\n- Desi cow dung: 100g\n- Cow urine: 50ml\n- Lime: 1g\n- Mitti: 1 handful\n- Water: 1 litre\nMix and ferment 48 hrs, then coat seeds.' },
      { fromIdx: 3, text: 'Jeevamrit banana kuni sikaila? Video share kara 🙏' },
      { fromIdx: 6, text: 'YouTube par Subhash Palekar ZBNF video search kara. Marathi maddhe pan aahe.' },
      { fromIdx: 1, text: 'FPO kade organic certification apply kelay. 3 varsha lagel, pan premium price milel — ₹2000 jast per quintal!' },
    ],
  },
];

// ── Main seed ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('💬 Seeding chat users, DMs and groups...\n');

  // 1. Create / upsert dummy farmer users
  const createdUsers = [];
  for (const f of FARMERS) {
    const user = await prisma.user.upsert({
      where:  { phone: f.phone },
      create: f,
      update: { name: f.name, statusQuote: f.statusQuote, district: f.district, city: f.city, pincode: f.pincode, avatar: f.avatar },
    });
    createdUsers.push(user);
    console.log(`  ✓ User: ${user.name} (${user.district})`);
  }
  console.log(`\n✅ ${createdUsers.length} farmers created\n`);

  // 2a. Find real users (non-seed accounts) and send them intro DMs + add to groups
  const dummyPhones = FARMERS.map((f) => f.phone);
  const realUsers = await prisma.user.findMany({
    where: { phone: { notIn: dummyPhones } },
    select: { id: true, name: true, phone: true },
  });

  if (realUsers.length > 0) {
    console.log(`\n📲 Creating intro DMs for ${realUsers.length} real user(s)...`);
    const intros = [
      { fromIdx: 0, text: 'Namaskar! Mi Ramesh Patil, Ahmednagar. FarmEasy var navi aahe mala 🙏 Chat karu!' },
      { fromIdx: 1, text: 'Hello! Sunita here from Baramati. Organic farming baghto mi. Chat karu! 🌿' },
      { fromIdx: 2, text: 'Jai Kisan! Mahesh Jadhav, Nashik. Tumchi sheti kuthali aahe? 🌾' },
      { fromIdx: 5, text: 'Namaste! Lakshmi Bai from Wardha. Cotton farming kartoye. Nice to connect! 🌼' },
    ];
    for (const realUser of realUsers) {
      for (const intro of intros) {
        const sender = createdUsers[intro.fromIdx];
        if (sender.id === realUser.id) continue;
        const already = await prisma.directMessage.findFirst({
          where: { senderId: sender.id, receiverId: realUser.id },
        });
        if (!already) {
          await prisma.directMessage.create({
            data: {
              senderId:   sender.id,
              receiverId: realUser.id,
              text:       intro.text,
              createdAt:  new Date(Date.now() - Math.floor(Math.random() * 3600 * 1000)),
            },
          });
        }
      }
      console.log(`  ✓ Intro DMs sent to ${realUser.name || realUser.phone}`);
    }
  }

  // 2b. Seed Direct Messages between dummy farmers
  console.log('\n📨 Seeding direct messages between dummy farmers...');
  let dmCount = 0;
  for (const thread of DM_THREADS) {
    const userA = createdUsers[thread.a];
    const userB = createdUsers[thread.b];

    // Create messages with staggered timestamps (each 3-5 min apart)
    let ts = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000); // 2 days ago
    for (const msg of thread.messages) {
      ts = new Date(ts.getTime() + Math.floor(Math.random() * 5 + 3) * 60 * 1000);
      const senderId  = msg.from === thread.a ? userA.id : userB.id;
      const receiverId = msg.from === thread.a ? userB.id : userA.id;

      await prisma.directMessage.create({
        data: { senderId, receiverId, text: msg.text, createdAt: ts },
      });
      dmCount++;
    }
    console.log(`  ✓ DM thread: ${userA.name} ↔ ${userB.name} (${thread.messages.length} messages)`);
  }
  console.log(`\n✅ ${dmCount} direct messages seeded\n`);

  // 3. Seed Groups + Members + Messages
  console.log('👥 Seeding community groups...');
  for (const gd of GROUPS_DATA) {
    const creator = createdUsers[gd.creatorIndex];

    // Upsert group by name
    const existing = await prisma.group.findFirst({ where: { name: gd.name } });
    if (existing) {
      await prisma.group.delete({ where: { id: existing.id } });
    }

    const group = await prisma.group.create({
      data: {
        name: gd.name,
        description: gd.description,
        avatar: gd.avatar,
        isPublic: gd.isPublic,
        district: gd.district,
        createdById: creator.id,
        memberCount: gd.memberIndices.length,
        lastMessage: gd.messages.at(-1)?.text?.slice(0, 60) || '',
        lastMessageAt: new Date(),
      },
    });

    // Add members (admin = creator, rest = MEMBER)
    for (const idx of gd.memberIndices) {
      const memberUser = createdUsers[idx];
      const isAdmin = idx === gd.creatorIndex;
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: memberUser.id } },
        create: { groupId: group.id, userId: memberUser.id, role: isAdmin ? 'ADMIN' : 'MEMBER' },
        update: {},
      });
    }

    // Seed group messages with timestamps
    let ts = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago
    for (const msg of gd.messages) {
      ts = new Date(ts.getTime() + Math.floor(Math.random() * 8 + 2) * 60 * 1000);
      const sender = createdUsers[msg.fromIdx];
      await prisma.groupMessage.create({
        data: {
          groupId: group.id,
          senderId: sender.id,
          text: msg.text,
          type: 'text',
          createdAt: ts,
        },
      });
    }

    // Add real users to this group automatically
    for (const realUser of realUsers) {
      await prisma.groupMember.upsert({
        where: { groupId_userId: { groupId: group.id, userId: realUser.id } },
        create: { groupId: group.id, userId: realUser.id, role: 'MEMBER' },
        update: {},
      });
    }

    console.log(`  ✓ Group: "${group.name}" — ${gd.memberIndices.length + realUsers.length} members, ${gd.messages.length} messages`);
  }

  if (realUsers.length > 0) {
    console.log(`\n  ✓ ${realUsers.length} real user(s) added to all 3 groups`);
  }

  console.log('\n🎉 Chat seed complete!\n');
  console.log('📱 Test users (login with these phone numbers):');
  FARMERS.forEach((f) => console.log(`   ${f.phone.padEnd(15)} → ${f.name} (${f.city}, ${f.district})`));
  console.log('\n💡 Use OTP: 123456 (dev mode) to login as any of these users.\n');
}

main()
  .catch((e) => { console.error('Chat seed error:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
