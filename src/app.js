import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { ENV } from './config/env.js';
import { sendError } from './utils/response.js';
import logger from './utils/logger.js';

// Routes
import authRoutes          from './routes/auth.routes.js';
import userRoutes          from './routes/user.routes.js';
import agriStoreRoutes     from './routes/agristore.routes.js';
import animalTradeRoutes   from './routes/animaltrade.routes.js';
import communityRoutes     from './routes/community.routes.js';
import cropDiseaseRoutes   from './routes/cropdisease.routes.js';
import groupsRoutes        from './routes/groups.routes.js';
import messagesRoutes      from './routes/messages.routes.js';
import uploadRoutes        from './routes/upload.routes.js';
// FarmMind AI + Weather
import aiRoutes            from './routes/ai.routes.js';
import weatherRoutes       from './routes/weather.routes.js';
import marketRoutes        from './routes/market.routes.js';
import plannerRoutes       from './routes/planner.routes.js';
import schemesRoutes       from './routes/schemes.routes.js';
// Rent marketplace
import rentRoutes          from './routes/rent.routes.js';
// Veterinary doctors (Pashu Sewa)
import doctorsRoutes       from './routes/doctors.routes.js';
// Saved delivery addresses
import addressesRoutes     from './routes/addresses.routes.js';
// ── New AI Services (Phase 1-4) ───────────────────────────────────────────────
import mandiRoutes         from './routes/mandi.routes.js';
import mspRoutes           from './routes/msp.routes.js';
import soilRoutes          from './routes/soil.routes.js';
import pestRoutes          from './routes/pest.routes.js';
import loanRoutes          from './routes/loan.routes.js';
import calendarRoutes      from './routes/calendar.routes.js';
import irrigationRoutes    from './routes/irrigation.routes.js';
import inputsRoutes        from './routes/inputs.routes.js';
import cropsRoutes         from './routes/crops.routes.js';
import featuresRoutes      from './routes/features.routes.js';

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
// [H1] Never reflect arbitrary origins in production.
// Mobile apps (React Native on device) send no Origin header → always allowed.
// Browser-based clients (admin panel, web) must be listed in ALLOWED_ORIGINS.
// In development with no list set, all origins are allowed for convenience.
app.use(cors({
  origin: (incomingOrigin, callback) => {
    // No Origin header → mobile app / curl / Postman → always allow
    if (!incomingOrigin) return callback(null, true);

    if (ENV.ALLOWED_ORIGINS.length) {
      // Explicit allowlist configured — enforce it in all environments
      return ENV.ALLOWED_ORIGINS.includes(incomingOrigin)
        ? callback(null, true)
        : callback(new Error(`CORS: origin "${incomingOrigin}" not allowed`));
    }

    // No allowlist: allow in dev, block browser origins in production
    if (ENV.IS_DEV) return callback(null, true);

    // Production without ALLOWED_ORIGINS set — log warning and block
    logger.warn(`[CORS] Blocked browser origin "${incomingOrigin}" — set ALLOWED_ORIGINS in .env`);
    callback(new Error('CORS: no allowed origins configured'));
  },
  credentials: true,
}));

// ── Compression ───────────────────────────────────────────────────────────────
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
// Morgan MUST be registered BEFORE body parsers.
// body-parser calls next(err) on 413/400, which jumps straight to error
// middleware — skipping every non-error middleware that hasn't run yet.
// If morgan is after body parsers it never registers its res.finish listener
// and multipart requests that are rejected by body-parser appear nowhere in logs.
if (ENV.IS_DEV) app.use(morgan('dev'));
else            app.use(morgan('tiny'));

// ── Body parsing ──────────────────────────────────────────────────────────────
// [H4] Upload route needs up to ~10 MB for base64-encoded images.
//      All other routes only need a few KB — cap tightly to prevent DoS.
//
// IMPORTANT: skip JSON/urlencoded parsing for multipart/form-data requests.
// Those routes use multer, which reads the raw stream itself.  If body-parser
// runs first on a multipart request it may reject with 413 (body > limit)
// before the request reaches the route handler or Morgan.
function skipMultipart(middleware) {
  return (req, res, next) => {
    if ((req.headers['content-type'] || '').startsWith('multipart/')) return next();
    return middleware(req, res, next);
  };
}

const API = ENV.API_PREFIX;
app.use(`${API}/upload`, skipMultipart(express.json({ limit: '10mb' })));
app.use(skipMultipart(express.json({ limit: '100kb' })));
app.use(skipMultipart(express.urlencoded({ extended: true, limit: '100kb' })));

// ── Global rate limit ─────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max:      ENV.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests' } },
}));

// ── Health check ──────────────────────────────────────────────────────────────
// [L4] Do NOT expose NODE_ENV — tells attackers whether verbose errors are on.
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use(`${API}/auth`,         authRoutes);
app.use(`${API}/users`,        userRoutes);
app.use(`${API}/agristore`,    agriStoreRoutes);
app.use(`${API}/animals`,      animalTradeRoutes);
app.use(`${API}/community`,    communityRoutes);
app.use(`${API}/crop-disease`, cropDiseaseRoutes);
app.use(`${API}/groups`,       groupsRoutes);
app.use(`${API}/messages`,     messagesRoutes);
app.use(`${API}/upload`,       uploadRoutes);
app.use(`${API}/rent`,         rentRoutes);
// FarmMind AI + Weather
app.use(`${API}/ai`,           aiRoutes);
app.use(`${API}/weather`,      weatherRoutes);
app.use(`${API}/market`,       marketRoutes);
app.use(`${API}/planner`,      plannerRoutes);
app.use(`${API}/schemes`,      schemesRoutes);
// Veterinary doctors
app.use(`${API}/doctors`,      doctorsRoutes);
app.use(`${API}/addresses`,    addressesRoutes);

// ── New AI Services ───────────────────────────────────────────────────────────
app.use(`${API}/mandi`,      mandiRoutes);
app.use(`${API}/msp`,        mspRoutes);
app.use(`${API}/soil`,       soilRoutes);
app.use(`${API}/pest`,       pestRoutes);
app.use(`${API}/loan`,       loanRoutes);
app.use(`${API}/calendar`,   calendarRoutes);
app.use(`${API}/irrigation`, irrigationRoutes);
app.use(`${API}/inputs`,     inputsRoutes);
app.use(`${API}/crops`,      cropsRoutes);
app.use(`${API}/admin`,      featuresRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => sendError(res, `Route ${req.method} ${req.path} not found`, 404));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  logger.error({ err }, '[Server Error]');
  sendError(res, ENV.IS_DEV ? err.message : 'Internal server error', 500);
});

export default app;
