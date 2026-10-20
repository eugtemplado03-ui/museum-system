// Stores visitor-to-exhibit favorites and exposes visitor/exhibit lookups.
const mongoose = require('mongoose');

const favoriteSchema = new mongoose.Schema({
  visitorId: { type: String, required: true },
  exhibitId: { type: String, required: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const Favorite = mongoose.models.Favorite || mongoose.model('Favorite', favoriteSchema);

// Return the exhibit IDs favorited by one visitor.
async function listForVisitor(visitorId) {
  const favorites = await Favorite.find({ visitorId }).lean();
  return favorites.map(f => f.exhibitId);
}

// Add a visitor/exhibit favorite only if that pair is not already stored.
async function add(visitorId, exhibitId) {
  const exists = await Favorite.findOne({ visitorId, exhibitId });
  if (!exists) {
    const fav = new Favorite({ visitorId, exhibitId });
    await fav.save();
  }
  return true;
}

// Remove a visitor's favorite for an exhibit.
async function remove(visitorId, exhibitId) {
  await Favorite.deleteOne({ visitorId, exhibitId });
  return true;
}

// Count how many visitors have favorited an exhibit.
async function countForExhibit(exhibitId) {
  return await Favorite.countDocuments({ exhibitId });
}

module.exports = { listForVisitor, add, remove, countForExhibit, Favorite };
