const { load, save } = require('./store');
const { nanoid } = require('nanoid');

function all(filter = {}) {
  let list = load().visitors || [];
  
  if (filter.search) {
    const q = filter.search.toLowerCase();
    list = list.filter(v =>
      (v.visitorName || '').toLowerCase().includes(q) ||
      (v.groupName || '').toLowerCase().includes(q) ||
      (v.contactNumber || '').toLowerCase().includes(q) ||
      (v.email || '').toLowerCase().includes(q) ||
      (v.purpose || '').toLowerCase().includes(q) ||
      (v.tourGuide || '').toLowerCase().includes(q) ||
      (v.notes || '').toLowerCase().includes(q)
    );
  }

  if (filter.groupType && filter.groupType !== 'All') {
    list = list.filter(v => (v.groupType || '').toLowerCase() === filter.groupType.toLowerCase());
  }

  if (filter.status && filter.status !== 'All') {
    list = list.filter(v => (v.status || '').toLowerCase() === filter.status.toLowerCase());
  }

  if (filter.date) {
    list = list.filter(v => (v.visitDate || '').startsWith(filter.date));
  }

  // Sort newest visit date/time first
  return list.slice().sort((a, b) => {
    const da = (a.visitDate || '') + ' ' + (a.visitTime || '');
    const db = (b.visitDate || '') + ' ' + (b.visitTime || '');
    if (da < db) return 1;
    if (da > db) return -1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

function findById(id) {
  const data = load();
  return (data.visitors || []).find(v => v.id === id);
}

function getPhilippineDateTime() {
  const now = new Date();
  try {
    const phDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
    const phTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Manila', hour: '2-digit', minute: '2-digit', hour12: false }).format(now);
    return { date: phDate, time: phTime };
  } catch (e) {
    return { date: now.toISOString().slice(0, 10), time: now.toTimeString().slice(0, 5) };
  }
}

function create(payload) {
  const data = load();
  if (!Array.isArray(data.visitors)) data.visitors = [];

  const now = new Date();
  const ph = getPhilippineDateTime();
  const defaultDate = ph.date;
  const defaultTime = ph.time;

  const visitor = {
    id: nanoid(10),
    visitorName: (payload.visitorName || '').trim(),
    groupName: (payload.groupName || '').trim(),
    groupType: payload.groupType || 'Walk-in / Individual',
    pax: Math.max(1, parseInt(payload.pax, 10) || 1),
    contactNumber: (payload.contactNumber || '').trim(),
    email: (payload.email || '').trim(),
    address: (payload.address || '').trim(),
    sex: payload.sex || '',
    age: payload.age !== undefined && payload.age !== '' ? parseInt(payload.age, 10) : null,
    visitDate: payload.visitDate || defaultDate,
    visitTime: payload.visitTime || defaultTime,
    purpose: payload.purpose || 'General Visit',
    tourGuide: (payload.tourGuide || '').trim(),
    status: payload.status || 'Checked-in',
    notes: (payload.notes || '').trim(),
    createdAt: now.toISOString(),
    updatedAt: now.toISOString()
  };

  data.visitors.push(visitor);
  save(data);
  return visitor;
}

function update(id, payload) {
  const data = load();
  if (!Array.isArray(data.visitors)) data.visitors = [];
  const idx = data.visitors.findIndex(v => v.id === id);
  if (idx === -1) return null;

  const existing = data.visitors[idx];
  const updated = {
    ...existing,
    visitorName: payload.visitorName !== undefined ? payload.visitorName.trim() : existing.visitorName,
    groupName: payload.groupName !== undefined ? payload.groupName.trim() : existing.groupName,
    groupType: payload.groupType !== undefined ? payload.groupType : existing.groupType,
    pax: payload.pax !== undefined ? Math.max(1, parseInt(payload.pax, 10) || 1) : existing.pax,
    contactNumber: payload.contactNumber !== undefined ? payload.contactNumber.trim() : existing.contactNumber,
    email: payload.email !== undefined ? payload.email.trim() : existing.email,
    address: payload.address !== undefined ? payload.address.trim() : existing.address,
    sex: payload.sex !== undefined ? payload.sex : existing.sex,
    age: payload.age !== undefined && payload.age !== '' ? parseInt(payload.age, 10) : existing.age,
    visitDate: payload.visitDate !== undefined ? payload.visitDate : existing.visitDate,
    visitTime: payload.visitTime !== undefined ? payload.visitTime : existing.visitTime,
    purpose: payload.purpose !== undefined ? payload.purpose : existing.purpose,
    tourGuide: payload.tourGuide !== undefined ? payload.tourGuide.trim() : existing.tourGuide,
    status: payload.status !== undefined ? payload.status : existing.status,
    notes: payload.notes !== undefined ? payload.notes.trim() : existing.notes,
    updatedAt: new Date().toISOString()
  };

  data.visitors[idx] = updated;
  save(data);
  return updated;
}

function remove(id) {
  const data = load();
  if (!Array.isArray(data.visitors)) return false;
  const before = data.visitors.length;
  data.visitors = data.visitors.filter(v => v.id !== id);
  save(data);
  return data.visitors.length < before;
}

function stats() {
  const list = load().visitors || [];
  const today = new Date().toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);

  let totalVisits = list.length;
  let totalPax = 0;
  let todayVisits = 0;
  let todayPax = 0;
  let monthVisits = 0;
  let monthPax = 0;

  const byGroupType = {};
  const byPurpose = {};
  const byStatus = {};

  for (const v of list) {
    const pax = v.pax || 1;
    totalPax += pax;

    if (v.visitDate === today) {
      todayVisits++;
      todayPax += pax;
    }

    if (v.visitDate && v.visitDate.startsWith(thisMonth)) {
      monthVisits++;
      monthPax += pax;
    }

    const gt = v.groupType || 'Other';
    byGroupType[gt] = (byGroupType[gt] || 0) + pax;

    const pur = v.purpose || 'Other';
    byPurpose[pur] = (byPurpose[pur] || 0) + pax;

    const st = v.status || 'Checked-in';
    byStatus[st] = (byStatus[st] || 0) + 1;
  }

  return {
    totalVisits,
    totalPax,
    todayVisits,
    todayPax,
    monthVisits,
    monthPax,
    byGroupType,
    byPurpose,
    byStatus
  };
}

module.exports = { all, findById, create, update, remove, stats };
