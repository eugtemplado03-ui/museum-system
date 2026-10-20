const crypto = require('crypto');
const mongoose = require('mongoose');
const { encryptCredential, decryptCredential } = require('./api-credential-encryption');

const apiCredentialSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  encryptedKey: { type: String, default: undefined, select: false },
  iv: { type: String, default: undefined, select: false },
  authTag: { type: String, default: undefined, select: false },
  disabled: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

const ApiCredential = mongoose.models.ApiCredential || mongoose.model('ApiCredential', apiCredentialSchema);

function getEnvironmentCloudinaryConfiguration() {
  const credentials = {
    cloudName: (process.env.CLOUDINARY_CLOUD_NAME || '').trim(),
    apiKey: (process.env.CLOUDINARY_API_KEY || '').trim(),
    apiSecret: (process.env.CLOUDINARY_API_SECRET || '').trim()
  };
  const configured = Boolean(credentials.cloudName && credentials.apiKey && credentials.apiSecret);
  return {
    credentials,
    configured,
    source: configured ? 'environment' : 'none'
  };
}

async function getCloudinaryConfiguration() {
  const environment = getEnvironmentCloudinaryConfiguration();
  if (mongoose.connection.readyState !== 1) {
    return { ...environment, environmentConfigured: environment.configured };
  }

  const saved = await ApiCredential.findOne({ id: 'cloudinary' })
    .select('+encryptedKey +iv +authTag')
    .lean();
  if (saved?.disabled) {
    return {
      credentials: null,
      configured: false,
      source: 'disabled',
      environmentConfigured: environment.configured
    };
  }
  if (saved?.encryptedKey) {
    const credentials = JSON.parse(decryptCredential(saved));
    return {
      credentials,
      configured: Boolean(credentials.cloudName && credentials.apiKey && credentials.apiSecret),
      source: 'dashboard',
      environmentConfigured: environment.configured
    };
  }
  return { ...environment, environmentConfigured: environment.configured };
}

async function saveCloudinaryConfiguration(credentials) {
  const encrypted = encryptCredential(JSON.stringify(credentials));
  await ApiCredential.findOneAndUpdate(
    { id: 'cloudinary' },
    {
      $set: {
        name: 'Cloudinary',
        ...encrypted,
        disabled: false,
        updatedAt: new Date()
      }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return getCloudinaryConfiguration();
}

async function disableCloudinaryConfiguration() {
  await ApiCredential.findOneAndUpdate(
    { id: 'cloudinary' },
    {
      $set: { name: 'Cloudinary', disabled: true, updatedAt: new Date() },
      $unset: { encryptedKey: 1, iv: 1, authTag: 1 }
    },
    { upsert: true, setDefaultsOnInsert: true }
  );
  return getCloudinaryConfiguration();
}

async function useEnvironmentCloudinaryConfiguration() {
  await ApiCredential.deleteOne({ id: 'cloudinary' });
  return getCloudinaryConfiguration();
}

async function listCustomProviders() {
  const providers = await ApiCredential.find({ id: /^custom-/ })
    .select('id name disabled updatedAt')
    .sort({ name: 1 })
    .lean();
  return providers.map(provider => ({
    id: provider.id,
    name: provider.name,
    configured: !provider.disabled,
    source: provider.disabled ? 'disabled' : 'dashboard',
    updatedAt: provider.updatedAt
  }));
}

async function saveCustomProvider(name, apiKey, id = null) {
  const isNew = id === null;
  const providerId = isNew ? `custom-${crypto.randomUUID()}` : id;
  if (!isNew && !/^custom-[a-f0-9-]{36}$/.test(providerId)) {
    throw new Error('Custom API provider was not found.');
  }
  if (!isNew && !await ApiCredential.exists({ id: providerId })) {
    throw new Error('Custom API provider was not found.');
  }
  const encrypted = encryptCredential(apiKey);
  const result = await ApiCredential.findOneAndUpdate(
    { id: providerId },
    {
      $set: {
        name,
        ...encrypted,
        disabled: false,
        updatedAt: new Date()
      },
      ...(isNew ? { $setOnInsert: { id: providerId } } : {})
    },
    { upsert: isNew, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  if (!result) throw new Error('Custom API provider was not found.');
  return {
    id: result.id,
    name: result.name,
    configured: true,
    source: 'dashboard',
    updatedAt: result.updatedAt
  };
}

async function removeCustomProvider(id) {
  if (typeof id !== 'string' || !/^custom-[a-f0-9-]{36}$/.test(id)) return false;
  const result = await ApiCredential.deleteOne({ id });
  return result.deletedCount === 1;
}

module.exports = {
  ApiCredential,
  getCloudinaryConfiguration,
  saveCloudinaryConfiguration,
  disableCloudinaryConfiguration,
  useEnvironmentCloudinaryConfiguration,
  listCustomProviders,
  saveCustomProvider,
  removeCustomProvider
};
