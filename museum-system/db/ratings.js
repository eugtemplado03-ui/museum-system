const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
// We need to require the Mongoose model for Exhibit to fetch exhibits in topRatedExhibits
const { Exhibit } = require('./exhibits');

const ratingSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  visitorId: { type: String, required: true },
  visitorName: { type: String, default: 'Visitor' },
  exhibitId: { type: String, required: true },
  rating: { type: Number, required: true },
  comment: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const Rating = mongoose.models.Rating || mongoose.model('Rating', ratingSchema);

async function forExhibit(exhibitId) {
  const ratings = await Rating.find({ exhibitId }).lean();
  return ratings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function summaryForExhibit(exhibitId) {
  const ratings = await forExhibit(exhibitId);
  if (ratings.length === 0) return { average: null, count: 0 };
  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  return { average: Math.round((sum / ratings.length) * 10) / 10, count: ratings.length };
}

async function submit(visitorId, exhibitId, rating, comment, visitorName) {
  const name = (visitorName || '').trim().slice(0, 50) || 'Visitor';
  
  const existing = await Rating.findOne({ visitorId, exhibitId });
  if (existing) {
    existing.visitorName = name;
    existing.rating = rating;
    existing.comment = comment || '';
    existing.updatedAt = new Date().toISOString();
    await existing.save();
    return existing.toObject();
  }

  const record = new Rating({
    visitorId,
    visitorName: name,
    exhibitId,
    rating,
    comment: comment || ''
  });
  await record.save();
  return record.toObject();
}

async function topRatedExhibits(limit = 6) {
  const allExhibits = await Exhibit.find({}).lean();
  
  const enrichedPromises = allExhibits.map(async (ex) => {
    const rs = await summaryForExhibit(ex.id);
    const exRatings = await forExhibit(ex.id);
    const topComment = exRatings.find(r => r.comment && r.comment.trim() && r.rating >= 4);
    const recentComment = exRatings.find(r => r.comment && r.comment.trim());
    return {
      ...ex,
      ratingAverage: rs.average,
      ratingCount: rs.count,
      featuredReview: topComment || recentComment || null
    };
  });
  
  const enriched = await Promise.all(enrichedPromises);

  // Sort exhibits with ratings first by average desc, count desc, then unrated
  enriched.sort((a, b) => {
    const aAvg = a.ratingAverage || 0;
    const bAvg = b.ratingAverage || 0;
    if (bAvg !== aAvg) return bAvg - aAvg;
    return (b.ratingCount || 0) - (a.ratingCount || 0);
  });

  return enriched.slice(0, limit);
}

async function allForAdmin() {
  const ratings = await Rating.find({}).lean();
  return ratings.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function remove(id) {
  const result = await Rating.deleteOne({ id });
  return result.deletedCount > 0;
}

module.exports = { forExhibit, summaryForExhibit, submit, topRatedExhibits, allForAdmin, remove, Rating };
