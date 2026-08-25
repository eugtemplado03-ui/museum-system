const { load, save } = require('./store');
const { nanoid } = require('nanoid');

function forExhibit(exhibitId) {
  return load().ratings
    .filter(r => r.exhibitId === exhibitId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function summaryForExhibit(exhibitId) {
  const ratings = forExhibit(exhibitId);
  if (ratings.length === 0) return { average: null, count: 0 };
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

// One rating per visitor per exhibit — resubmitting updates the existing one.
function submit(visitorId, exhibitId, rating, comment, visitorName) {
  const data = load();
  const existingIdx = data.ratings.findIndex(r => r.visitorId === visitorId && r.exhibitId === exhibitId);
  const name = (visitorName || '').trim().slice(0, 50) || 'Visitor';
  const record = {
    id: existingIdx >= 0 ? data.ratings[existingIdx].id : nanoid(10),
    visitorId,
    visitorName: name,
    exhibitId,
    rating,
    comment: comment || '',
    createdAt: existingIdx >= 0 ? data.ratings[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  if (existingIdx >= 0) data.ratings[existingIdx] = record;
  else data.ratings.push(record);
  save(data);
  return record;
}

function topRatedExhibits(limit = 6) {
  const data = load();
  const allExhibits = data.exhibits || [];
  const enriched = allExhibits.map(ex => {
    const rs = summaryForExhibit(ex.id);
    const exRatings = forExhibit(ex.id);
    const topComment = exRatings.find(r => r.comment && r.comment.trim() && r.rating >= 4);
    const recentComment = exRatings.find(r => r.comment && r.comment.trim());
    return {
      ...ex,
      ratingAverage: rs.average,
      ratingCount: rs.count,
      featuredReview: topComment || recentComment || null
    };
  });

  // Sort exhibits with ratings first by average desc, count desc, then unrated
  enriched.sort((a, b) => {
    const aAvg = a.ratingAverage || 0;
    const bAvg = b.ratingAverage || 0;
    if (bAvg !== aAvg) return bAvg - aAvg;
    return (b.ratingCount || 0) - (a.ratingCount || 0);
  });

  return enriched.slice(0, limit);
}

function allForAdmin() {
  return load().ratings.slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function remove(id) {
  const data = load();
  const before = data.ratings.length;
  data.ratings = data.ratings.filter(r => r.id !== id);
  save(data);
  return data.ratings.length < before;
}

module.exports = { forExhibit, summaryForExhibit, submit, topRatedExhibits, allForAdmin, remove };
