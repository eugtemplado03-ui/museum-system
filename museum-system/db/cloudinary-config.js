const cloudinary = require('cloudinary').v2;

let hasOverride = false;
let activeCloudinary = null;

function normalizeCredentials(credentials) {
  if (!credentials) return null;
  const cloudName = String(credentials.cloudName || '').trim();
  const apiKey = String(credentials.apiKey || '').trim();
  const apiSecret = String(credentials.apiSecret || '').trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return { cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret };
}

function configureCloudinary(credentials) {
  const normalized = normalizeCredentials(credentials);
  hasOverride = true;
  if (!normalized) {
    cloudinary.config({ cloud_name: '', api_key: '', api_secret: '' });
    activeCloudinary = null;
    return null;
  }
  cloudinary.config(normalized);
  activeCloudinary = cloudinary;
  return cloudinary;
}

function getCloudinary() {
  if (hasOverride) return activeCloudinary;
  if (!activeCloudinary) {
    const environment = normalizeCredentials({
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET
    });
    if (!environment) return null;
    return configureCloudinary({
      cloudName: environment.cloud_name,
      apiKey: environment.api_key,
      apiSecret: environment.api_secret
    });
  }
  return activeCloudinary;
}

module.exports = { configureCloudinary, getCloudinary };
