import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';

import { ENV } from './config/env.js';
import { sendError } from './utils/response.js';

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

const app = express();

// ── Security headers ──────────────────────────────────────────────────────────
app.use(helmet());

// ── CORS ──────────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ENV.ALLOWED_ORIGINS.length ? ENV.ALLOWED_ORIGINS : true,
  credentials: true,
}));

// ── Body parsing ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' })); // raised for base64 image uploads
app.use(express.urlencoded({ extended: true }));
app.use(compression());

// ── Logging ───────────────────────────────────────────────────────────────────
if (ENV.IS_DEV) app.use(morgan('dev'));
else            app.use(morgan('combined'));

// ── Global rate limit ─────────────────────────────────────────────────────────
app.use(rateLimit({
  windowMs: ENV.RATE_LIMIT_WINDOW_MS,
  max:      ENV.RATE_LIMIT_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: { message: 'Too many requests' } },
}));

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', env: ENV.NODE_ENV }));

// ── API Routes ────────────────────────────────────────────────────────────────
const API = ENV.API_PREFIX;

app.use(`${API}/auth`,         authRoutes);
app.use(`${API}/users`,        userRoutes);
app.use(`${API}/agristore`,    agriStoreRoutes);
app.use(`${API}/animals`,      animalTradeRoutes);
app.use(`${API}/community`,    communityRoutes);
app.use(`${API}/crop-disease`, cropDiseaseRoutes);
app.use(`${API}/groups`,       groupsRoutes);
app.use(`${API}/messages`,     messagesRoutes);
app.use(`${API}/upload`,       uploadRoutes);

// ── 404 ───────────────────────────────────────────────────────────────────────
app.use((req, res) => sendError(res, `Route ${req.method} ${req.path} not found`, 404));

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line no-unused-vars
app.use((err, _req, res, _next) => {
  console.error('[Server Error]', err);
  sendError(res, ENV.IS_DEV ? err.message : 'Internal server error', 500);
});

export default app;
