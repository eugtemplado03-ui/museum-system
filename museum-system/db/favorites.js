const { load, save } = require('./store');

function keyOf(visitorId, exhibitId) { return visitorId + '::' + exhibitId; }

function listForVisitor(visitorId) {
  return load().favorites.filter(f => f.visitorId === visitorId).map(f => f.exhibitId);
}

function add(visitorId, exhibitId) {
  const data = load();
  const exists = data.favorites.some(f => f.visitorId === visitorId && f.exhibitId === exhibitId);
  if (!exists) {
    data.favorites.push({ visitorId, exhibitId, createdAt: new Date().toISOString() });
    save(data);
  }
  return true;
}

function remove(visitorId, exhibitId) {
  const data = load();
  data.favorites = data.favorites.filter(f => !(f.visitorId === visitorId && f.exhibitId === exhibitId));
  save(data);
  return true;
}

function countForExhibit(exhibitId) {
  return load().favorites.filter(f => f.exhibitId === exhibitId).length;
}

module.exports = { listForVisitor, add, remove, countForExhibit };
