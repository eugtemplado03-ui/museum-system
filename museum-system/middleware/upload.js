// Configures local/Cloudinary media uploads with extension, MIME, and size checks.
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const apiManagement = require('../db/api-management');
const cloudinaryConfig = require('../db/cloudinary-config');

const ALLOWED_TYPES = [
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime', 'video/x-m4v'
];

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, '..', 'uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const localStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const name = crypto.randomBytes(12).toString('hex') + ext;
    cb(null, name);
  }
});

const remoteStorage = new CloudinaryStorage({
  cloudinary,
  params: async (req, file) => ({
    folder: 'museum_uploads',
    resource_type: file.mimetype.startsWith('video/') ? 'video' : 'image',
    allowed_formats: ['jpg', 'png', 'webp', 'gif', 'mp4', 'webm', 'ogg', 'mov']
  })
});

const ALLOWED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.mp4', '.webm', '.ogg', '.mov', '.m4v'];
const DANGEROUS_EXTENSIONS = ['.html', '.htm', '.svg', '.xml', '.php', '.phtml', '.js', '.sh', '.exe', '.bat', '.cmd', '.py', '.msi', '.vbs', '.jsp'];

// Reject unsafe extensions and mismatches between file extensions and MIME families.
function fileFilter(req, file, cb) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  
  // Reject missing or dangerous extensions immediately
  if (!ext || DANGEROUS_EXTENSIONS.includes(ext) || !ALLOWED_EXTENSIONS.includes(ext)) {
    return cb(new Error('Invalid file extension. Only standard photos (JPG, PNG, WEBP, GIF) and videos (MP4, WebM, MOV) are allowed.'));
  }

  // Reject disallowed MIME types
  if (!ALLOWED_TYPES.includes(file.mimetype)) {
    return cb(new Error('Invalid file MIME type. Only JPEG, PNG, WEBP, GIF images or MP4, WebM, QuickTime videos are allowed.'));
  }

  // Cross-verify extension matches MIME family
  const isImageMime = file.mimetype.startsWith('image/');
  const isVideoMime = file.mimetype.startsWith('video/');
  const isImageExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext);
  const isVideoExt = ['.mp4', '.webm', '.ogg', '.mov', '.m4v'].includes(ext);

  if ((isImageMime && !isImageExt) || (isVideoMime && !isVideoExt)) {
    return cb(new Error('File extension does not match the content type.'));
  }

  cb(null, true);
}

const uploadOptions = {
  fileFilter,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB for photos and videos
};
const localUpload = multer({ ...uploadOptions, storage: localStorage });
const remoteUpload = multer({ ...uploadOptions, storage: remoteStorage });

const upload = {
  // Select storage from the latest Cloudinary settings before running Multer.
  single(fieldName) {
    return async (req, res, next) => {
      try {
        const configuration = await apiManagement.getCloudinaryConfiguration();
        const useCloudinary = configuration.configured;
        cloudinaryConfig.configureCloudinary(useCloudinary ? configuration.credentials : null);
        const middleware = (useCloudinary ? remoteUpload : localUpload).single(fieldName);
        middleware(req, res, next);
      } catch (err) {
        next(err);
      }
    };
  }
};

module.exports = { upload, UPLOAD_DIR };
