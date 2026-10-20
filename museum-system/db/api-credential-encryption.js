// Encrypts API credentials at rest using the server's JWT secret as key material.
const crypto = require('crypto');
const { JWT_SECRET } = require('../middleware/auth');

const ENCRYPTION_KEY = Buffer.from(crypto.hkdfSync(
  'sha256',
  Buffer.from(JWT_SECRET, 'utf8'),
  Buffer.alloc(0),
  Buffer.from('museum-system/api-management/v1', 'utf8'),
  32
));

// Encrypt a credential with a fresh IV; the authentication tag travels with the record.
function encryptCredential(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(value, 'utf8'),
    cipher.final()
  ]);
  return {
    encryptedKey: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64')
  };
}

// Authenticate and decrypt a credential record previously produced by encryptCredential.
function decryptCredential(record) {
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

module.exports = { encryptCredential, decryptCredential };
