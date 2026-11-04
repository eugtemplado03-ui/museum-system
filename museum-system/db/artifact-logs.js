// Persistence and reporting helpers for the museum's artifact inventory log.
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const artifactHistoryFieldSchema = new mongoose.Schema({
  field: { type: String, required: true },
  previousValue: { type: String, default: '' },
  newValue: { type: String, default: '' }
}, { _id: false });

const artifactHistoryEntrySchema = new mongoose.Schema({
  changedAt: { type: String, default: () => new Date().toISOString() },
  editedBy: { type: String, default: 'Admin' },
  fields: { type: [artifactHistoryFieldSchema], default: [] }
}, { _id: false });

const artifactLogSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  accessionNo: { type: String, required: true },
  name: { type: String, default: '' },
  category: { type: String, default: 'Historical Relic' },
  condition: { type: String, default: 'Good' },
  status: { type: String, default: 'On Display' },
  location: { type: String, default: '' },
  acquisitionDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
  donor: { type: String, default: '' },
  estimatedValue: { type: String, default: '' },
  description: { type: String, default: '' },
  notes: { type: String, default: '' },
  history: { type: [artifactHistoryEntrySchema], default: [], select: false },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const ArtifactLog = mongoose.models.ArtifactLog || mongoose.model('ArtifactLog', artifactLogSchema);

// Find inventory records matching the supplied filters, newest changes first.
async function all(filter = {}) {
  let query = {};

  if (filter.search) {
    const q = filter.search.toLowerCase();
    query.$or = [
      { accessionNo: { $regex: q, $options: 'i' } },
      { name: { $regex: q, $options: 'i' } },
      { category: { $regex: q, $options: 'i' } },
      { location: { $regex: q, $options: 'i' } },
      { donor: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
      { notes: { $regex: q, $options: 'i' } }
    ];
  }

  if (filter.category && filter.category !== 'All') {
    query.category = filter.category;
  }

  if (filter.condition && filter.condition !== 'All') {
    query.condition = filter.condition;
  }

  if (filter.status && filter.status !== 'All') {
    query.status = filter.status;
  }

  const list = await ArtifactLog.find(query).lean();
  
  return list.sort((a, b) => {
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  });
}

// Look up one inventory record by its public ID.
async function findById(id) {
  return await ArtifactLog.findOne({ id }).lean();
}

// Retrieve the edit history separately from the current inventory record.
async function getHistory(id) {
  const artifact = await ArtifactLog.findOne({ id }).select('+history').lean();
  if (!artifact) return null;

  return (artifact.history || []).slice().sort((a, b) => b.changedAt.localeCompare(a.changedAt));
}

// Generate the next accession number for the current calendar year.
async function generateAccessionNo() {
  const year = new Date().getFullYear();
  const prefix = `MSBN-${year}-`;
  
  const list = await ArtifactLog.find({ accessionNo: { $regex: `^${prefix}` } }, { accessionNo: 1 }).lean();
  let maxSeq = 0;
  
  for (const item of list) {
    const numPart = parseInt(item.accessionNo.replace(prefix, ''), 10);
    if (!isNaN(numPart) && numPart > maxSeq) {
      maxSeq = numPart;
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

// Create an inventory record, generating an accession number when none is supplied.
async function create(payload) {
  const now = new Date();
  const accessionNo = (payload.accessionNo || '').trim() || await generateAccessionNo();

  const artifact = new ArtifactLog({
    accessionNo,
    name: (payload.name || '').trim(),
    category: payload.category || 'Historical Relic',
    condition: payload.condition || 'Good',
    status: payload.status || 'On Display',
    location: (payload.location || '').trim(),
    acquisitionDate: payload.acquisitionDate || now.toISOString().slice(0, 10),
    donor: (payload.donor || '').trim(),
    estimatedValue: (payload.estimatedValue || '').trim(),
    description: (payload.description || '').trim(),
    notes: (payload.notes || '').trim()
  });

  await artifact.save();
  return artifact.toObject();
}

// Apply only supplied inventory fields and refresh the record's modification time.
async function update(id, payload, editedBy = 'Admin') {
  const existing = await ArtifactLog.findOne({ id }).select('+history');
  if (!existing) return null;

  const changedFields = [];
  const fields = {
    accessionNo: value => value.trim(),
    name: value => value.trim(),
    category: value => value,
    condition: value => value,
    status: value => value,
    location: value => value.trim(),
    acquisitionDate: value => value,
    donor: value => value.trim(),
    estimatedValue: value => value.trim(),
    description: value => value.trim(),
    notes: value => value.trim()
  };

  for (const [field, normalize] of Object.entries(fields)) {
    if (payload[field] === undefined) continue;

    const previousValue = existing[field] || '';
    const newValue = normalize(payload[field]);
    if (previousValue !== newValue) {
      changedFields.push({ field, previousValue, newValue });
      existing[field] = newValue;
    }
  }

  if (changedFields.length) {
    existing.history.push({
      changedAt: new Date().toISOString(),
      editedBy: editedBy || 'Admin',
      fields: changedFields
    });
  }
  
  existing.updatedAt = new Date().toISOString();
  
  await existing.save();
  return existing.toObject();
}

// Delete an inventory record and report whether one existed.
async function remove(id) {
  const result = await ArtifactLog.deleteOne({ id });
  return result.deletedCount > 0;
}

// Summarize inventory counts by condition, status, and category.
async function stats() {
  const list = await ArtifactLog.find({}).lean();

  let totalArtifacts = list.length;
  let onDisplay = 0;
  let inStorage = 0;
  let underRestoration = 0;
  let onLoan = 0;
  let needsMaintenance = 0;

  const byCategory = {};
  const byCondition = {};
  const byStatus = {};

  for (const a of list) {
    const cond = a.condition || 'Good';
    byCondition[cond] = (byCondition[cond] || 0) + 1;
    if (cond === 'Needs Restoration' || cond === 'Damaged' || cond === 'Fair') {
      needsMaintenance++;
    }

    const st = a.status || 'On Display';
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (st === 'On Display') onDisplay++;
    else if (st === 'In Storage') inStorage++;
    else if (st === 'Under Restoration') underRestoration++;
    else if (st === 'On Loan') onLoan++;

    const cat = a.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + 1;
  }

  return {
    totalArtifacts,
    onDisplay,
    inStorage,
    underRestoration,
    onLoan,
    needsMaintenance,
    byCategory,
    byCondition,
    byStatus
  };
}

module.exports = { all, findById, getHistory, create, update, remove, stats, ArtifactLog };
