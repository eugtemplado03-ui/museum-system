const express = require('express');
const analytics = require('../db/analytics');
const ratings = require('../db/ratings');
const exhibits = require('../db/exhibits');
const chatApiKey = require('../db/chat-api-key');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function sendGroqApiKeyStatus(res, configuration) {
  res.json({ settings: chatApiKey.getGroqApiKeyStatus(configuration) });
}

router.get('/api-keys/groq', requireAdmin, async (req, res) => {
  try {
    sendGroqApiKeyStatus(res, await chatApiKey.getGroqConfiguration());
  } catch (err) {
    console.error('Failed to fetch Groq API key settings:', err.message);
    res.status(500).json({ error: 'Failed to fetch Groq API key settings.' });
  }
});

router.put('/api-keys/groq', requireAdmin, async (req, res) => {
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!apiKey || apiKey.length > 512 || /[\r\n\0]/.test(apiKey)) {
    return res.status(400).json({ error: 'Enter a valid Groq API key (maximum 512 characters).' });
  }
  try {
    sendGroqApiKeyStatus(res, await chatApiKey.setGroqApiKey(apiKey));
  } catch (err) {
    console.error('Failed to update Groq API key settings:', err.message);
    res.status(500).json({ error: 'Failed to update Groq API key settings.' });
  }
});

router.delete('/api-keys/groq', requireAdmin, async (req, res) => {
  try {
    sendGroqApiKeyStatus(res, await chatApiKey.disableGroqApiKey());
  } catch (err) {
    console.error('Failed to remove Groq API key:', err.message);
    res.status(500).json({ error: 'Failed to remove Groq API key.' });
  }
});

router.post('/api-keys/groq/use-environment', requireAdmin, async (req, res) => {
  try {
    sendGroqApiKeyStatus(res, await chatApiKey.useEnvironmentGroqApiKey());
  } catch (err) {
    console.error('Failed to restore Groq API key environment setting:', err.message);
    res.status(500).json({ error: 'Failed to restore Groq API key environment setting.' });
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
