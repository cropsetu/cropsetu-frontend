/**
 * Mandi Price Service — data.gov.in integration
 *
 * Primary: data.gov.in /resource/current-daily-price-various-commodities-various-centres
 * Fallback: Serve latest cached records from DB with stale timestamp warning
 *
 * Cache strategy:
 *   - DB cache for 4 hours (expiresAt field)
 *   - L1 in-memory for 30 min per commodity+state query
 *
 * NEVER show fabricated prices. If both live and cache are unavailable,
 * return an error. Always show source + timestamp.
 *
 * data.gov.in API key (free, 1000 req/day):
 *   Set DATA_GOV_API_KEY in .env
 *   Get at: https://data.gov.in
 */
import axios from 'axios';
import prisma from '../config/db.js';
import { ENV } from '../config/env.js';

const DATA_GOV_BASE     = 'https://api.data.gov.in/resource/9ef84268-d588-465a-a308-a864a43d0070';
const CACHE_TTL_MS      = 4 * 60 * 60 * 1000;  // 4 hours
const MEM_TTL_MS        = 30 * 60 * 1000;        // 30 min
const MAX_MEM_ENTRIES   = 200;

// ── L1: in-memory ─────────────────────────────────────────────────────────────
const _mem = new Map();
function memGet(k) {
  const e = _mem.get(k);
  if (!e || Date.now() > e.exp) { _mem.delete(k); return null; }
  return e.data;
}
function memSet(k, data) {
  if (_mem.size >= MAX_MEM_ENTRIES) { const first = _mem.keys().next().value; _mem.delete(first); }
  _mem.set(k, { data, exp: Date.now() + MEM_TTL_MS });
}

// ── Commodity name normaliser (API uses different names) ─────────────────────
const COMMODITY_MAP = {
  soybean: 'Soyabean',     soybeans: 'Soyabean',
  tomato: 'Tomato',        onion: 'Onion',
  cotton: 'Cotton',        wheat: 'Wheat',
  maize: 'Maize',          rice: 'Rice',
  gram: 'Gram',            tur: 'Arhar/Tur',
  arhar: 'Arhar/Tur',      groundnut: 'Groundnut',
  sugarcane: 'Sugarcane',  potato: 'Potato',
  bajra: 'Bajra',          jowar: 'Jowar',
  sunflower: 'Sunflower Seed',
};
function normaliseCommodity(name) {
  return COMMODITY_MAP[name?.toLowerCase()] || name;
}

// ── Log API health ────────────────────────────────────────────────────────────
async function logHealth(status, endpoint, responseTimeMs, errorMessage = null, payloadSizeBytes = null) {
  await prisma.aPIHealthLog.create({
    data: { source: 'data_gov_in', endpoint, status, responseTimeMs, payloadSizeBytes, errorMessage },
  }).catch(() => {});
}

// ── Fetch from data.gov.in ────────────────────────────────────────────────────
async function fetchFromDataGovIn(commodity, state, district = null) {
  if (!ENV.DATA_GOV_API_KEY) throw new Error('DATA_GOV_API_KEY not configured');

  const apiCommodity = normaliseCommodity(commodity);
  const params = {
    'api-key': ENV.DATA_GOV_API_KEY,
    format:    'json',
    limit:     50,
    'filters[commodity]': apiCommodity,
    'filters[state]':     state,
  };
  if (district) params['filters[district]'] = district;

  const t0 = Date.now();
  const response = await axios.get(DATA_GOV_BASE, {
    params,
    timeout: 10000,
    headers: { 'User-Agent': 'FarmEasy/1.0 (farmeasy.app)' },
  });
  const elapsed = Date.now() - t0;
  const payloadSize = JSON.stringify(response.data).length;

  await logHealth('success', DATA_GOV_BASE, elapsed, null, payloadSize);

  const records = response.data?.records || [];
  return records.map(r => ({
    commodity:    r.commodity   || apiCommodity,
    commodityHi:  null,
    variety:      r.variety     || null,
    market:       r.market      || r.Market || '',
    district:     r.district    || r.District || district || '',
    state:        r.state       || r.State || state,
    minPrice:     parseFloat(r.min_price   || r.MinPrice  || 0),
    maxPrice:     parseFloat(r.max_price   || r.MaxPrice  || 0),
    modalPrice:   parseFloat(r.modal_price || r.ModalPrice || 0),
    arrivalQty:   parseFloat(r.arrival_qty || r.ArrivalQty || 0) || null,
    priceDate:    r.arrival_date ? new Date(r.arrival_date) : new Date(),
    source:       'data.gov.in',
    fetchedAt:    new Date(),
    expiresAt:    new Date(Date.now() + CACHE_TTL_MS),
  }));
}

// ── Persist to DB (upsert-by-commodity+market+date) ─────────────────────────
async function persistToDB(records) {
  for (const r of records) {
    await prisma.mandiPrice.upsert({
      where: {
        // Use findFirst logic with a unique combo create (no schema unique constraint — use createMany)
        id: 'dummy-will-not-match',
      },
      create: r,
      update: r,
    }).catch(async () => {
      // upsert without unique — just create if doesn't exist recently
      const existing = await prisma.mandiPrice.findFirst({
        where: { commodity: r.commodity, market: r.market, priceDate: r.priceDate },
      });
      if (!existing) await prisma.mandiPrice.create({ data: r }).catch(() => {});
      else await prisma.mandiPrice.update({ where: { id: existing.id }, data: { modalPrice: r.modalPrice, minPrice: r.minPrice, maxPrice: r.maxPrice, fetchedAt: r.fetchedAt, expiresAt: r.expiresAt } }).catch(() => {});
    });
  }
}

// ── Main: get prices (live → L1 mem → DB cache) ───────────────────────────────
export async function getMandiPrices(commodity, state, district = null) {
  const key = `${commodity.toLowerCase()}|${state.toLowerCase()}|${district || ''}`;
  const cached = memGet(key);
  if (cached) return { data: cached, stale: false, source: 'cache' };

  // Try live data.gov.in
  try {
    const records = await fetchFromDataGovIn(commodity, state, district);
    if (records.length > 0) {
      persistToDB(records).catch(() => {});
      memSet(key, records);
      return { data: records, stale: false, source: 'data.gov.in', fetchedAt: new Date().toISOString() };
    }
  } catch (err) {
    const status = err.response?.status === 429 ? 'rate_limited' : (err.code === 'ECONNABORTED' ? 'timeout' : 'failure');
    await logHealth(status, DATA_GOV_BASE, null, err.message?.slice(0, 200)).catch(() => {});
    console.warn('[MandiPrice] data.gov.in failed:', err.message);
  }

  // Fallback: DB cache (last 7 days)
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const dbRecords = await prisma.mandiPrice.findMany({
    where: {
      commodity: { contains: normaliseCommodity(commodity), mode: 'insensitive' },
      state:     { contains: state, mode: 'insensitive' },
      priceDate: { gte: since },
    },
    orderBy: { priceDate: 'desc' },
    take: 30,
  });

  if (dbRecords.length > 0) {
    memSet(key, dbRecords);
    return { data: dbRecords, stale: true, source: 'cache', cachedAt: dbRecords[0].fetchedAt?.toISOString() };
  }

  return { data: [], stale: false, source: 'unavailable' };
}

// ── Price trend (7/30 days) for a commodity+market ────────────────────────────
export async function getPriceTrend(commodity, market, days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const records = await prisma.mandiPrice.findMany({
    where: {
      commodity: { contains: normaliseCommodity(commodity), mode: 'insensitive' },
      market:    { contains: market, mode: 'insensitive' },
      priceDate: { gte: since },
    },
    orderBy: { priceDate: 'asc' },
    select:  { priceDate: true, modalPrice: true, minPrice: true, maxPrice: true, arrivalQty: true },
  });
  return records;
}

// ── Nearby mandis by lat/lng ──────────────────────────────────────────────────
// Since Agmarknet/data.gov.in don't expose lat/lng, we use district → mandi mapping
const DISTRICT_MANDIS = {
  'pune':       ['Pune', 'Pimpri', 'Shirur', 'Junnar'],
  'nashik':     ['Nashik', 'Igatpuri', 'Lasalgaon'],
  'latur':      ['Latur', 'Udgir', 'Nilanga'],
  'aurangabad': ['Aurangabad', 'Gangapur', 'Paithan'],
  'solapur':    ['Solapur', 'Pandharpur', 'Barshi'],
  'ahmednagar': ['Ahmednagar', 'Shrirampur', 'Rahata'],
  'kolhapur':   ['Kolhapur', 'Ichalkaranji', 'Sangli'],
  'jalgaon':    ['Jalgaon', 'Bhusawal', 'Pachora'],
  'amravati':   ['Amravati', 'Akola', 'Washim'],
  'nagpur':     ['Nagpur', 'Wardha', 'Yavatmal'],
};

export function getNearbyMandiNames(district) {
  const key = district?.toLowerCase().replace(/\s+/g, '') || '';
  for (const [k, v] of Object.entries(DISTRICT_MANDIS)) {
    if (key.includes(k)) return v;
  }
  return [];
}
