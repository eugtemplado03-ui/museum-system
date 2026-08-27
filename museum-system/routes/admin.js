const express = require('express');
const analytics = require('../db/analytics');
const ratings = require('../db/ratings');
const exhibits = require('../db/exhibits');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

async function withExhibitInfo(exhibitId) {
  const ex = await exhibits.findById(exhibitId);
  return { code: ex ? ex.code : null, title: ex ? ex.title : '(deleted exhibit)' };
}

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
