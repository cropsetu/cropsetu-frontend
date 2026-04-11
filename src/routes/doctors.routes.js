/**
 * Public Veterinary Doctor Routes (Farmer App)
 * GET  /api/v1/doctors            — list verified doctors (filters: district, animalType, service, search)
 * GET  /api/v1/doctors/nearby     — geo-based search by lat/lng
 * GET  /api/v1/doctors/:id        — full doctor profile
 * POST /api/v1/doctors/:id/review         — submit rating + review (auth required)
 * GET  /api/v1/doctors/:id/reviews        — list reviews
 * POST /api/v1/doctors/:id/track-call     — track call click
 * POST /api/v1/doctors/:id/track-whatsapp — track WhatsApp click
 */
import { Router } from 'express';
import prisma from '../config/db.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError, sendNotFound, paginationMeta } from '../utils/response.js';

const router = Router();

// ── Helpers ───────────────────────────────────────────────────────────────────

const ANIMAL_LABELS = {
  cow:      { en: 'Cow',      mr: 'गाय' },
  buffalo:  { en: 'Buffalo',  mr: 'म्हैस' },
  goat:     { en: 'Goat',     mr: 'शेळी' },
  sheep:    { en: 'Sheep',    mr: 'मेंढी' },
  poultry:  { en: 'Poultry',  mr: 'कुक्कुट' },
  horse:    { en: 'Horse',    mr: 'घोडा' },
  pig:      { en: 'Pig',      mr: 'डुक्कर' },
  dog:      { en: 'Dog',      mr: 'कुत्रा' },
  cat:      { en: 'Cat',      mr: 'मांजर' },
  fish:     { en: 'Fish',     mr: 'मत्स्य' },
  rabbit:   { en: 'Rabbit',   mr: 'ससा' },
  camel:    { en: 'Camel',    mr: 'उंट' },
  other:    { en: 'Other',    mr: 'इतर' },
};

const SERVICE_LABELS = {
  general_checkup:         { en: 'General Checkup',          mr: 'सामान्य तपासणी' },
  vaccination:             { en: 'Vaccination',               mr: 'लसीकरण' },
  deworming:               { en: 'Deworming',                 mr: 'जंतनाशक' },
  surgery:                 { en: 'Surgery',                   mr: 'शस्त्रक्रिया' },
  artificial_insemination: { en: 'Artificial Insemination',   mr: 'कृत्रिम रेतन' },
  pregnancy_diagnosis:     { en: 'Pregnancy Diagnosis',       mr: 'गर्भ निदान' },
  emergency:               { en: 'Emergency',                 mr: 'आपत्कालीन सेवा' },
  skin_treatment:          { en: 'Skin Treatment',            mr: 'त्वचा उपचार' },
  mastitis_treatment:      { en: 'Mastitis Treatment',        mr: 'स्तनदाह उपचार' },
  infertility_treatment:   { en: 'Infertility Treatment',     mr: 'वंध्यत्व उपचार' },
  postmortem:              { en: 'Post-mortem',               mr: 'शवविच्छेदन' },
  feed_nutrition_advice:   { en: 'Feed & Nutrition Advice',   mr: 'खाद्य व पोषण सल्ला' },
  farm_visit:              { en: 'Farm Visit',                mr: 'फार्म भेट' },
  telemedicine:            { en: 'Telemedicine',              mr: 'दूरस्थ सल्ला' },
};

const DAY_LABELS = {
  mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu',
  fri: 'Fri', sat: 'Sat', sun: 'Sun',
};

function formatDoctor(doc) {
  return {
    id:                 doc.id,
    fullName:           { en: doc.fullNameEn, mr: doc.fullNameMr },
    phone:              doc.phone,
    altPhone:           doc.altPhone,
    profilePhoto:       doc.profilePhoto,
    gender:             doc.gender,
    address: {
      village:  doc.village,
      taluka:   doc.taluka,
      district: doc.district,
      state:    doc.state,
      pincode:  doc.pincode,
    },
    location:           doc.latitude ? { lat: doc.latitude, lng: doc.longitude } : null,
    registrationNumber: doc.registrationNumber,
    councilName:        doc.councilName,
    experienceYears:    doc.experienceYears,
    qualifications:     doc.qualifications,
    practiceType:       doc.practiceType,
    clinicName:         doc.clinicName,
    clinicAddress:      doc.clinicAddress,
    clinicPhotos:       doc.clinicPhotos,
    animalTypes:        doc.animalTypes,
    animalLabels:       doc.animalTypes.map(a => ANIMAL_LABELS[a] || { en: a, mr: a }),
    services:           doc.services,
    serviceLabels:      doc.services.map(s => SERVICE_LABELS[s] || { en: s, mr: s }),
    availability: {
      days:              doc.availableDays,
      dayLabels:         doc.availableDays.map(d => DAY_LABELS[d] || d),
      startTime:         doc.startTime,
      endTime:           doc.endTime,
      emergencyAvailable: doc.emergencyAvailable,
    },
    consultationFee:    doc.consultationFee,
    visitFee:           doc.visitFee,
    feeNote:            doc.feeNoteEn ? { en: doc.feeNoteEn, mr: doc.feeNoteMr } : null,
    languages:          doc.languages,
    rating: {
      average: doc.ratingAverage,
      count:   doc.ratingCount,
    },
    isActive:           doc.isActive,
    priority:           doc.priority,
    stats: {
      profileViews:   doc.profileViews,
      callClicks:     doc.callClicks,
      whatsappClicks: doc.whatsappClicks,
    },
  };
}

// ── GET /api/v1/doctors ───────────────────────────────────────────────────────
// Query: district, animalType, service, search, page, limit, sort
router.get('/', async (req, res) => {
  const {
    district, animalType, service, search,
    page = 1, limit = 20, sort = 'rating',
    emergency,
  } = req.query;

  const pageNum  = Math.max(1, parseInt(page));
  const limitNum = Math.min(50, parseInt(limit));
  const skip     = (pageNum - 1) * limitNum;

  // Build Prisma where clause
  const where = { isListed: true };

  if (district)    where.district    = { equals: district, mode: 'insensitive' };
  if (animalType)  where.animalTypes = { has: animalType };
  if (service)     where.services    = { has: service };
  if (emergency === 'true') where.emergencyAvailable = true;

  if (search) {
    where.OR = [
      { fullNameEn:  { contains: search, mode: 'insensitive' } },
      { fullNameMr:  { contains: search, mode: 'insensitive' } },
      { clinicName:  { contains: search, mode: 'insensitive' } },
      { village:     { contains: search, mode: 'insensitive' } },
      { taluka:      { contains: search, mode: 'insensitive' } },
      { district:    { contains: search, mode: 'insensitive' } },
    ];
  }

  const orderBy = sort === 'fee_asc'
    ? [{ consultationFee: 'asc' }]
    : sort === 'fee_desc'
    ? [{ consultationFee: 'desc' }]
    : [{ priority: 'desc' }, { ratingAverage: 'desc' }, { ratingCount: 'desc' }];

  const [total, doctors] = await Promise.all([
    prisma.veterinaryDoctor.count({ where }),
    prisma.veterinaryDoctor.findMany({ where, orderBy, skip, take: limitNum }),
  ]);

  return sendSuccess(
    res,
    doctors.map(formatDoctor),
    200,
    paginationMeta(total, pageNum, limitNum),
  );
});

// ── GET /api/v1/doctors/nearby ────────────────────────────────────────────────
// Query: lat, lng, radius (km, default 25), animalType, service, limit
router.get('/nearby', async (req, res) => {
  const { lat, lng, radius = 25, animalType, service, limit = 20 } = req.query;

  if (!lat || !lng) {
    return sendError(res, 'lat and lng are required', 400);
  }

  const latF  = parseFloat(lat);
  const lngF  = parseFloat(lng);
  const radKm = Math.min(200, parseFloat(radius));

  // Bounding-box pre-filter (1 degree ≈ 111 km)
  const delta = radKm / 111;

  const where = {
    isListed:  true,
    latitude:  { gte: latF - delta, lte: latF + delta },
    longitude: { gte: lngF - delta, lte: lngF + delta },
  };
  if (animalType) where.animalTypes = { has: animalType };
  if (service)    where.services    = { has: service };

  const doctors = await prisma.veterinaryDoctor.findMany({
    where,
    take: Math.min(50, parseInt(limit)),
    orderBy: [{ priority: 'desc' }, { ratingAverage: 'desc' }],
  });

  // Compute real distance and sort
  const withDist = doctors
    .map(d => {
      if (!d.latitude || !d.longitude) return { ...d, distanceKm: null };
      const dLat = ((d.latitude - latF) * Math.PI) / 180;
      const dLng = ((d.longitude - lngF) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((latF * Math.PI) / 180) *
          Math.cos((d.latitude * Math.PI) / 180) *
          Math.sin(dLng / 2) ** 2;
      const distKm = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return { ...d, distanceKm: Math.round(distKm * 10) / 10 };
    })
    .filter(d => d.distanceKm === null || d.distanceKm <= radKm)
    .sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));

  return sendSuccess(
    res,
    withDist.map(d => ({ ...formatDoctor(d), distanceKm: d.distanceKm })),
  );
});

// ── GET /api/v1/doctors/:id ───────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  const doctor = await prisma.veterinaryDoctor.findUnique({
    where: { id: req.params.id },
  });

  if (!doctor || !doctor.isListed) return sendNotFound(res, 'Doctor');

  // Increment profile view (fire-and-forget)
  prisma.veterinaryDoctor.update({
    where: { id: doctor.id },
    data:  { profileViews: { increment: 1 } },
  }).catch(() => {});

  return sendSuccess(res, formatDoctor(doctor));
});

// ── GET /api/v1/doctors/:id/reviews ──────────────────────────────────────────
router.get('/:id/reviews', async (req, res) => {
  const { page = 1, limit = 10 } = req.query;
  const pageNum  = Math.max(1, parseInt(page));
  const limitNum = Math.min(30, parseInt(limit));
  const skip     = (pageNum - 1) * limitNum;

  const doctor = await prisma.veterinaryDoctor.findUnique({
    where:  { id: req.params.id },
    select: { id: true, isListed: true },
  });
  if (!doctor || !doctor.isListed) return sendNotFound(res, 'Doctor');

  const where = { doctorId: req.params.id, isVisible: true };
  const [total, reviews] = await Promise.all([
    prisma.doctorReview.count({ where }),
    prisma.doctorReview.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limitNum,
      select: { id: true, farmerName: true, rating: true, comment: true, createdAt: true },
    }),
  ]);

  return sendSuccess(res, reviews, 200, paginationMeta(total, pageNum, limitNum));
});

// ── POST /api/v1/doctors/:id/review ──────────────────────────────────────────
router.post('/:id/review', authenticate, async (req, res) => {
  const { rating, comment } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return sendError(res, 'rating must be 1–5', 400);
  }

  const doctor = await prisma.veterinaryDoctor.findUnique({
    where:  { id: req.params.id },
    select: { id: true, isListed: true, ratingAverage: true, ratingCount: true },
  });
  if (!doctor || !doctor.isListed) return sendNotFound(res, 'Doctor');

  // Upsert — one review per farmer per doctor
  const existing = await prisma.doctorReview.findUnique({
    where: { doctorId_userId: { doctorId: doctor.id, userId: req.user.id } },
  });

  const review = existing
    ? await prisma.doctorReview.update({
        where: { id: existing.id },
        data:  { rating: parseInt(rating), comment: comment?.slice(0, 500) },
      })
    : await prisma.doctorReview.create({
        data: {
          doctorId:   doctor.id,
          userId:     req.user.id,
          farmerName: req.user.name || 'शेतकरी',
          rating:     parseInt(rating),
          comment:    comment?.slice(0, 500),
        },
      });

  // Recalculate rating average
  const agg = await prisma.doctorReview.aggregate({
    where:   { doctorId: doctor.id, isVisible: true },
    _avg:    { rating: true },
    _count:  { rating: true },
  });

  await prisma.veterinaryDoctor.update({
    where: { id: doctor.id },
    data: {
      ratingAverage: Math.round((agg._avg.rating || 0) * 10) / 10,
      ratingCount:   agg._count.rating,
    },
  });

  return sendSuccess(res, review, 201);
});

// ── POST /api/v1/doctors/:id/track-call ──────────────────────────────────────
router.post('/:id/track-call', async (req, res) => {
  await prisma.veterinaryDoctor.update({
    where: { id: req.params.id },
    data:  { callClicks: { increment: 1 } },
  }).catch(() => {});
  return sendSuccess(res, { tracked: true });
});

// ── POST /api/v1/doctors/:id/track-whatsapp ───────────────────────────────────
router.post('/:id/track-whatsapp', async (req, res) => {
  await prisma.veterinaryDoctor.update({
    where: { id: req.params.id },
    data:  { whatsappClicks: { increment: 1 } },
  }).catch(() => {});
  return sendSuccess(res, { tracked: true });
});

export default router;
