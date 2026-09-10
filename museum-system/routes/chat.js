const express = require('express');
const exhibits = require('../db/exhibits');
const programs = require('../db/programs');
const events = require('../db/events');
const museumInfo = require('../db/museum-info');

const router = express.Router();

const SITE_URL = process.env.SITE_URL || 'http://localhost:3000';
const SITE_NAME = process.env.SITE_NAME || 'Museo Sang Bata sa Negros';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 14;

// Rate limiter per IP (generous so visitors can have full conversations)
const rateLimitMap = new Map();
function isRateLimited(ip) {
  const entry = rateLimitMap.get(ip) || { count: 0, resetAt: Date.now() + 10 * 60 * 1000 };
  if (Date.now() > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = Date.now() + 10 * 60 * 1000;
  }
  entry.count += 1;
  rateLimitMap.set(ip, entry);
  return entry.count > 60; // 60 messages / 10 min / IP
}

let cachedContext = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 90 * 1000; // 90 seconds cache

async function getFullMuseumContext() {
  const now = Date.now();
  if (cachedContext && (now - cacheTimestamp < CACHE_TTL_MS)) {
    return cachedContext;
  }
  try {
    const [info, allExhibits, allPrograms, allEvents] = await Promise.all([
      museumInfo.getInfo(),
      exhibits.all(),
      programs.all(),
      events.all()
    ]);
    cachedContext = { info, allExhibits, allPrograms, allEvents };
    cacheTimestamp = now;
    return cachedContext;
  } catch (err) {
    console.warn('Error fetching museum context, using fallback default:', err.message);
    if (cachedContext) return cachedContext;
    return {
      info: { name: SITE_NAME, address: 'Barangay Old Sagay, Sagay City', phone: '+63 917 798 7420', entranceFees: [] },
      allExhibits: [],
      allPrograms: [],
      allEvents: []
    };
  }
}

function buildSystemPrompt(context) {
  const { info, allExhibits, allPrograms, allEvents } = context;

  const exhibitBlock = (allExhibits || []).map(e => (
    `- [${e.code || 'EXHIBIT'}] "${e.title}" (Category: ${e.category || 'General'}, Floor: Level ${e.floor === 2 ? 2 : 1})
      Location in museum: ${e.location || 'Exhibition floor'}
      Description: ${e.description || 'Interactive hands-on exhibit.'}
      ${e.directions ? `Walking Directions: ${typeof e.directions === 'object' ? (e.directions.en || '') : e.directions}` : ''}`
  )).join('\n\n');

  const programBlock = allPrograms.map(p => (
    `- "${p.title}"${p.ageRange ? ' (Recommended Ages: ' + p.ageRange + ')' : ''}: ${p.description || 'Educational program.'}`
  )).join('\n');

  const eventBlock = allEvents.map(e => (
    `- "${e.title}" — Date/Schedule: ${e.date || 'Scheduled event'}: ${e.description || 'Museum event.'}`
  )).join('\n');

  const feesBlock = (info.entranceFees || []).map(f => `- ${f}`).join('\n');

  return `You are "Bata Guide", the friendly, knowledgeable AI visitor assistant for ${info.name}, located in Barangay Old Sagay, Sagay City, Negros Occidental, Philippines.

YOUR ROLE & TONE:
- You represent the premier interactive children's museum in the Visayas, established in 2003 and a proud member of the Intercontinental Museum Network (SAMP).
- Your tone is warm, enthusiastic, helpful, polite, family-friendly, and encouraging for children, parents, teachers, and travelers.
- You can understand and respond fluently in English, Tagalog/Filipino, or Hiligaynon/Bisaya/Cebuano depending on what language the user speaks!

COMPLETE MUSEUM KNOWLEDGE BASE:

1. ARCHITECTURAL LAYOUT & FACILITIES:
- Main Entrance & Foyer: The primary visitor entryway featuring ticket desk, reception, access ramp, and double glass doors.
- Accessibility & Ramp: Fully accessible for wheelchairs and strollers. An exterior access ramp is situated at the main entrance alongside wide steps. All Ground Floor galleries and Function Hall are on a single flat level with wide doorways.
- Function Hall: The large central multi-purpose hall for school gatherings, orientations, presentations, and workshops.
- Staff Office: Located on LEVEL 1 (Ground Floor) INSIDE the Central Function Hall, situated DIRECTLY UNDER THE STAIRCASE, beside the Joseph G. Marañon memorial section. Visitors can find administration, tour coordinators, and front-desk staff here.
- Staircase to Level 2: Located in the Function Hall along the west wall (directly above the Staff Office), leading up to the second floor mezzanine.
- Marine & Nature Room (Ground Floor): Flagship central gallery housing Under the Sea, The River, Biodiversity, Story of Plastic, and Mangrove Walk.
- Touch & Play Room / Splash Zone (Ground Floor East Wing): Houses our live marine Touch Pool basin with gentle seashore creatures (sea stars, sea cucumbers, hermit crabs, reef fish).
- Library Extension Wing (Ground Floor West Wing): Features Franco's Reading Corner (storybook nook) and Character & Heritage Room (Gov. Joseph G. Marañon Memorabilia and Everyday Heroes).
- Aquarium & Reef Systems (Ground Floor North Wall): Saltwater tanks showcasing tropical corals and fish.
- Level 2 (Upper Mezzanine): Reached via the staircase, featuring:
  1. Toys & Collections Room ("Hampanganan"): Folk toys from over 50 countries donated by Ms. Mara Montelibano, vintage McDonald's promotional toys, and Beanie Babies collection.
  2. Carnival & Discovery Room: Interactive Play Lab with hands-on game hubs and sensory stations.
  3. Mezzanine Balcony Void: Open-to-below balcony with safety handrails overlooking the Function Hall.

2. VISITOR POLICIES & GUIDELINES:
- Photography & Video: Souvenir photos and personal smartphone videos are warmly encouraged throughout the museum! Please turn off harsh camera flash when photographing the live saltwater aquariums and Touch Pool to protect marine life. Commercial or media filming requires advance coordination with the Staff Office.
- Food & Drinks: Eating and drinking are prohibited inside the exhibition galleries and at the Touch Pool to protect artifacts and animal habitats. Visitors may enjoy snacks, packed lunches (baon), and drinks in outdoor areas or designated seating in the Function Hall during breaks.
- Hands-on Touching Rules: Touching is encouraged on interactive exhibits! At the Splash Zone Touch Pool, visitors must wash hands with water (no soap) before touching and handle animals gently without lifting them completely out of the water.
- Age Groups & Duration: Perfect for all ages from toddlers to teens and adults! A typical visit takes 1.5 to 2.5 hours. Children under 12 should be accompanied by an adult, teacher, or Junior Museum Guide.

3. ADMISSION FEES & SCHEDULE:
- Opening Hours: Monday to Friday: 8:00 AM – 5:00 PM. Saturday & Sunday: Open for advance-booked group tours and special events.
- Regular Admission:
${feesBlock}
  • Children under 3 years old are free of charge.
- Junior Museum Guides: Guided tours are led by our trained youth "Junior Guides" who explain marine science in a lively, kid-friendly way.

4. LOCATION, COMMUTE & TRAVEL DIRECTIONS:
- Address: ${info.address} (Located along the shoreline at Barangay Old Sagay, beside the Sagay Marine Reserve and Old Sagay Port).
- Phone / Contact: ${info.phone}
- From Bacolod City: Take a Ceres Bus or passenger van from Bacolod North Terminal to Sagay City bus terminal (~2 to 2.5 hours). From Sagay terminal, take a tricycle or pedicab directly to Museo Sang Bata sa Negros at Old Sagay Port (~10 to 15 minutes).
- Parking: Free parking is available in front of the museum.

5. SCHOOL FIELD TRIPS, GROUPS & EVENTS:
- School delegations, field trips (lakbay-aral), and group tours can reserve by calling ${info.phone} or emailing info@museosangbata.org.
- Advance reservation is recommended for groups of 15+ to ensure assigned Junior Guides and tailored science workshops.

6. DONATIONS & VOLUNTEERING:
- The museum is a non-profit foundation. Donations directly sponsor educational admissions for underprivileged public school children and maintain our live marine habitats. Visitors can donate via the website (/donate.html) or at the Staff Office.

7. EXHIBITS CATALOG:
${exhibitBlock || 'Exhibits available on site.'}

8. PROGRAMS & WORKSHOPS:
${programBlock || 'Marine education and storytelling programs.'}

9. UPCOMING EVENTS:
${eventBlock || 'Regular interactive tours.'}

ANSWERING INSTRUCTIONS:
- Answer ALL user questions clearly and helpfully using the information above.
- If asked where something is located (e.g., Staff Office, Touch Pool, stairs, exhibits), provide exact architectural directions based on the layout above.
- When asked in Tagalog or Bisaya/Cebuano, answer in that language with warm Filipino hospitality.
- Use clear markdown with bullet points or bold text where appropriate so the response is easy to read.`;
}

// ─── Intelligent Local Fallback Engine (Answers ALL Questions Offline / Resilient) ───
function generateLocalFallbackReply(userMessage, { info, allExhibits, allPrograms, allEvents }) {
  const msg = (userMessage || '').toLowerCase().trim();

  // Helper detect language
  const isBisaya = /\b(unsa|asa|tagpila|pila|ninyo|diin|hain|adlaw|bata|palihug|nako|nimo|nganong|kaayo|kaon|inum)\b/i.test(msg);
  const isTagalog = /\b(ano|saan|magkano|paano|kailan|meron|po|ba|namin|ninyo|pwede|pumunta|kuha|litrato|pagkain|inumin|sino)\b/i.test(msg);

  // 1. Staff Office Location
  if (msg.includes('staff office') || msg.includes('office') || msg.includes('admin') || msg.includes('opisina') || (msg.includes('staff') && (msg.includes('where') || msg.includes('saan') || msg.includes('asa') || msg.includes('diin')))) {
    if (isBisaya) {
      return `💼 **Lokasyon sa Staff Office:**\nAng **Staff Office** anaa sa **Level 1 (Ground Floor)** sa sulod sa **Central Function Hall, diretso sa ilalom sa hagdanan (under the stairs)**, tapad sa J.G. Marañon memorial gallery section.\n\nKung kinahanglan nimo og tabang sa tour booking, pangutana sa administrasyon, o mopalit og tiket, pagsulod lang sa Main Entrance, tabok sa Function Hall, ug liko sa wala padulong sa ilalom sa hagdanan!`;
    }
    if (isTagalog) {
      return `💼 **Lokasyon ng Staff Office:**\nAng **Staff Office** ay matatagpuan sa **Level 1 (Ground Floor)** sa loob ng **Central Function Hall, direktang nasa ilalim ng hagdanan (under the stairs)**, katabi ng J.G. Marañon memorial section.\n\nKung kailangan ninyo ng tulong sa tour booking, impormasyon sa pamunuan, o tulong ng staff, pumasok lamang sa Main Entrance, tumawid sa Function Hall, at kumaliwa patungo sa ilalim ng hagdan!`;
    }
    return `💼 **Staff Office Location:**\nThe **Staff Office** is located on **Level 1 (Ground Floor) inside the Central Function Hall, situated directly under the stairs** and right beside the J.G. Marañon memorial gallery section.\n\nIf you need administrative assistance, tour booking coordination, or staff guidance, simply enter through the Main Entrance doors, walk across the Function Hall, and look to your left under the staircase!`;
  }

  // 2. Wheelchair Access & Ramp
  if (msg.includes('wheelchair') || msg.includes('ramp') || msg.includes('accessible') || msg.includes('pwd') || msg.includes('stroller') || msg.includes('disab')) {
    if (isTagalog || isBisaya) {
      return `♿ **Accessibility at Wheelchair Ramp:**\nOo, accessible ang Museo Sang Bata sa Negros para sa mga naka-wheelchair at stroller!\n\n- **Entrance Ramp:** May kongkretong access ramp sa harapan ng Main Entrance katabi ng mga baytang ng hagdan.\n- **Ground Floor:** Ang lahat ng gallery sa Ground Floor (Marine & Nature Room, Touch Pool, Franco's Reading Corner, Character & Heritage Room, at Function Hall) ay nasa iisang patag na palapag na may malalapad na pintuan.`;
    }
    return `♿ **Accessibility & Wheelchair Access:**\nYes! Museo Sang Bata sa Negros is fully wheelchair and stroller accessible.\n\n- **Access Ramp:** A dedicated exterior concrete access ramp is located directly at the front entrance alongside the steps, leading smoothly through the wide double entrance doors into the reception foyer.\n- **Ground Floor Layout:** All Ground Floor exhibition rooms (Marine & Nature Room, Splash Zone Touch Pool, Reading Corner, Heritage Gallery, and Function Hall) are on a single flat level with wide open entryways.`;
  }

  // 3. Photography & Videography Rules
  if (msg.includes('photo') || msg.includes('picture') || msg.includes('camera') || msg.includes('video') || msg.includes('shoot') || msg.includes('film') || msg.includes('selfie') || msg.includes('litrato') || msg.includes('kuha')) {
    if (isTagalog || isBisaya) {
      return `📸 **Panuntunan sa Pagkuha ng Litrato at Video:**\n- **Personal Photos & Videos:** Pwedeng-pwede po kumuha ng litrato at souvenir videos kasama ang pamilya at interactive exhibits!\n- **Pakiusap sa Flash:** Iwasan po ang malakas na camera flash malapit sa mga saltwater aquarium at Touch Pool upang hindi maabala ang mga live marine animals.\n- **Commercial Shoots:** Para sa commercial filming, video shoots, o media coverage, mangyaring makipag-ugnayan muna sa Staff Office.`;
    }
    return `📸 **Photography & Video Guidelines:**\n- **Personal Souvenir Photos & Videos:** Warmly welcomed! Visitors, children, and families are encouraged to take souvenir photos and videos with our interactive displays.\n- **Flash Precaution:** Please turn off harsh camera flash when taking photos around the live saltwater aquariums and Touch Pool to safeguard the sensitive eyes of our marine animals.\n- **Commercial Shoots:** Commercial filming or media coverage requires advance coordination with museum management at the Staff Office.`;
  }

  // 4. Food & Drinks Rules
  if (msg.includes('food') || msg.includes('drink') || msg.includes('snack') || msg.includes('eat') || msg.includes('water') || msg.includes('lunch') || msg.includes('baon') || msg.includes('pagkain') || msg.includes('kaon') || msg.includes('inum')) {
    if (isTagalog || isBisaya) {
      return `🍱 **Panuntunan sa Pagkain at Inumin:**\n- Bawal po kumain at uminom sa loob ng mga **exhibition galleries** at sa tabi ng **Touch Pool** upang maprotektahan ang mga exhibits, aklat, at mga yamang-dagat.\n- Maaari ninyong kainin ang inyong baon, meryenda, o inumin sa mga designated seating areas sa labas ng museo o sa loob ng **Function Hall** tuwing break time.`;
    }
    return `🍱 **Food & Beverage Policy:**\n- To protect our interactive displays, storybooks, and living sea creatures, eating and drinking are strictly prohibited inside the exhibition galleries and at the Touch Pool.\n- Visitors are welcome to enjoy their packed lunches (*baon*), snacks, and refreshments outside the building or at designated seating areas in the central Function Hall during scheduled tour breaks.`;
  }

  // 5. Entrance Fees & Ticket Rates
  if (msg.includes('ticket') || msg.includes('fee') || msg.includes('price') || msg.includes('entrance') || msg.includes('cost') || msg.includes('magkano') || msg.includes('tagpila') || msg.includes('bayad') || msg.includes('pila')) {
    const feesList = (info.entranceFees && info.entranceFees.length) ? info.entranceFees.map(f => `• ${f}`).join('\n') : `• Students with ID: ₱20.00\n• Senior Citizens & PWD: ₱40.00\n• Adults: ₱50.00`;
    if (isBisaya) {
      return `🎟️ **Bayad sa Entrance & Tickets:**\n${feesList}\n• Libre ang mga bata ubos sa 3 anyos.\n\nMakapalit kamo og ticket sa Visitor Reception Desk pag-abot ninyo sa Main Entrance!`;
    }
    if (isTagalog) {
      return `🎟️ **Halaga ng Entrance Ticket:**\n${feesList}\n• Libre ang mga batang wala pang 3 taong gulang.\n\nMabibili ang tickets sa Visitor Reception Desk pagpasok sa Main Entrance!`;
    }
    return `🎟️ **Entrance Fees & Admission Rates:**\n${feesList}\n• Children under 3 years old enter for free.\n\nTickets can be purchased directly upon arrival at the Visitor Reception & Ticketing Foyer!`;
  }

  // 6. Hours & Schedule
  if (msg.includes('hour') || msg.includes('time') || msg.includes('open') || msg.includes('close') || msg.includes('schedule') || msg.includes('oras') || msg.includes('bukas') || msg.includes('sirado') || msg.includes('weekend') || msg.includes('sunday') || msg.includes('saturday')) {
    if (isTagalog || isBisaya) {
      return `⏰ **Oras at Iskedyul ng Museo:**\n- **Lunes hanggang Biyernes:** 8:00 AM – 5:00 PM (bukas para sa regular walk-ins, pamilya, at school field trips).\n- **Sabado at Linggo:** Bukas para sa mga advance-booked group tours at special events.\n- **Rekomendadong Oras:** Karaniwang tumatagal ng 1.5 hanggang 2.5 oras ang paglilibot sa lahat ng exhibits sa Ground Floor at Level 2.`;
    }
    return `⏰ **Operating Hours & Schedule:**\n- **Monday to Friday:** 8:00 AM – 5:00 PM (open for general public, walk-ins, families, and school tours).\n- **Saturday & Sunday:** Open exclusively for advance-booked group tours and special reservations.\n- **Recommended Duration:** Most visitors spend about 1.5 to 2.5 hours exploring all interactive galleries across both floors.`;
  }

  // 7. Level 2 / Second Floor / Stairs
  if (msg.includes('level 2') || msg.includes('second floor') || msg.includes('2nd floor') || msg.includes('mezzanine') || msg.includes('stairs') || msg.includes('hagdan') || msg.includes('itaas')) {
    return `🪜 **Level 2 (Upper Mezzanine Level):**\nAccessed via the staircase inside the Function Hall (directly above the Staff Office), Level 2 houses:\n1. **🧸 Toys & Collections Room (*Hampanganan*):** A world of folk toys from over 50 countries, vintage McDonald's promotional toys, and Beanie Babies collection.\n2. **🎡 Carnival & Discovery Room:** An interactive Play Lab featuring sensory exploration hubs, game stations, and brain-teasing puzzles.\n3. **👀 Mezzanine Void Balcony:** An open-to-below balcony overlooking the central Function Hall.`;
  }

  // 8. Touch Pool / Splash Zone
  if (msg.includes('touch pool') || msg.includes('splash zone') || msg.includes('starfish') || msg.includes('cucumber') || msg.includes('touch and play') || msg.includes('hikap')) {
    return `💦 **Touch & Play Room (Splash Zone):**\nLocated in the Ground Floor East Wing, the Splash Zone features our famous living marine **Touch Pool**!\n- Children and visitors can gently interact with real seashore animals including sea stars (starfish), sea cucumbers, hermit crabs, sea snails, and small reef fish.\n- Junior Museum Guides assist each visitor to ensure animals are handled safely and respectfully underwater.`;
  }

  // 9. Specific Exhibit queries
  const matchedExhibit = (allExhibits || []).find(e => {
    const t = (e.title || '').toLowerCase();
    const c = (e.code || '').toLowerCase();
    return msg.includes(t) || msg.includes(c) || (e.category && msg.includes(e.category.toLowerCase()));
  });

  if (matchedExhibit) {
    return `📦 **Exhibit: ${matchedExhibit.title} (${matchedExhibit.code || 'EXHIBIT'})**\n- **Category:** ${matchedExhibit.category || 'General'}\n- **Floor:** Level ${matchedExhibit.floor === 2 ? 2 : 1}\n- **Location:** ${matchedExhibit.location || 'Exhibition area'}\n- **Overview:** ${matchedExhibit.description || 'Hands-on interactive learning display.'}\n${matchedExhibit.directions ? `\n🧭 **How to Reach It:** ${typeof matchedExhibit.directions === 'object' ? (matchedExhibit.directions.en || '') : matchedExhibit.directions}` : ''}`;
  }

  // 10. General Exhibits List
  if (msg.includes('exhibit') || msg.includes('gallery') || msg.includes('makikita') || msg.includes('rooms') || msg.includes('room')) {
    const list = (allExhibits || []).map(e => `• **${e.title}** (${e.category} • Level ${e.floor === 2 ? 2 : 1})`).join('\n');
    return `🏛️ **Exhibits at Museo Sang Bata sa Negros:**\nOur museum features hands-on exhibits across two floors:\n\n${list || 'Multiple interactive galleries across Ground Floor and Level 2.'}\n\nYou can explore each exhibit's details and photos in our [Exhibits Catalog](/exhibits.html) or navigate them on the [Interactive Floor Map](/map.html)!`;
  }

  // 11. Location & How to Get There / Commute
  if (msg.includes('where') || msg.includes('location') || msg.includes('address') || msg.includes('how to get') || msg.includes('commute') || msg.includes('direction') || msg.includes('bacolod') || msg.includes('sagay') || msg.includes('saan') || msg.includes('diin') || msg.includes('asa')) {
    return `📍 **Location & Travel Directions:**\n- **Address:** ${info.address} (Shoreline of Barangay Old Sagay, beside the Sagay Marine Reserve and Old Sagay Port).\n- **From Bacolod City:**\n  1. Take a Ceres Bus or passenger van from the Bacolod North Bus Terminal to Sagay City (~2 to 2.5 hours travel time).\n  2. At the Sagay City bus terminal, take a tricycle or pedicab directly to *Museo Sang Bata sa Negros* at Old Sagay Port (~10 to 15 minutes).\n- **Parking:** Free visitor parking is available directly in front of the museum.`;
  }

  // 12. School Tours & Group Bookings
  if (msg.includes('school') || msg.includes('field trip') || msg.includes('group') || msg.includes('tour') || msg.includes('booking') || msg.includes('reserve') || msg.includes('class') || msg.includes('lakbay')) {
    return `🚌 **School Field Trips & Group Tours:**\nWe warmly welcome educational field trips, delegations, and community groups!\n- **Junior Museum Guides:** School groups are led by our trained youth Junior Guides for interactive science storytelling.\n- **Advance Booking:** Please reserve in advance by calling **${info.phone}** or emailing **info@museosangbata.org** with your estimated group size, preferred date, and grade level so our team can prepare hands-on activities.`;
  }

  // 13. Donations & Volunteering
  if (msg.includes('donate') || msg.includes('donation') || msg.includes('volunteer') || msg.includes('support') || msg.includes('tulong') || msg.includes('ambag')) {
    return `💖 **Donations & Volunteering:**\n*Museo Sang Bata sa Negros* is a non-stock, non-profit children's learning center.\n- **Donations:** Help us sponsor free admissions and marine conservation tours for underprivileged public school children and sustain our living marine habitats. You can donate via our [Donate Page](/donate.html) or in person at the Staff Office.\n- **Volunteering:** We welcome student storytellers, marine educators, and activity volunteers! Inquire at the front desk or call ${info.phone}.`;
  }

  // 14. History & Governance / Gov. Joseph Marañon
  if (msg.includes('history') || msg.includes('founder') || msg.includes('maranon') || msg.includes('governor') || msg.includes('kasaysayan') || msg.includes('about')) {
    return `🏛️ **About & History:**\nFounded in 2003 through the vision of late Governor Joseph G. Marañon and community cultural advocates, *Museo Sang Bata sa Negros* is the first hands-on interactive children's museum in the Philippines outside Metro Manila.\n- Located on the coast beside the Sagay Marine Reserve, its flagship initiative is the **Marine Conservation Education Program**, empowering young minds to care for our oceans and island ecosystems.`;
  }

  // 15. Greetings & Default Fallback
  if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey') || msg.includes('kumusta') || msg.includes('maayong') || msg.includes('good morning') || msg.includes('good afternoon')) {
    return `👋 **Hello and welcome to Museo Sang Bata sa Negros!**\nI'm your interactive museum guide. I can answer all questions about:\n• 🏛️ **Exhibits & Galleries** (Under the Sea, Touch Pool, Toy Room, etc.)\n• 📍 **Floor Map & Navigation** (Staff Office under stairs, Level 2 Mezzanine, etc.)\n• 🎟️ **Entrance Fees & Hours**\n• ♿ **Accessibility & Wheelchair Ramp**\n• 📸 **Photography & Food Guidelines**\n• 🚌 **School Field Trips & Group Bookings**\n• 🧭 **How to Get Here from Bacolod**\n\nWhat would you like to know today?`;
  }

  // General Comprehensive Fallback
  return `I'm happy to help you with anything regarding **Museo Sang Bata sa Negros**!\n\nHere are some popular topics you can ask me about:\n- 🎟️ **"How much are tickets and what are the hours?"**\n- 📍 **"Where is the Staff Office located?"**\n- 💦 **"Tell me about the Splash Zone Touch Pool"**\n- 🧸 **"What exhibits are on the Second Floor?"**\n- ♿ **"Is the museum wheelchair accessible?"**\n- 📸 **"Can I take photos inside?"**\n- 🚌 **"How do I book a school field trip?"**\n- 📍 **"How do I commute from Bacolod City?"**\n\nYou can also contact our staff directly at **${info.phone}** or visit our [Interactive Floor Map](/map.html)!`;
}

router.post('/', async (req, res) => {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const model = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  const ip = req.ip;
  if (isRateLimited(ip)) {
    return res.status(429).json({ error: "That's a lot of questions! Please wait a moment and try again." });
  }

  const { message, history } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
  }

  // Sanitize incoming history
  let cleanHistory = [];
  if (Array.isArray(history)) {
    cleanHistory = history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORY_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
  }

  // Fetch full museum context for both LLM prompt and fallback engine
  const context = await getFullMuseumContext();

  // If OpenRouter API key is available, attempt remote LLM call with a safety timeout
  if (apiKey && apiKey.startsWith('sk-or-')) {
    try {
      const sysPrompt = buildSystemPrompt(context);
      const messages = [
        { role: 'system', content: sysPrompt },
        ...cleanHistory,
        { role: 'user', content: message.trim() }
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: 'Bearer ' + apiKey,
          'HTTP-Referer': SITE_URL,
          'X-Title': SITE_NAME
        },
        body: JSON.stringify({
          model,
          max_tokens: 650,
          temperature: 0.5,
          messages
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
        if (reply) {
          return res.json({ reply });
        }
      } else {
        console.warn('OpenRouter non-OK status:', response.status);
      }
    } catch (err) {
      console.warn('OpenRouter request exception, engaging local AI engine:', err.message);
    }
  }

  // Resilient Local Knowledge Engine: Answers all user questions reliably without fail!
  const localReply = generateLocalFallbackReply(message.trim(), context);
  res.json({ reply: localReply });
});

module.exports = router;
