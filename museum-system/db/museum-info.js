const mongoose = require('mongoose');

const museumInfoSchema = new mongoose.Schema({
  id: { type: String, default: 'singleton', unique: true },
  name: { type: String, default: '' },
  tagline: { type: String, default: '' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  hours: { type: String, default: '' },
  about: { type: String, default: '' },
  entranceFees: { type: [String], default: [] },
  footerLinks: { type: [{ label: String, href: String }], default: [] }
});

const MuseumInfo = mongoose.models.MuseumInfo || mongoose.model('MuseumInfo', museumInfoSchema);

const DEFAULT_INFO = {
  id: 'singleton',
  name: 'Museo Sang Bata sa Negros',
  tagline: "A Hands-on and Interactive Children's Museum. Member of the Intercontinental Museum Network, SAMP",
  address: 'Barangay Old Sagay, Sagay City, Negros Occidental, Philippines 6122',
  phone: '+63 917 798 7420',
  hours: 'Open Monday to Friday, 8:00 AM–5:00 PM. Saturday–Sunday open only for special booked tours.',
  about: "Located on the shoreline of Barangay Old Sagay beside the Sagay Marine Reserve, the museum aims to awaken children's creative and intellectual potential and help them understand and appreciate themselves, their environment, and their culture. Its flagship initiative is the Marine Conservation Education Program, which trains public elementary science teachers to raise awareness of the marine environment among children.",
  entranceFees: [
    'Regular Tour:',
    'Students w/ ID — ₱20.00',
    'Adults — ₱50.00',
    'Senior Citizens — ₱40.00',
    'Special Tour with Jr. Guides & Kassie Kasag:',
    '1 Person — ₱800.00 / person',
    '2 Persons — ₱450.00 / person',
    '3–4 Persons — ₱300.00 / person',
    '5–7 Persons — ₱200.00 / person',
    '8–9 Persons — ₱150.00 / person',
    '10+ Persons — ₱130.00 / person'
  ],
  footerLinks: [
    { label: '💖 Donate', href: '/donate.html' },
    { label: '✉️ Contact', href: '/contact.html' },
    { label: 'ℹ️ About', href: '/about.html' }
  ]
};

async function getInfo() {
  let info = await MuseumInfo.findOne({ id: 'singleton' }).lean();
  if (!info) {
    info = new MuseumInfo(DEFAULT_INFO);
    await info.save();
    return info.toObject();
  }
  return info;
}

async function updateInfo(payload) {
  let info = await MuseumInfo.findOne({ id: 'singleton' });
  if (!info) {
    info = new MuseumInfo(DEFAULT_INFO);
  }
  
  if (payload.name !== undefined) info.name = payload.name;
  if (payload.tagline !== undefined) info.tagline = payload.tagline;
  if (payload.address !== undefined) info.address = payload.address;
  if (payload.phone !== undefined) info.phone = payload.phone;
  if (payload.hours !== undefined) info.hours = payload.hours;
  if (payload.about !== undefined) info.about = payload.about;
  if (payload.entranceFees !== undefined) info.entranceFees = payload.entranceFees;
  if (payload.footerLinks !== undefined) info.footerLinks = payload.footerLinks;
  
  await info.save();
  return info.toObject();
}

module.exports = { getInfo, updateInfo, DEFAULT_INFO, MuseumInfo };