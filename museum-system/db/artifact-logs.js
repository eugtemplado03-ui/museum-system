const { load, save } = require('./store');
const { nanoid } = require('nanoid');

function all(filter = {}) {
  let list = load().artifactLogs || [];

  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(a =>
      (a.accessionNo || '').toLowerCase().includes(q) ||
      (a.name || '').toLowerCase().includes(q) ||
      (a.category || '').toLowerCase().includes(q) ||
      (a.location || '').toLowerCase().includes(q) ||
      (a.donor || '').toLowerCase().includes(q) ||
      (a.description || '').toLowerCase().includes(q) ||
      (a.notes || '').toLowerCase().includes(q)
    );
  }

  if (filter.category && filter.category !== 'All') {
    list = list.filter(a => (a.category || '').toLowerCase() === filter.category.toLowerCase());
  }

  if (filter.condition && filter.condition !== 'All') {
    list = list.filter(a => (a.condition || '').toLowerCase() === filter.condition.toLowerCase());
  }

  if (filter.status && filter.status !== 'All') {
    list = list.filter(a => (a.status || '').toLowerCase() === filter.status.toLowerCase());
  }

  // Sort by accession number or updated timestamp
  return list.slice().sort((a, b) => {
    return (b.updatedAt || b.createdAt || '').localeCompare(a.updatedAt || a.createdAt || '');
  });
}

function findById(id) {
  const data = load();
  return (data.artifactLogs || []).find(a => a.id === id);
}

function generateAccessionNo() {
  const data = load();
  const list = data.artifactLogs || [];
  const year = new Date().getFullYear();
  const prefix = `MSBN-${year}-`;
  let maxSeq = 0;

  for (const item of list) {
    if (item.accessionNo && item.accessionNo.startsWith(prefix)) {
      const numPart = parseInt(item.accessionNo.replace(prefix, ''), 10);
      if (!isNaN(numPart) && numPart > maxSeq) {
        maxSeq = numPart;
      }
    }
  }

  return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
}

function create(payload) {
  const data = load();
  if (!Array.isArray(data.artifactLogs)) data.artifactLogs = [];

  const now = new Date();
  const accessionNo = (payload.accessionNo || '').trim() || generateAccessionNo();

  const artifact = {
    id: nanoid(10),
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
    notes: (payload.notes || '').trim(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  data.artifactLogs.push(artifact);
  save(data);
  return artifact;
}

function update(id, payload) {
  const data = load();
  if (!Array.isArray(data.artifactLogs)) data.artifactLogs = [];
  const idx = data.artifactLogs.findIndex(a => a.id === id);
  if (idx === -1) return null;

  const existing = data.artifactLogs[idx];
  const updated = {
    ...existing,
    accessionNo: payload.accessionNo !== undefined ? payload.accessionNo.trim() : existing.accessionNo,
    name: payload.name !== undefined ? payload.name.trim() : existing.name,
    category: payload.category !== undefined ? payload.category : existing.category,
    condition: payload.condition !== undefined ? payload.condition : existing.condition,
    status: payload.status !== undefined ? payload.status : existing.status,
    location: payload.location !== undefined ? payload.location.trim() : existing.location,
    acquisitionDate: payload.acquisitionDate !== undefined ? payload.acquisitionDate : existing.acquisitionDate,
    donor: payload.donor !== undefined ? payload.donor.trim() : existing.donor,
    estimatedValue: payload.estimatedValue !== undefined ? payload.estimatedValue.trim() : existing.estimatedValue,
    description: payload.description !== undefined ? payload.description.trim() : existing.description,
    notes: payload.notes !== undefined ? payload.notes.trim() : existing.notes,
    updatedAt: new Date().toISOString()
  };

  data.artifactLogs[idx] = updated;
  save(data);
  return updated;
}

function remove(id) {
  const data = load();
  if (!Array.isArray(data.artifactLogs)) return false;
  const before = data.artifactLogs.length;
  data.artifactLogs = data.artifactLogs.filter(a => a.id !== id);
  save(data);
  return data.artifactLogs.length < before;
}

function stats() {
  const list = load().artifactLogs || [];

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

module.exports = { all, findById, create, update, remove, stats };
