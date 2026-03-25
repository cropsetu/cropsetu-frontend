import { v2 as cloudinary } from 'cloudinary';
import multer from 'multer';
import streamifier from 'streamifier';
import { ENV } from './env.js';

cloudinary.config({
  cloud_name: ENV.CLOUDINARY_CLOUD_NAME,
  api_key:    ENV.CLOUDINARY_API_KEY,
  api_secret: ENV.CLOUDINARY_API_SECRET,
});

// Store files in memory, then stream to Cloudinary manually
const memoryStorage = multer.memoryStorage();

/**
 * Returns multer middleware that stores files in memory.
 * After this runs, call uploadFiles(req.files, folder) to push to Cloudinary.
 */
export function createUploader(maxFiles = 5) {
  return multer({
    storage: memoryStorage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
    fileFilter: (_req, file, cb) => {
      if (/image\/(jpeg|jpg|png|webp)/.test(file.mimetype)) cb(null, true);
      else cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    },
  }).array('images', maxFiles);
}

/**
 * Upload a single buffer to Cloudinary. Returns the secure URL.
 */
export function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `farmeasy/${folder}`,
        transformation: [{ width: 1080, crop: 'limit', quality: 'auto' }],
      },
      (err, result) => {
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

/**
 * Upload all req.files buffers to Cloudinary. Returns array of secure URLs.
 * Returns [] silently if Cloudinary is not configured (safe in dev).
 */
export async function uploadFiles(files = [], folder) {
  if (!files.length) return [];
  if (!ENV.CLOUDINARY_CLOUD_NAME) {
    console.warn('[Cloudinary] Not configured — skipping upload');
    return [];
  }
  return Promise.all(files.map((f) => uploadBuffer(f.buffer, folder)));
}

export { cloudinary };
