import { verifyAccessToken } from '../utils/jwt.js';
import { sendUnauthorized, sendForbidden } from '../utils/response.js';
import prisma from '../config/db.js';

/**
 * Attach req.user from Bearer token. Sends 401 if missing/invalid.
 */
export async function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'Missing access token');
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyAccessToken(token);
    // Light check — user must still exist and be active
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, name: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) {
      return sendUnauthorized(res, 'Account not found or deactivated');
    }

    req.user = user;
    next();
  } catch {
    return sendUnauthorized(res, 'Invalid or expired token');
  }
}

/**
 * Role guard. Pass allowed roles: requireRole('ADMIN', 'VERIFIED_FARMER')
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return sendUnauthorized(res);
    if (!roles.includes(req.user.role)) {
      return sendForbidden(res, 'Insufficient permissions');
    }
    next();
  };
}

/**
 * Optional auth — attaches req.user if token present, but never blocks.
 */
export async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return next();

  try {
    const payload = verifyAccessToken(authHeader.slice(7));
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, phone: true, name: true, role: true, isActive: true },
    });
    if (user?.isActive) req.user = user;
  } catch {
    // ignore — optional
  }
  next();
}
