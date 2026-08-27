const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const visitorSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  visitorName: { type: String, default: '' },
  groupName: { type: String, default: '' },
  groupType: { type: String, default: 'Walk-in / Individual' },
  pax: { type: Number, default: 1 },
  contactNumber: { type: String, default: '' },
  email: { type: String, default: '' },
  address: { type: String, default: '' },
  sex: { type: String, default: '' },
  age: { type: Number, default: null },
  visitDate: { type: String, default: '' },
  visitTime: { type: String, default: '' },
  purpose: { type: String, default: 'General Visit' },
  tourGuide: { type: String, default: '' },
  status: { type: String, default: 'Checked-in' },
  notes: { type: String, default: '' },
  createdAt: { type: String, default: () => new Date().toISOString() },
  updatedAt: { type: String, default: () => new Date().toISOString() }
});

const Visitor = mongoose.models.Visitor || mongoose.model('Visitor', visitorSchema);

async function all(filter = {}) {
  let query = {};
  
  if (filter.search) {
    const q = filter.search.toLowerCase();
    query.$or = [
      { visitorName: { $regex: q, $options: 'i' } },
      { groupName: { $regex: q, $options: 'i' } },
      { contactNumber: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
      { purpose: { $regex: q, $options: 'i' } },
      { tourGuide: { $regex: q, $options: 'i' } },
      { notes: { $regex: q, $options: 'i' } }
    ];
  }

  if (filter.groupType && filter.groupType !== 'All') {
    query.groupType = filter.groupType;
  }

  if (filter.status && filter.status !== 'All') {
    query.status = filter.status;
  }

  if (filter.date) {
    query.visitDate = { $regex: `^${filter.date}` };
  }

  // Sort logic mapped to Mongoose
  const visitors = await Visitor.find(query).lean();
  
  return visitors.sort((a, b) => {
    const da = (a.visitDate || '') + ' ' + (a.visitTime || '');
    const db = (b.visitDate || '') + ' ' + (b.visitTime || '');
    if (da < db) return 1;
    if (da > db) return -1;
    return (b.createdAt || '').localeCompare(a.createdAt || '');
  });
}

async function findById(id) {
  return await Visitor.findOne({ id }).lean();
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

async function create(payload) {
  const ph = getPhilippineDateTime();
  const defaultDate = ph.date;
  const defaultTime = ph.time;

  const visitor = new Visitor({
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
    notes: (payload.notes || '').trim()
  });

  await visitor.save();
  return visitor.toObject();
}

async function update(id, payload) {
  const existing = await Visitor.findOne({ id });
  if (!existing) return null;

  if (payload.visitorName !== undefined) existing.visitorName = payload.visitorName.trim();
  if (payload.groupName !== undefined) existing.groupName = payload.groupName.trim();
  if (payload.groupType !== undefined) existing.groupType = payload.groupType;
  if (payload.pax !== undefined) existing.pax = Math.max(1, parseInt(payload.pax, 10) || 1);
  if (payload.contactNumber !== undefined) existing.contactNumber = payload.contactNumber.trim();
  if (payload.email !== undefined) existing.email = payload.email.trim();
  if (payload.address !== undefined) existing.address = payload.address.trim();
  if (payload.sex !== undefined) existing.sex = payload.sex;
  if (payload.age !== undefined && payload.age !== '') existing.age = parseInt(payload.age, 10);
  if (payload.visitDate !== undefined) existing.visitDate = payload.visitDate;
  if (payload.visitTime !== undefined) existing.visitTime = payload.visitTime;
  if (payload.purpose !== undefined) existing.purpose = payload.purpose;
  if (payload.tourGuide !== undefined) existing.tourGuide = payload.tourGuide.trim();
  if (payload.status !== undefined) existing.status = payload.status;
  if (payload.notes !== undefined) existing.notes = payload.notes.trim();
  
  existing.updatedAt = new Date().toISOString();
  await existing.save();
  return existing.toObject();
}

async function remove(id) {
  const result = await Visitor.deleteOne({ id });
  return result.deletedCount > 0;
}

async function stats() {
  const list = await Visitor.find({}).lean();
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

module.exports = { all, findById, create, update, remove, stats, Visitor };
