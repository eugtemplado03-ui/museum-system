const { load, save } = require('./store');

const DEFAULT_INFO = {
  name: 'Museo Sang Bata sa Negros',
  tagline: "A Hands-on and Interactive Children's Museum. Member of the Intercontinental Museum Network, SAMP",
  address: 'Barangay Old Sagay, Sagay City, Negros Occidental, Philippines 6122',
  phone: '+63 917 798 7420',
  hours: 'Open Monday to Friday, 8:00 AM–5:00 PM. Saturday–Sunday open only for special booked tours.',
  about: "Located on the shoreline of Barangay Old Sagay beside the Sagay Marine Reserve, the museum aims to awaken children's creative and intellectual potential and help them understand and appreciate themselves, their environment, and their culture. Its flagship initiative is the Marine Conservation Education Program, which trains public elementary science teachers to raise awareness of the marine environment among children.",
  entranceFees: [
    'Regular tour — Students w/ ID: PHP 20.00, Adults: PHP 50.00, Senior citizens: PHP 40.00',
    'Special guided tour (with Jr. Guides): PHP 800/person (1 pax), PHP 450/person (2 pax), PHP 300/person (3–4 pax), PHP 200/person (5–7 pax), PHP 150/person (8–9 pax), PHP 130/person (10+ pax)'
  ],
  footerLinks: [
    { label: '💖 Donate', href: '/donate.html' },
    { label: '✉️ Contact', href: '/contact.html' },
    { label: 'ℹ️ About', href: '/about.html' }
  ]
};

function ensureInfo(data) {
  if (!data.museumInfo) {
    data.museumInfo = DEFAULT_INFO;
    save(data);
  }
  return data.museumInfo;
}

function getInfo() {
  const data = load();
  return ensureInfo(data);
}

function updateInfo(payload) {
  const data = load();
  ensureInfo(data);
  data.museumInfo = {
    ...data.museumInfo,
    ...payload,
    footerLinks: payload.footerLinks || data.museumInfo.footerLinks,
    entranceFees: payload.entranceFees || data.museumInfo.entranceFees
  };
  save(data);
  return data.museumInfo;
}

module.exports = { getInfo, updateInfo, DEFAULT_INFO };