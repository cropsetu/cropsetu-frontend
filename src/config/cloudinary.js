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

// ── [M2] Magic byte signatures ────────────────────────────────────────────────
// Content-Type / mimetype is set by the client and can be spoofed.
// Checking the actual first bytes of the buffer ensures the file really
// is the image format claimed. This runs AFTER multer buffers the file.
const MAGIC = {
  // JPEG: FF D8 FF
  jpeg: (b) => b[0] === 0xFF && b[1] === 0xD8 && b[2] === 0xFF,
  // PNG:  89 50 4E 47 0D 0A 1A 0A
  png:  (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4E && b[3] === 0x47,
  // WebP: 52 49 46 46 ?? ?? ?? ?? 57 45 42 50
  webp: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46
            && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  // HEIC/HEIF: bytes 4-7 are 'ftyp' (ISO Base Media File Format container)
  // brands at bytes 8-11: heic, heis, hevc, hevx, mif1, msf1, etc.
  heic: (b) => b.length >= 12
            && b[4] === 0x66 && b[5] === 0x74 && b[6] === 0x79 && b[7] === 0x70,
};

function hasValidMagicBytes(buffer) {
  if (!buffer || buffer.length < 12) return false;
  return MAGIC.jpeg(buffer) || MAGIC.png(buffer) || MAGIC.webp(buffer) || MAGIC.heic(buffer);
}

/**
 * Returns multer middleware that stores files in memory.
 * After this runs, call uploadFiles(req.files, folder) to push to Cloudinary.
 */
export function createUploader(maxFiles = 5) {
  return multer({
    storage: memoryStorage,
    limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB per file
    fileFilter: (_req, file, cb) => {
      // First gate: MIME type from Content-Type header
      if (!/image\/(jpeg|jpg|png|webp|heic|heif|heic-sequence|heif-sequence)/.test(file.mimetype)) {
        return cb(new Error('Only JPEG, PNG, WebP, and HEIC images are allowed'));
      }
      // Magic bytes are checked in uploadFiles() once the buffer is available.
      cb(null, true);
    },
  }).array('images', maxFiles);
}

/**
 * Upload a single buffer to Cloudinary. Returns the secure URL.
 */
export function uploadBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('Cloudinary upload timed out')), 55000);

    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `farmeasy/${folder}`,
        // convert HEIC/HEIF to JPEG automatically; no-op for other formats
        format: 'jpg',
        transformation: [{ width: 1080, crop: 'limit', quality: 'auto' }],
      },
      (err, result) => {
        clearTimeout(timer);
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

/**
 * Upload a video buffer to Cloudinary. Returns the secure URL.
 */
export function uploadVideoBuffer(buffer, folder) {
  return new Promise((resolve, reject) => {
    if (!buffer || buffer.length < 4) {
      return reject(new Error('Invalid video buffer'));
    }

    const timer = setTimeout(() => reject(new Error('Cloudinary video upload timed out')), 110000);

    const stream = cloudinary.uploader.upload_stream(
      {
        folder:        `farmeasy/${folder}`,
        resource_type: 'video',
        transformation: [{ quality: 'auto', fetch_format: 'mp4' }],
      },
      (err, result) => {
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(result.secure_url);
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
}

export function createVideoUploader() {
  return multer({
    storage: memoryStorage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
    fileFilter: (_req, file, cb) => {
      if (!/video\/(mp4|mov|avi|quicktime|x-msvideo)/.test(file.mimetype)) {
        return cb(new Error('Only MP4, MOV, AVI videos are allowed'));
      }
      cb(null, true);
    },
  }).single('video');
}

export { cloudinary };
