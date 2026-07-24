const express = require('express');
const analytics = require('../db/analytics');
const ratings = require('../db/ratings');
const exhibits = require('../db/exhibits');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

function withExhibitInfo(exhibitId) {
  const ex = exhibits.findById(exhibitId);
  return { code: ex ? ex.code : null, title: ex ? ex.title : '(deleted exhibit)' };
}

router.get('/analytics', (req, res) => {
  const totals = analytics.totals();
  const byExhibit = analytics.summaryByExhibit().map(row => ({ ...row, ...withExhibitInfo(row.exhibitId) }));
  const recent = analytics.recent(30).map(ev => ({ ...ev, ...withExhibitInfo(ev.exhibitId) }));
  res.json({ totals, byExhibit, recent });
});

router.get('/ratings', (req, res) => {
  const all = ratings.allForAdmin().map(r => ({ ...r, ...withExhibitInfo(r.exhibitId) }));
  res.json({ ratings: all });
});

router.delete('/ratings/:id', (req, res) => {
  const ok = ratings.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: 'Rating not found.' });
  res.json({ success: true });
});

module.exports = router;
