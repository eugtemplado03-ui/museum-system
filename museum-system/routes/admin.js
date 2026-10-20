const express = require('express');
const analytics = require('../db/analytics');
const ratings = require('../db/ratings');
const exhibits = require('../db/exhibits');
const chatApiKey = require('../db/chat-api-key');
const apiManagement = require('../db/api-management');
const apiUsage = require('../db/api-usage');
const { configureCloudinary } = require('../db/cloudinary-config');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function sendGroqApiKeyStatus(res, configuration) {
  res.json({ settings: chatApiKey.getGroqApiKeyStatus(configuration) });
}

function validCredential(value, maxLength = 512) {
  return typeof value === 'string' && value.trim().length > 0 &&
    value.trim().length <= maxLength && !/[\r\n\0]/.test(value);
}

async function getApiManagementSettings() {
  const [groqConfiguration, cloudinaryConfiguration, customProviders] = await Promise.all([
    chatApiKey.getGroqConfiguration(),
    apiManagement.getCloudinaryConfiguration(),
    apiManagement.listCustomProviders()
  ]);
  return {
    groq: chatApiKey.getGroqApiKeyStatus(groqConfiguration),
    cloudinary: {
      configured: cloudinaryConfiguration.configured,
      source: cloudinaryConfiguration.source,
      environmentConfigured: cloudinaryConfiguration.environmentConfigured
    },
    customProviders
  };
}

router.get(['/api-management', '/api-keys/groq'], requireAdmin, async (req, res) => {
  try {
    if (req.path === '/api-keys/groq') {
      return sendGroqApiKeyStatus(res, await chatApiKey.getGroqConfiguration());
    }
    res.json({ settings: await getApiManagementSettings() });
  } catch (err) {
    console.error('Failed to fetch API management settings:', err.message);
    res.status(500).json({ error: 'Failed to fetch API management settings.' });
  }
});

router.get('/api-management/usage', requireAdmin, async (req, res) => {
  const days = Number.parseInt(req.query.days, 10);
  if (req.query.days !== undefined &&
      (!/^\d+$/.test(String(req.query.days)) || !Number.isInteger(days) || days < 1 || days > 90)) {
    return res.status(400).json({ error: 'Usage period must be between 1 and 90 days.' });
  }
  try {
    res.json({ usage: await apiUsage.getGroqUsage(days || 30) });
  } catch (err) {
    console.error('Failed to fetch API usage:', err.message);
    res.status(503).json({ error: err.message });
  }
});

router.put(['/api-management/groq', '/api-keys/groq'], requireAdmin, async (req, res) => {
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!validCredential(apiKey)) {
    return res.status(400).json({ error: 'Enter a valid Groq API key (maximum 512 characters).' });
  }
  try {
    const configuration = await chatApiKey.setGroqApiKey(apiKey);
    if (req.path === '/api-management/groq') {
      return res.json({ settings: await getApiManagementSettings() });
    }
    sendGroqApiKeyStatus(res, configuration);
  } catch (err) {
    console.error('Failed to update Groq API key settings:', err.message);
    res.status(500).json({ error: 'Failed to update Groq API key settings.' });
  }
});

router.delete(['/api-management/groq', '/api-keys/groq'], requireAdmin, async (req, res) => {
  try {
    const configuration = await chatApiKey.disableGroqApiKey();
    if (req.path === '/api-management/groq') {
      return res.json({ settings: await getApiManagementSettings() });
    }
    sendGroqApiKeyStatus(res, configuration);
  } catch (err) {
    console.error('Failed to remove Groq API key:', err.message);
    res.status(500).json({ error: 'Failed to remove Groq API key.' });
  }
});

router.post(['/api-management/groq/use-environment', '/api-keys/groq/use-environment'], requireAdmin, async (req, res) => {
  try {
    const configuration = await chatApiKey.useEnvironmentGroqApiKey();
    if (req.path === '/api-management/groq/use-environment') {
      return res.json({ settings: await getApiManagementSettings() });
    }
    sendGroqApiKeyStatus(res, configuration);
  } catch (err) {
    console.error('Failed to restore Groq API key environment setting:', err.message);
    res.status(500).json({ error: 'Failed to restore Groq API key environment setting.' });
  }
});

router.put('/api-management/cloudinary', requireAdmin, async (req, res) => {
  const credentials = {
    cloudName: typeof req.body?.cloudName === 'string' ? req.body.cloudName.trim() : '',
    apiKey: typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '',
    apiSecret: typeof req.body?.apiSecret === 'string' ? req.body.apiSecret.trim() : ''
  };
  if (!validCredential(credentials.cloudName, 128) ||
      !validCredential(credentials.apiKey) ||
      !validCredential(credentials.apiSecret)) {
    return res.status(400).json({ error: 'Enter a cloud name, API key, and API secret to configure Cloudinary.' });
  }
  try {
    const configuration = await apiManagement.saveCloudinaryConfiguration(credentials);
    configureCloudinary(configuration.configured ? configuration.credentials : null);
    res.json({ settings: await getApiManagementSettings() });
  } catch (err) {
    console.error('Failed to update Cloudinary credentials:', err.message);
    res.status(500).json({ error: 'Failed to update Cloudinary credentials.' });
  }
});

router.delete('/api-management/cloudinary', requireAdmin, async (req, res) => {
  try {
    await apiManagement.disableCloudinaryConfiguration();
    configureCloudinary(null);
    res.json({ settings: await getApiManagementSettings() });
  } catch (err) {
    console.error('Failed to disable Cloudinary credentials:', err.message);
    res.status(500).json({ error: 'Failed to disable Cloudinary credentials.' });
  }
});

router.post('/api-management/cloudinary/use-environment', requireAdmin, async (req, res) => {
  try {
    const configuration = await apiManagement.useEnvironmentCloudinaryConfiguration();
    configureCloudinary(configuration.configured ? configuration.credentials : null);
    res.json({ settings: await getApiManagementSettings() });
  } catch (err) {
    console.error('Failed to restore environment Cloudinary credentials:', err.message);
    res.status(500).json({ error: 'Failed to restore environment Cloudinary credentials.' });
  }
});

router.post('/api-management/custom', requireAdmin, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!validCredential(name, 80) || !validCredential(apiKey, 4096)) {
    return res.status(400).json({ error: 'Enter a provider name (maximum 80 characters) and API key.' });
  }
  try {
    await apiManagement.saveCustomProvider(name, apiKey);
    res.status(201).json({ settings: await getApiManagementSettings() });
  } catch (err) {
    console.error('Failed to add custom API provider:', err.message);
    res.status(500).json({ error: 'Failed to add custom API provider.' });
  }
});

router.put('/api-management/custom/:id', requireAdmin, async (req, res) => {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim() : '';
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!validCredential(name, 80) || !validCredential(apiKey, 4096)) {
    return res.status(400).json({ error: 'Enter a provider name (maximum 80 characters) and replacement API key.' });
  }
  try {
    await apiManagement.saveCustomProvider(name, apiKey, req.params.id);
    res.json({ settings: await getApiManagementSettings() });
  } catch (err) {
    if (err.message === 'Custom API provider was not found.') {
      return res.status(404).json({ error: err.message });
    }
    console.error('Failed to update custom API provider:', err.message);
    res.status(500).json({ error: 'Failed to update custom API provider.' });
  }
});

router.delete('/api-management/custom/:id', requireAdmin, async (req, res) => {
  try {
    const removed = await apiManagement.removeCustomProvider(req.params.id);
    if (!removed) return res.status(404).json({ error: 'Custom API provider not found.' });
    res.json({ settings: await getApiManagementSettings() });
  } catch (err) {
    console.error('Failed to remove custom API provider:', err.message);
    res.status(500).json({ error: 'Failed to remove custom API provider.' });
  }
});

router.use(requireAuth);

async function withExhibitInfo(exhibitId) {
  const ex = await exhibits.findById(exhibitId);
  return { code: ex ? ex.code : null, title: ex ? ex.title : '(deleted exhibit)' };
}

router.get('/me', (req, res) => {
  res.json({ user: req.user });
});

router.get('/analytics', async (req, res) => {
  try {
    const totals = await analytics.totals();
    
    const summaryData = await analytics.summaryByExhibit();
    const byExhibit = await Promise.all(summaryData.map(async row => ({ ...row, ...(await withExhibitInfo(row.exhibitId)) })));
    
    const recentData = await analytics.recent(30);
    const recent = await Promise.all(recentData.map(async ev => ({ ...ev, ...(await withExhibitInfo(ev.exhibitId)) })));
    
    const daily = await analytics.dailyStats(30);
    res.json({ totals, byExhibit, recent, daily });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

router.get('/analytics/daily', async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 30;
    res.json({ daily: await analytics.dailyStats(days) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch daily analytics' });
  }
});

router.get('/ratings', async (req, res) => {
  try {
    const ratingsData = await ratings.allForAdmin();
    const all = await Promise.all(ratingsData.map(async r => ({ ...r, ...(await withExhibitInfo(r.exhibitId)) })));
    res.json({ ratings: all });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch ratings' });
  }
});

router.delete('/ratings/:id', async (req, res) => {
  try {
    const ok = await ratings.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Rating not found.' });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete rating' });
  }
});

module.exports = router;
