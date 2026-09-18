const mongoose = require('mongoose');
const { nanoid } = require('nanoid');

const carouselSlideSchema = new mongoose.Schema({
  id: { type: String, default: () => nanoid(10), unique: true },
  title: { type: String, default: '' },
  tag: { type: String, default: '' },
  description: { type: String, default: '' },
  imagePath: { type: String, default: '' },
  ctaText: { type: String, default: 'Learn More' },
  linkUrl: { type: String, default: '' },
  code: { type: String, default: '' },
  order: { type: Number, default: 0 },
  active: { type: Boolean, default: true },
  createdAt: { type: String, default: () => new Date().toISOString() }
});

const carouselSettingsSchema = new mongoose.Schema({
  id: { type: String, default: 'singleton', unique: true },
  autoplayInterval: { type: Number, default: 5000 },
  autoPlayEnabled: { type: Boolean, default: true }
});

const CarouselSlide = mongoose.models.CarouselSlide || mongoose.model('CarouselSlide', carouselSlideSchema);
const CarouselSettings = mongoose.models.CarouselSettings || mongoose.model('CarouselSettings', carouselSettingsSchema);

const DEFAULT_SLIDES = [
  {
    id: 'slide-grounds',
    title: 'Museo Sang Bata sa Negros',
    tag: 'Coastal Sanctuary',
    description: "A premier hands-on children's museum located on the sunlit coast of Barangay Old Sagay beside the 32,000-hectare Sagay Marine Reserve.",
    imagePath: '/uploads/ex3.jpg',
    ctaText: 'Check In to Enter Museum',
    linkUrl: '/checkin.html',
    code: 'EX-001',
    order: 0,
    active: true
  },
  {
    id: 'slide-marine',
    title: 'Under the Sea (Main Marine Gallery)',
    tag: 'Featured Flagship Exhibit',
    description: 'Discover how sand forms, how vibrant coral reefs grow, and encounter clownfish, sea stars, and the marine mammals of Sagay Marine Reserve.',
    imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/under-the-sea-banner-260x170.jpg',
    ctaText: 'Check In to View Exhibit Details & Audio Tour',
    linkUrl: '/exhibit.html?code=EX-001',
    code: 'EX-001',
    order: 1,
    active: true
  },
  {
    id: 'slide-touchpool',
    title: 'Splash Zone — Live Seashore Creatures',
    tag: 'Hands-on Touch Pool',
    description: 'Gently touch and observe live sea stars, sea cucumbers, snails, and tidal organisms in an engaging, educator-led touch pool.',
    imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/splash-banner-260x170.jpg',
    ctaText: 'Check In to View Touch Pool Details',
    linkUrl: '/exhibit.html?code=EX-003',
    code: 'EX-003',
    order: 2,
    active: true
  },
  {
    id: 'slide-mobile-lib',
    title: 'Books & Exhibits on Wheels',
    tag: 'Community Outreach',
    description: 'Bringing marine conservation literature, storytelling, and interactive science modules to children and schools across coastal communities.',
    imagePath: '/uploads/ex4.jpg',
    ctaText: 'Check In to Learn About Outreach',
    linkUrl: '/programs.html',
    code: 'EX-010',
    order: 3,
    active: true
  },
  {
    id: 'slide-jr-guides',
    title: 'Junior Museum Guides & Mascots',
    tag: 'Youth Leadership',
    description: 'Meet our passionate young docents trained in marine biodiversity, ready to guide visitors through thrilling interactive museum experiences.',
    imagePath: '/uploads/ex2.jpg',
    ctaText: 'Check In to Meet the Junior Guides',
    linkUrl: '/programs.html',
    code: 'EX-006',
    order: 4,
    active: true
  }
];

async function ensureSeed() {
  const count = await CarouselSlide.countDocuments();
  if (count === 0) {
    for (const slide of DEFAULT_SLIDES) {
      const s = new CarouselSlide(slide);
      await s.save();
    }
  }
}

async function all(includeInactive = false) {
  await ensureSeed();
  const query = includeInactive ? {} : { active: { $ne: false } };
  const items = await CarouselSlide.find(query).lean();
  return items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

async function findById(id) {
  return await CarouselSlide.findOne({ id }).lean();
}

async function create(payload) {
  const count = await CarouselSlide.countDocuments();
  const slide = new CarouselSlide({
    id: payload.id || nanoid(10),
    title: (payload.title || '').trim(),
    tag: (payload.tag || '').trim(),
    description: (payload.description || '').trim(),
    imagePath: (payload.imagePath || '').trim(),
    ctaText: (payload.ctaText || 'Learn More').trim(),
    linkUrl: (payload.linkUrl || '').trim(),
    code: (payload.code || '').trim(),
    order: typeof payload.order === 'number' ? payload.order : count,
    active: payload.active !== false
  });
  await slide.save();
  return slide.toObject();
}

async function update(id, payload) {
  const existing = await CarouselSlide.findOne({ id });
  if (!existing) return null;

  if (payload.title !== undefined) existing.title = payload.title.trim();
  if (payload.tag !== undefined) existing.tag = payload.tag.trim();
  if (payload.description !== undefined) existing.description = payload.description.trim();
  if (payload.imagePath !== undefined) existing.imagePath = payload.imagePath.trim();
  if (payload.ctaText !== undefined) existing.ctaText = payload.ctaText.trim();
  if (payload.linkUrl !== undefined) existing.linkUrl = payload.linkUrl.trim();
  if (payload.code !== undefined) existing.code = payload.code.trim();
  if (payload.order !== undefined && Number.isFinite(Number(payload.order))) existing.order = Number(payload.order);
  if (payload.active !== undefined) existing.active = Boolean(payload.active);

  await existing.save();
  return existing.toObject();
}

async function remove(id) {
  const res = await CarouselSlide.deleteOne({ id });
  return res.deletedCount > 0;
}

async function reorder(orderedIds) {
  if (!Array.isArray(orderedIds)) return false;
  for (let i = 0; i < orderedIds.length; i++) {
    await CarouselSlide.updateOne({ id: orderedIds[i] }, { $set: { order: i } });
  }
  return true;
}

async function resetToDefaults() {
  await CarouselSlide.deleteMany({});
  for (const slide of DEFAULT_SLIDES) {
    const s = new CarouselSlide(slide);
    await s.save();
  }
  return await all(true);
}

async function getSettings() {
  let settings = await CarouselSettings.findOne({ id: 'singleton' }).lean();
  if (!settings) {
    settings = new CarouselSettings({ id: 'singleton', autoplayInterval: 5000, autoPlayEnabled: true });
    await settings.save();
    return settings.toObject();
  }
  return settings;
}

async function updateSettings(payload) {
  let settings = await CarouselSettings.findOne({ id: 'singleton' });
  if (!settings) {
    settings = new CarouselSettings({ id: 'singleton' });
  }
  if (payload.autoplayInterval !== undefined) {
    const ms = parseInt(payload.autoplayInterval, 10);
    if (ms >= 1000 && ms <= 60000) {
      settings.autoplayInterval = ms;
    }
  }
  if (payload.autoPlayEnabled !== undefined) {
    settings.autoPlayEnabled = Boolean(payload.autoPlayEnabled);
  }
  await settings.save();
  return settings.toObject();
}

module.exports = {
  all,
  findById,
  create,
  update,
  remove,
  reorder,
  resetToDefaults,
  getSettings,
  updateSettings,
  DEFAULT_SLIDES,
  CarouselSlide,
  CarouselSettings
};
