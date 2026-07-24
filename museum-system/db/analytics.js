const { load, save } = require('./store');
const { nanoid } = require('nanoid');

// Keep the raw event log bounded so the JSON file doesn't grow forever on a
// busy floor. Older events are trimmed once this many are stored.
const MAX_EVENTS = 20000;

function record(exhibitId, source) {
  const data = load();
  data.scanEvents.push({
    id: nanoid(10),
    exhibitId,
    source: source === 'scan' ? 'scan' : 'view', // 'scan' = came from a QR scan, 'view' = opened another way
    at: new Date().toISOString()
  });
  if (data.scanEvents.length > MAX_EVENTS) {
    data.scanEvents = data.scanEvents.slice(data.scanEvents.length - MAX_EVENTS);
  }
  save(data);
}

function all() {
  return load().scanEvents;
}

function summaryByExhibit() {
  const events = all();
  const map = new Map();
  for (const e of events) {
    const cur = map.get(e.exhibitId) || { exhibitId: e.exhibitId, total: 0, scans: 0, views: 0 };
    cur.total += 1;
    if (e.source === 'scan') cur.scans += 1; else cur.views += 1;
    map.set(e.exhibitId, cur);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

function recent(limit) {
  return all().slice(-Math.max(1, limit || 25)).reverse();
}

function totals() {
  const events = all();
  const last7 = events.filter(e => Date.now() - new Date(e.at).getTime() <= 7 * 24 * 60 * 60 * 1000);
  const last24h = events.filter(e => Date.now() - new Date(e.at).getTime() <= 24 * 60 * 60 * 1000);
  return { allTime: events.length, last7Days: last7.length, last24Hours: last24h.length };
}

module.exports = { record, all, summaryByExhibit, recent, totals };
