// Persists the singleton set of saved room positions and scales for the floor map.
const mongoose = require('mongoose');

const mapLayoutSchema = new mongoose.Schema({
  id: { type: String, default: 'singleton', unique: true },
  roomOffsets: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const MapLayout = mongoose.models.MapLayout || mongoose.model('MapLayout', mapLayoutSchema);

// Read saved room transforms, returning an empty object before the layout is created.
async function getRoomOffsets() {
  const layout = await MapLayout.findOne({ id: 'singleton' }).lean();
  return layout?.roomOffsets || {};
}

// Upsert the singleton floor-map layout and return the stored room transforms.
async function updateRoomOffsets(roomOffsets) {
  const layout = await MapLayout.findOneAndUpdate(
    { id: 'singleton' },
    { $set: { roomOffsets, updatedAt: new Date().toISOString() } },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return layout.roomOffsets || {};
}

module.exports = { getRoomOffsets, updateRoomOffsets, MapLayout };
