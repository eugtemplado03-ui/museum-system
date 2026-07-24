// Run with: npm run seed
// Creates the first admin account (if none exists) and loads the real
// exhibit list for Museo Sang Bata sa Negros (if the catalog is empty),
// sourced from https://museosangbata.org/ and its /exhibits/ pages.
// Descriptions below are paraphrased summaries, not copied text — edit
// freely from the admin dashboard once the site is running.

const bcrypt = require('bcryptjs');
const users = require('../db/users');
const exhibits = require('../db/exhibits');

const ADMIN_USERNAME = process.env.SEED_ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASS || 'museum-admin-2026';

function seedAdmin() {
  if (users.count() > 0) {
    console.log('Users already exist — skipping admin creation.');
    return;
  }
  const passwordHash = bcrypt.hashSync(ADMIN_PASSWORD, 10);
  users.create({ username: ADMIN_USERNAME, passwordHash, role: 'admin' });
  console.log(`Created admin user "${ADMIN_USERNAME}" with password "${ADMIN_PASSWORD}".`);
  console.log('IMPORTANT: sign in and change this password / rotate credentials before going live.');
}

function seedExhibits() {
  if (exhibits.all().length > 0) {
    console.log('Exhibits already exist — skipping sample data.');
    return;
  }
  const samples = [
    {
      title: 'Under the Sea',
      category: 'Marine & Nature',
      origin: "Museum's main exhibit",
      year: 'Permanent exhibit',
      location: 'Main Exhibit Hall',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/under-the-sea-banner-260x170.jpg',
      description: "The museum's flagship exhibit on the marine environment — how sand forms, how coral reefs grow and the threats facing them, marine mammals, and the role mangroves play along the coast."
    },
    {
      title: 'The River',
      category: 'Marine & Nature',
      origin: 'Marine Conservation Education Program',
      year: 'Permanent exhibit',
      location: 'Main Exhibit Hall',
      imagePath: '',
      description: "One of the museum's eight permanent exhibits, following freshwater systems on their way toward the sea — part of the museum's broader effort to build appreciation for Negros' marine and coastal environment."
    },
    {
      title: 'Splash Zone (Touch Pool)',
      category: 'Touch & Play',
      origin: 'Live touch-pool exhibit',
      year: 'Permanent exhibit',
      location: 'Splash Zone',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/splash-banner-260x170.jpg',
      description: "A hands-on touch pool where visitors can see and gently handle seashore creatures — sea stars, sea cucumbers, snails, and small fish — a favorite stop for kids and adults alike."
    },
    {
      title: 'Everyday Heroes',
      category: 'Character & Heritage',
      origin: 'Character education exhibit',
      year: 'Permanent exhibit',
      location: 'Character Gallery',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/everyday-heroes-banner-260x170.jpg',
      description: "Profiles of ordinary people who quietly live out values like hard work, thrift, generosity, fairness, forgiveness and courage — encouraging visitors to see everyday character as its own kind of heroism."
    },
    {
      title: 'Joseph G. Marañon Memorabilia',
      category: 'Character & Heritage',
      origin: 'Dedicated to the late Gov. Joseph G. Marañon',
      year: 'Permanent exhibit',
      location: 'Memorial Gallery',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2014/09/jgm-banner-260x170.jpg',
      description: "A memorial exhibit honoring the late Negros Occidental Governor Joseph G. Marañon, preserving memorabilia connected to his life and public service."
    },
    {
      title: 'Hampanganan (Toy Room)',
      category: 'Toys & Collections',
      origin: 'Mara Montelibano folk toy collection',
      year: 'Permanent exhibit',
      location: 'Toy Room',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2014/09/hampanganan-banner-260x170.jpg',
      description: "A folk toy collection spanning more than 50 countries, gathered by Ms. Mara Montelibano, alongside donated McDonald's promotional toys and a Beanie Babies collection."
    },
    {
      title: 'Biodiversity',
      category: 'Marine & Nature',
      origin: 'Marine Conservation Education Program',
      year: 'Permanent exhibit',
      location: 'Main Exhibit Hall',
      imagePath: '',
      description: "One of the museum's eight permanent exhibits, introducing the range of plant and animal life found across Negros' marine and coastal habitats."
    },
    {
      title: 'Story of Plastic',
      category: 'Environmental',
      origin: 'Companion piece to the "Floating Witches" art installation',
      year: 'Since 2019',
      location: 'Environmental Gallery',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2019/01/image2-1-e1548236083574-260x170.jpeg',
      description: "An exhibit raising awareness about plastic waste and its impact on marine life around Negros and Sagay, created alongside the museum's 'Floating Witches' installation made from discarded fishing nets."
    },
    {
      title: 'Carnival (Discovery Room)',
      category: 'Touch & Play',
      origin: "The museum's discovery room",
      year: 'Since 2019',
      location: 'Discovery Room',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2019/01/image2-e1548236620227-260x170.jpeg',
      description: "A playful discovery room built around the idea that play is learning — supporting children's healthy development through open-ended, hands-on activity."
    },
    {
      title: "Franco's Reading Corner",
      category: 'Reading & Learning',
      origin: 'Opened March 28, 2019',
      year: 'Since 2019',
      location: 'Reading Corner',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2019/04/IMG_9526-260x170.jpg',
      description: "A dedicated children's reading nook, blessed and opened to the public in March 2019 to encourage a love of books alongside the museum's hands-on exhibits."
    },
    {
      title: 'Mangrove Walk (Outdoor Exhibit)',
      category: 'Marine & Nature',
      origin: 'Outdoor extension of the indoor mangrove exhibit',
      year: 'Permanent exhibit',
      location: 'Outdoor — behind the main building',
      imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/mangrove-walk-banner-260x170.jpg',
      description: "A small mangrove park and walkway behind the museum showcasing different mangrove species up close, used alongside the museum's mangrove seminars and indoor exhibit."
    }
  ];
  samples.forEach(s => exhibits.create(s));
  console.log(`Seeded ${samples.length} exhibits based on museosangbata.org.`);
}

function seedPrograms() {
  const programs = require('../db/programs');
  if (programs.all().length > 0) {
    console.log('Programs already exist — skipping.');
    return;
  }
  const items = [
    { title: 'Junior Museum Guide Program', ageRange: '7–12', schedule: 'Ongoing training cohorts',
      description: 'Children are trained to act as guides for visitors touring the museum. More than 300 children have completed the program to date.' },
    { title: 'Junior Interactive Storytelling Program', ageRange: '7–12', schedule: 'Ongoing, tied to the Museo Reading Club',
      description: 'Children learn to interpret stories through action, song and dance. Most participants are also members of the Museo Reading Club.' },
    { title: '4 Vegetable Program', ageRange: 'All museum visitors', schedule: 'Ongoing',
      description: 'A hands-on gardening program where children grow four kinds of vegetables, built around the idea that eating right starts early.' },
    { title: 'Basic Hygiene Program', ageRange: 'All museum visitors', schedule: 'Ongoing',
      description: 'Teaches the basics of personal hygiene — proper toothbrushing, bathing, hair washing, and nail care.' },
    { title: 'Revival of Intangible Cultural Heritage Program', ageRange: 'All ages', schedule: 'Includes annual "Adlaw sang Kabataan" (Children\'s Day)',
      description: 'Aims to revive disappearing songs, games, dances and crafts through Music and Dance Workshops, culminating in the yearly Children\'s Day celebration.' },
    { title: 'Museum Volunteers Program', ageRange: 'Any age', schedule: 'Ongoing, flexible',
      description: 'Open to anyone who wants to contribute time, talent, or resources to the museum. Over 100 volunteers have taken part over the years.' },
    { title: 'Teen Health Club', ageRange: '13–17', schedule: 'Ongoing',
      description: 'A club addressing the health issues and challenges teens face while growing up, for kids who are "no longer children but not old enough" to be treated as adults.' },
    { title: 'Marine Biodiversity Conservation and Climate Change Adaptation Education Program', ageRange: 'Teachers, students & community', schedule: 'Ongoing outreach and training',
      description: "The museum's flagship program, training public elementary science teachers and running outreach to mothers, fisherfolk, boatmen, and schools on marine conservation and climate adaptation." }
  ];
  items.forEach(i => programs.create(i));
  console.log(`Seeded ${items.length} programs based on museosangbata.org.`);
}

function seedEvents() {
  const events = require('../db/events');
  if (events.all().length > 0) {
    console.log('Events already exist — skipping.');
    return;
  }
  const items = [
    { title: 'Museo Sang Bata Sa Negros Turns 23', date: '2026-06-10', location: 'Museo Sang Bata sa Negros',
      description: 'The museum marked 23 years since its founding in 2003 — from a small idea to a hands-on children\'s museum serving thousands of families across Negros.' },
    { title: 'Adlaw Sang Kabataan 2026', date: '2026-03-17', location: 'Museo Sang Bata sa Negros',
      description: "The museum's 18th annual Children's Day celebration — a yearly inter-school competition. The 2026 edition drew 34 schools and 320 kids." },
    { title: 'Recycling Workshop and Storytelling', date: '2026-02-21', location: 'Purok Camantigue B, Sitio Looc, Brgy. Old Sagay',
      description: 'A community outreach workshop where kids made pencil holders from plastic bottles and popsicle sticks, paired with a storytelling session.' },
    { title: 'Museum Junior Guide Training', date: '2026-05-18', location: 'Museo Sang Bata sa Negros',
      description: 'An 11-day training program (May 18–28) for new and returning Junior Museum Guides, covering exhibit familiarization and public speaking.' },
    { title: 'Mobile Library Launch: "Books and Exhibit on Wheels"', date: '2019-02-15', location: 'Museo Sang Bata sa Negros',
      description: "Blessing and launch of the museum's mobile library initiative, bringing books and mini-exhibits to communities outside the museum, supported by local book donors and legislators." }
  ];
  items.forEach(i => events.create(i));
  console.log(`Seeded ${items.length} events based on museosangbata.org.`);
}

function seedGallery() {
  const gallery = require('../db/gallery');
  if (gallery.all().length > 0) {
    console.log('Gallery already has items — skipping.');
    return;
  }
  const items = [
    { title: 'Carnival Exhibit', caption: 'Play-based learning in the discovery room.', imagePath: 'https://museosangbata.org/wp-content/uploads/2019/01/image2-e1548236620227-260x170.jpeg' },
    { title: 'Under the Sea', caption: "The museum's flagship marine exhibit.", imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/under-the-sea-banner-260x170.jpg' },
    { title: 'Mangrove Walk', caption: 'The outdoor mangrove walkway behind the museum.', imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/mangrove-walk-banner-260x170.jpg' },
    { title: 'Friendship Room / Training Room', caption: 'Used for workshops and junior guide training.', imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/training-room-banner-260x170.jpg' },
    { title: 'The Toy Library', caption: 'Toys available for children to borrow and play with.', imagePath: 'https://museosangbata.org/wp-content/uploads/2014/11/toy-library-banner-260x170.jpg' },
    { title: 'Mobile Library Launch', caption: '"Books and Exhibit on Wheels" blessing and launch, February 2019.', imagePath: 'https://museosangbata.org/wp-content/uploads/2019/04/IMG_0150-260x170.jpg' }
  ];
  items.forEach(i => gallery.create(i));
  console.log(`Seeded ${items.length} gallery photos based on museosangbata.org.`);
}

seedAdmin();
seedExhibits();
seedPrograms();
seedEvents();
seedGallery();
