// Reads and updates the singleton record that supplies public museum information.
const mongoose = require('mongoose');

const museumInfoSchema = new mongoose.Schema({
  id: { type: String, default: 'singleton', unique: true },
  name: { type: String, default: '' },
  tagline: { type: String, default: '' },
  address: { type: String, default: '' },
  phone: { type: String, default: '' },
  hours: { type: String, default: '' },
  about: { type: String, default: '' },
  aboutIntro: { type: String, default: '' },
  aboutVision: { type: String, default: '' },
  aboutMission: { type: String, default: '' },
  aboutObjectives: { type: String, default: '' },
  aboutWhatWeDo: { type: String, default: '' },
  aboutFoundationProfile: { type: String, default: '' },
  contactEmail: { type: String, default: '' },
  contactPhones: { type: String, default: '' },
  contactHolidayClosures: { type: String, default: '' },
  contactWhyVisit: { type: String, default: '' },
  donationIntro: { type: String, default: '' },
  donationOpportunities: { type: String, default: '' },
  donationSponsor: { type: String, default: '' },
  donationDollarAccount: { type: String, default: '' },
  donationPesoAccount: { type: String, default: '' },
  donationBank: { type: String, default: '' },
  donationSupportMessage: { type: String, default: '' },
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
  aboutIntro: "A hands-on, interactive children's museum dedicated to marine education, creative learning, and community stewardship in northern Negros Occidental.",
  aboutVision: "A premiere children’s hands-on museum that awakens and stimulates the creative and intellectual potential of children, allowing them to discover, understand, and appreciate themselves, others, their environment, their culture, and the rest of the world.",
  aboutMission: "To establish an alternative center of learning and discovery that enhances and stimulates children to reach their highest potential through marine conservation education and interactive play.",
  aboutObjectives: [
    'Provide children a place to actively make connections among ideas, people, and cultures through creative play.',
    'Encourage children to define their roles in their local community and the global community.',
    'Stimulate children’s creative minds and help them understand, appreciate, love, and be proud of their environment and culture.',
    'Inculcate high moral values so children can make a stand in a rapidly changing world.'
  ].join('\n'),
  aboutWhatWeDo: "The museum serves as an alternative learning center for marine conservation education. Through its exhibits and outreach, MSBN is helping transform attitudes toward the environment in coastal communities. Its flagship program is the Marine Conservation Education Program, which trains public elementary science teachers and raises awareness of marine stewardship among children.\nAnother important initiative is the Museum Junior Guide Program, where children ages 8 to 12 act as museum guides for visitors. This gives young learners practical experience sharing museum stories while building confidence and leadership.",
  aboutFoundationProfile: "Full name: Museo Sang Bata sa Negros Foundation, A Hands-on and Interactive Children’s Museum (Non-stock, non-profit foundation).\nEstablished June 11, 2003. Registered with the Securities and Exchange Commission on November 5, 2002.\nMemberships: West Visayan Association of Museums; SAMP Intercontinental Network of Museums (supported by SIDA).",
  contactEmail: 'museobata@yahoo.com',
  contactPhones: '+639173003815 / +639186171736',
  contactHolidayClosures: 'Christmas, New Year, All Soul’s Day, All Saint’s Day, Holy Thursday, Good Friday, Easter Sunday.',
  contactWhyVisit: 'The museum is a local center for marine education and environmental awareness, designed especially for children. It supports community learning through exhibits, interactive programs, and partnerships with local schools and coastal towns.',
  donationIntro: 'Help the museum continue marine education, community outreach, and conservation programs for children and coastal families.',
  donationOpportunities: 'Annual Fund — Support ongoing museum programs, climate adaptation seminars, and public education campaigns for children and adults.\nBasic Hygiene for Family Learning — Help provide hygiene, health, and wellness support to marginalized coastal families.\nSupport Free School Visits — Sponsor children from public schools to visit the museum, including transportation and guided learning.',
  donationSponsor: 'PHP 2,000 or USD 50 supports a class of 50 public school students for a free museum visit, including transportation.',
  donationDollarAccount: 'Account Name: Museo Sang Bata Sa Negros\nAccount No.: 000000-9007-361-959\nSWIFT Code: BOFAUS3N',
  donationPesoAccount: 'Account Name: Museo Sang Bata sa Negros Foundation Inc.\nChecking Account No.: 0088-00577-6',
  donationBank: 'Rizal Commercial Bank Corporation (RCBC), Bacolod City Branch, Lacson St., Negros Occidental, Philippines',
  donationSupportMessage: 'Every gift helps the museum carry out marine educational programs, design exhibitions, and raise awareness of marine resources in the coastal communities around Sagay City.',
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

// Return stored museum details combined with defaults for older records.
async function getInfo() {
  const storedInfo = await MuseumInfo.findOne({ id: 'singleton' }).lean();
  if (!storedInfo) {
    const info = new MuseumInfo(DEFAULT_INFO);
    await info.save();
    return info.toObject();
  }
  return { ...DEFAULT_INFO, ...storedInfo };
}

// Apply supplied fields to the singleton record, backfilling defaults for older installs.
async function updateInfo(payload) {
  const storedInfo = await MuseumInfo.findOne({ id: 'singleton' }).lean();
  const info = storedInfo
    ? await MuseumInfo.findOne({ id: 'singleton' })
    : new MuseumInfo(DEFAULT_INFO);

  if (storedInfo) {
    for (const [key, value] of Object.entries(DEFAULT_INFO)) {
      if (key !== 'id' && storedInfo[key] === undefined) info[key] = value;
    }
  }
  
  if (payload.name !== undefined) info.name = payload.name;
  if (payload.tagline !== undefined) info.tagline = payload.tagline;
  if (payload.address !== undefined) info.address = payload.address;
  if (payload.phone !== undefined) info.phone = payload.phone;
  if (payload.hours !== undefined) info.hours = payload.hours;
  if (payload.about !== undefined) info.about = payload.about;
  if (payload.aboutIntro !== undefined) info.aboutIntro = payload.aboutIntro;
  if (payload.aboutVision !== undefined) info.aboutVision = payload.aboutVision;
  if (payload.aboutMission !== undefined) info.aboutMission = payload.aboutMission;
  if (payload.aboutObjectives !== undefined) info.aboutObjectives = payload.aboutObjectives;
  if (payload.aboutWhatWeDo !== undefined) info.aboutWhatWeDo = payload.aboutWhatWeDo;
  if (payload.aboutFoundationProfile !== undefined) info.aboutFoundationProfile = payload.aboutFoundationProfile;
  if (payload.contactEmail !== undefined) info.contactEmail = payload.contactEmail;
  if (payload.contactPhones !== undefined) info.contactPhones = payload.contactPhones;
  if (payload.contactHolidayClosures !== undefined) info.contactHolidayClosures = payload.contactHolidayClosures;
  if (payload.contactWhyVisit !== undefined) info.contactWhyVisit = payload.contactWhyVisit;
  if (payload.donationIntro !== undefined) info.donationIntro = payload.donationIntro;
  if (payload.donationOpportunities !== undefined) info.donationOpportunities = payload.donationOpportunities;
  if (payload.donationSponsor !== undefined) info.donationSponsor = payload.donationSponsor;
  if (payload.donationDollarAccount !== undefined) info.donationDollarAccount = payload.donationDollarAccount;
  if (payload.donationPesoAccount !== undefined) info.donationPesoAccount = payload.donationPesoAccount;
  if (payload.donationBank !== undefined) info.donationBank = payload.donationBank;
  if (payload.donationSupportMessage !== undefined) info.donationSupportMessage = payload.donationSupportMessage;
  if (payload.entranceFees !== undefined) info.entranceFees = payload.entranceFees;
  if (payload.footerLinks !== undefined) info.footerLinks = payload.footerLinks;
  
  await info.save();
  return info.toObject();
}

module.exports = { getInfo, updateInfo, DEFAULT_INFO, MuseumInfo };