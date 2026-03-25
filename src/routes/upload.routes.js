/**
 * Upload Routes
 * POST /upload/image  — accepts { base64: string } JSON → returns { url }
 *
 * Using base64 JSON instead of multipart avoids React Native / axios
 * FormData boundary issues entirely. No multer needed.
 */
import { Router } from 'express';
import { uploadBuffer } from '../config/cloudinary.js';
import { authenticate } from '../middleware/auth.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { ENV } from '../config/env.js';

const router = Router();

router.post('/image', authenticate, async (req, res) => {
  const { base64 } = req.body;
  if (!base64 || typeof base64 !== 'string') {
    return sendError(res, 'base64 image data is required', 400);
  }

  // Dev fallback when Cloudinary is not configured
  if (!ENV.CLOUDINARY_CLOUD_NAME) {
    console.warn('[Upload] Cloudinary not configured — returning placeholder URL');
    return sendSuccess(res, { url: 'https://placehold.co/400x400/E65100/fff?text=Product' });
  }

  try {
    const buffer = Buffer.from(base64, 'base64');
    const url = await uploadBuffer(buffer, 'products');
    return sendSuccess(res, { url });
  } catch (e) {
    console.error('[Upload] Cloudinary error:', e.message);
    return sendError(res, 'Image upload failed', 500);
  }
});

export default router;
