const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v'
];

let storage;

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

if (process.env.CLOUDINARY_CLOUD_NAME) {
  // Use Cloudinary if configured
  storage = new CloudinaryStorage({
    cloudinary: cloudinary,
    params: async (req, file) => {
      // Determine resource type based on mime type
      const isVideo = file.mimetype.startsWith('video/');
      return {
        folder: 'museum_uploads',
        resource_type: isVideo ? 'video' : 'image',
        allowed_formats: ['jpg', 'png', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mov']
      };
    },
  });
} else {
  // Fallback to local disk storage if Cloudinary is not configured
  const crypto = require('crypto');
  const fs = require('fs');
  if (!fs.existsSync(UPLOAD_DIR)) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }
  
  storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOAD_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      const name = crypto.randomBytes(12).toString('hex') + ext;
      cb(null, name);
    }
  });
}

function fileFilter(req, file, cb) {
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error('Only JPEG, PNG, WEBP, GIF images or MP4, WebM, QuickTime videos are allowed.'));
  }
  cb(null, true);
}

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB for photos and videos
});

module.exports = { upload, UPLOAD_DIR };
