const crypto = require('crypto');
const mongoose = require('mongoose');
const { JWT_SECRET } = require('../middleware/auth');

const KEY_ID = 'groq-chatbot';
const ENCRYPTION_KEY = Buffer.from(crypto.hkdfSync(
  'sha256',
  Buffer.from(JWT_SECRET, 'utf8'),
  Buffer.alloc(0),
  Buffer.from('museum-system/groq-api-key/v1', 'utf8'),
  32
));

const chatApiKeySchema = new mongoose.Schema({
  id: { type: String, default: KEY_ID, unique: true },
  encryptedKey: { type: String, default: undefined, select: false },
  iv: { type: String, default: undefined, select: false },
  authTag: { type: String, default: undefined, select: false },
  disabled: { type: Boolean, default: false },
  updatedAt: { type: Date, default: Date.now }
});

const ChatApiKey = mongoose.models.ChatApiKey || mongoose.model('ChatApiKey', chatApiKeySchema);

function encryptKey(apiKey) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encryptedKey = Buffer.concat([
    cipher.update(apiKey, 'utf8'),
    cipher.final()
  ]);
  return {
    encryptedKey: encryptedKey.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

function decryptKey(record) {
  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(record.iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(record.authTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.encryptedKey, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

async function getGroqConfiguration() {
  const environmentKey = (process.env.GROQ_API_KEY || '').trim();
  if (mongoose.connection.readyState === 0) {
    return {
      apiKey: environmentKey,
      source: environmentKey ? 'environment' : 'none',
      environmentConfigured: Boolean(environmentKey)
    };
  }
  const saved = await ChatApiKey.findOne({ id: KEY_ID })
    .select('+encryptedKey +iv +authTag')
    .lean();
  if (saved?.disabled) {
    return { apiKey: '', source: 'disabled', environmentConfigured: Boolean(environmentKey) };
  }
  if (saved?.encryptedKey) {
    return {
      apiKey: decryptKey(saved),
      source: 'dashboard',
      environmentConfigured: Boolean(environmentKey)
    };
  }
  return {
    apiKey: environmentKey,
    source: environmentKey ? 'environment' : 'none',
    environmentConfigured: Boolean(environmentKey)
  };
}

async function setGroqApiKey(apiKey) {
  const encrypted = encryptKey(apiKey);
  await ChatApiKey.findOneAndUpdate(
    { id: KEY_ID },
    { $set: { ...encrypted, disabled: false, updatedAt: new Date() } },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return getGroqConfiguration();
}

async function disableGroqApiKey() {
  await ChatApiKey.findOneAndUpdate(
    { id: KEY_ID },
    {
      $set: { disabled: true, updatedAt: new Date() },
      $unset: { encryptedKey: 1, iv: 1, authTag: 1 }
    },
    { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true }
  );
  return getGroqConfiguration();
}

async function useEnvironmentGroqApiKey() {
  await ChatApiKey.deleteOne({ id: KEY_ID });
  return getGroqConfiguration();
}

function getGroqApiKeyStatus(configuration) {
  return {
    configured: Boolean(configuration.apiKey),
    source: configuration.source,
    environmentConfigured: configuration.environmentConfigured,
    model: process.env.GROQ_MODEL || 'llama-3.3-70b-versatile'
  };
}

module.exports = {
  ChatApiKey,
  getGroqConfiguration,
  getGroqApiKeyStatus,
  setGroqApiKey,
  disableGroqApiKey,
  useEnvironmentGroqApiKey
};
