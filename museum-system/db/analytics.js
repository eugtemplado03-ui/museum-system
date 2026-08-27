const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const MAX_EVENTS = 20000;

const scanEventSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  exhibitId: { type: String, required: true },
  source: { type: String, required: true }, // 'scan' or 'view'
  at: { type: String, default: () => new Date().toISOString() }
});

const ScanEvent = mongoose.models.ScanEvent || mongoose.model('ScanEvent', scanEventSchema);

async function record(exhibitId, source) {
  const event = new ScanEvent({
    exhibitId,
    source: source === 'scan' ? 'scan' : 'view'
  });
  await event.save();
  
  // Optional cleanup if collection gets too large
  const count = await ScanEvent.countDocuments();
  if (count > MAX_EVENTS) {
    const overflow = count - MAX_EVENTS;
    const oldest = await ScanEvent.find().sort({ _id: 1 }).limit(overflow);
    if (oldest.length > 0) {
      await ScanEvent.deleteMany({ _id: { $in: oldest.map(o => o._id) } });
    }
  }
}

async function all() {
  return await ScanEvent.find({}).lean();
}

async function summaryByExhibit() {
  const events = await all();
  const map = new Map();
  for (const e of events) {
    const cur = map.get(e.exhibitId) || { exhibitId: e.exhibitId, total: 0, scans: 0, views: 0 };
    cur.total += 1;
    if (e.source === 'scan') cur.scans += 1; else cur.views += 1;
    map.set(e.exhibitId, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

async function recent(limit) {
  const events = await ScanEvent.find({}).sort({ _id: -1 }).limit(Math.max(1, limit || 25)).lean();
  return events;
}

async function dailyStats(days = 30) {
  const events = await all();
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const result = [];

  for (let i = days - 1; i >= 0; i--) {
    const dayStart = new Date(now - i * dayMs);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart.getTime() + dayMs);
    const dayEvents = events.filter(e => {
      const t = new Date(e.at).getTime();
      return t >= dayStart.getTime() && t < dayEnd.getTime();
    });
    const scans = dayEvents.filter(e => e.source === 'scan').length;
    const views = dayEvents.filter(e => e.source === 'view').length;
    result.push({
      date: dayStart.toISOString().slice(0, 10),
      label: dayStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      scans,
      views,
      total: scans + views
    });
  }
  return result;
}

async function totals() {
  const events = await all();
  const last7 = events.filter(e => Date.now() - new Date(e.at).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const last24h = events.filter(e => Date.now() - new Date(e.at).getTime() <= 24 * 60 * 60 * 1000);
  return { allTime: events.length, last7Days: last7.length, last24Hours: last24h.length };
}

module.exports = { record, all, summaryByExhibit, recent, totals, dailyStats, ScanEvent };
