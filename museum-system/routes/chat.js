// Visitor chatbot endpoint with cached museum context and an offline response fallback.
const express = require('express');
const exhibits = require('../db/exhibits');
const programs = require('../db/programs');
const events = require('../db/events');
const museumInfo = require('../db/museum-info');
const chatApiKey = require('../db/chat-api-key');
const apiUsage = require('../db/api-usage');

const router = express.Router();

const SITE_NAME = process.env.SITE_NAME || 'Museo Sang Bata sa Negros';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';

const MAX_MESSAGE_LENGTH = 1000;
const MAX_HISTORY_MESSAGES = 14;

const rateLimit = require('express-rate-limit');

const chatLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 messages per minute per IP
  message: { error: "That's a lot of questions! Please wait a moment and try again." },
  standardHeaders: true,
  legacyHeaders: false
});

let cachedContext = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 90 * 1000; // 90 seconds cache

// Resolve an explicit language selection first, then detect the language of the current message.
function detectChatLanguage(userMessage, preferredLang = 'auto') {
  const msg = String(userMessage || '').toLowerCase().trim();
  const selectedLanguage = String(preferredLang || 'auto').toLowerCase();
  if (selectedLanguage === 'tl') return 'tl';
  if (selectedLanguage === 'bis' || selectedLanguage === 'ceb') return 'bis';
  if (selectedLanguage === 'en') return 'en';

  const hasBisayaWords = /\b(unsa|unsang|asa|asan|dapit|tagpila|pila|ninyo|nato|atong|inyong|nako|nimo|kami|kita|diin|hain|adlaw|kabataan|palihug|palihog|ngano|nganong|kaayo|mokaon|magkaon|moinum|mag-inom|adto|moadto|pag-adto|unsaon|gani|kamo|sulod|pasulod|hagdanan|diri|didto|kinsa|maayong|udto|gabii|bisaya|hiligaynon|ilonggo|cebuano|ayaw|way|adunay|naa|naay|hubad|ihubad|tapad|ilalom|ibabaw|salog|abli|hikap|mohikap|sultihi|tudloi)\b/i.test(msg);
  const hasTagalogWords = /\b(ano|anong|saan|nasaan|nasa|san|magkano|paano|kailan|meron|may|mayroon|po|opo|ba|namin|ninyo|natin|atin|inyo|ako|ko|kami|tayo|pwede|pede|pumunta|punta|kuha|kumuha|larawan|pagkain|inumin|kumain|uminom|sino|bakit|kumusta|kamusta|salamat|umaga|tanghali|tagalog|filipino|paki|pakisabi|sabihin|ikwento|kwento|huwag|bawal|walang|isalin|salin|katabi|itaas|palapag|bukas|sarado|mag-aaral|papasok|pasok)\b/i.test(msg);

  if (/\b(magkano|saan|nasaan|ano|anong|paano|kailan|po|opo|kamusta|kumusta|salamat|paki|pakiusap|pwede|pede|walang|meron|mayroon|bawal|pumunta|kuha|larawan|pagkain|inumin|mag-aaral|ikwento|sabihin)\b/i.test(msg)) return 'tl';
  if (/\b(tagpila|asa|asan|unsa|unsang|diin|hain|ngano|nganong|naa|naay|pila|palihug|palihog|kaayo|mokaon|magkaon|moinum|mag-inom|adto|moadto|pag-adto|unsaon|sulod|hagdanan|diri|didto|maayong|udto|gabii|bisaya|hiligaynon|ayaw|way|adunay|hubad|ihubad|tapad|ilalom|salog|abli|hikap|mohikap|sultihi|tudloi)\b/i.test(msg)) return 'bis';
  if (hasTagalogWords && !hasBisayaWords) return 'tl';
  if (hasBisayaWords && !hasTagalogWords) return 'bis';
  if (hasTagalogWords) return 'tl';
  if (hasBisayaWords) return 'bis';
  return 'en';
}

// Reuse a short-lived museum-data snapshot, falling back to cached/minimal context on DB errors.
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

// Build the provider prompt with records and instructions for the exact response language.
function buildSystemPrompt(context, responseLanguage) {
  const { info, allExhibits, allPrograms, allEvents } = context;

  const exhibitBlock = (allExhibits || []).map(e => (
    `- [${e.code || 'EXHIBIT'}] "${e.title}" (Category: ${e.category || 'General'}, Floor: Level ${e.floor === 2 ? 2 : 1})
      Location in museum: ${e.location || 'Exhibition floor'}
      Description (translate its explanation into the response language): ${responseLanguage === 'tl'
        ? (e.description_tl || e.description || 'Interactive hands-on exhibit.')
        : responseLanguage === 'bis'
          ? (e.description_hil || e.description_cb || e.description || 'Interactive hands-on exhibit.')
          : (e.description || 'Interactive hands-on exhibit.')}
      ${e.directions ? `Walking Directions: ${typeof e.directions === 'object' ? (e.directions.en || '') : e.directions}` : ''}`
  )).join('\n\n');

  const programBlock = (allPrograms || []).map(p => (
    `- "${p.title}"${p.ageRange ? ' (Recommended Ages: ' + p.ageRange + ')' : ''}: ${p.description || 'Educational program.'}`
  )).join('\n');

  const eventBlock = (allEvents || []).map(e => (
    `- "${e.title}" — Date/Schedule: ${e.date || 'Scheduled event'}: ${e.description || 'Museum event.'}`
  )).join('\n');

  const feesBlock = (info.entranceFees || []).map(f => `- ${f}`).join('\n');

  const languageName = responseLanguage === 'tl'
    ? 'Tagalog / Filipino'
    : responseLanguage === 'bis'
      ? 'Bisaya / Cebuano / Hiligaynon'
      : 'English';
  const langInstruction = `STRICT RESPONSE LANGUAGE RULES:
- REQUIRED OUTPUT LANGUAGE: ${languageName}. Write every sentence of the answer in this language.
- Apply this rule to the entire answer: headings, labels, explanations, descriptions, directions, lists, greetings, and closing text.
- Translate descriptive source data into ${languageName} before using it. Never copy an English description, category, location explanation, program/event description, or direction into the answer.
- Do not mix languages or add translations unless the user explicitly asks for multiple languages.
- Preserve only official names, exhibit titles, organization names, acronyms, URLs, record codes, dates, and currency/amounts when translation would make them unrecognizable. Keep surrounding explanations in ${languageName}.
- Keep facts accurate. If a source description is English-only, translate its meaning rather than omitting it or repeating it in English.`;

  return `You are "Bata Guide", the friendly, knowledgeable AI visitor assistant and translator for ${info.name}, located in Barangay Old Sagay, Sagay City, Negros Occidental, Philippines.

YOUR ROLE & TONE:
- You represent the premier interactive children's museum in the Visayas, established in 2003 and a proud member of the Intercontinental Museum Network (SAMP).
- Your tone is warm, enthusiastic, polite, family-friendly, and encouraging for children, parents, teachers, and travelers.

${langInstruction}

TRANSLATION CAPABILITY:
- Translate naturally between the user's language and English, Tagalog (Filipino), or Bisaya (Hiligaynon / Cebuano) when asked.
- For translation requests, translate the requested text into the target language(s) named by the user. Do not include extra languages unless requested.

COMPLETE MUSEUM KNOWLEDGE BASE:

1. ARCHITECTURAL LAYOUT & FACILITIES:
- Main Entrance & Foyer: Primary visitor entryway featuring ticket desk, reception, access ramp, and double glass doors.
- Accessibility & Ramp: Fully accessible for wheelchairs and strollers. An exterior access ramp is situated at the main entrance alongside wide steps. All Ground Floor galleries and Function Hall are on a single flat level with wide doorways.
- Function Hall: The large central multi-purpose hall for school gatherings, orientations, presentations, and workshops.
- Staff Office: Located on LEVEL 1 (Ground Floor) INSIDE the Central Function Hall, situated DIRECTLY UNDER THE STAIRCASE, beside the Joseph G. Marañon memorial section. Visitors can find administration, tour coordinators, and front-desk staff here.
- Staircase to Level 2: Located in the Function Hall along the west wall (directly above the Staff Office), leading up to the second floor mezzanine.
- Marine & Nature Room (Ground Floor): Flagship central gallery housing Under the Sea, The River, Biodiversity, Story of Plastic, and Mangrove Walk.
- Touch & Play Room / Splash Zone (Ground Floor East Wing): Houses our live marine Touch Pool basin with gentle seashore creatures (sea stars, sea cucumbers, hermit crabs, reef fish).
- Library Extension Wing (Ground Floor West Wing): Features Franco's Reading Corner (storybook nook) and Character & Heritage Room (Gov. Joseph G. Marañon Memorabilia and Everyday Heroes).
- Mezzanine / Level 2: Houses Toys & Collections Room (Hampanganan) with folk toys from 50+ countries, and Carnival & Discovery Room (Play Lab with hands-on sensory hubs).
- Restrooms / Comfort Rooms: Situated in the west corridor connecting the Function Hall to the Library Extension Wing.

2. VISITOR HOURS & SCHEDULE:
- Monday to Friday: 8:00 AM – 5:00 PM (open for walk-in public, families, tourists, and school delegations).
- Saturday & Sunday: Open for advance-reserved group tours and special events.
- Average tour duration: 1.5 to 2.5 hours for full exploration of both floors.

3. TICKETS & ENTRANCE FEES:
${feesBlock || '- Students: ₱20.00\n- Seniors & PWD: ₱40.00\n- Adults: ₱50.00\n- Children under 3: Free'}
- Children under 3 years old: FREE admission.
- Tickets are purchased at the Visitor Reception Desk at the Main Entrance foyer.

4. MUSEUM RULES & GUIDELINES:
- Photography & Videography: Personal souvenir photos and videos are encouraged! Please turn off camera flash around live aquariums and Touch Pool to protect marine animal eyes. Commercial filming requires advance coordination at the Staff Office.
- Food & Drinks: Eating and drinking are strictly prohibited inside the exhibition galleries and at the Touch Pool. Visitors may enjoy packed snacks/baon outside the building or at designated seating in the central Function Hall during tour breaks.
- Hands-on Handling: Touch animals gently underwater at the Touch Pool. Wash hands with clean water (no soap) before and after touching.

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
ANSWERING INSTRUCTIONS — STRICT FOCUS RULES:
- Answer ONLY the specific question the visitor asked. Do NOT add extra information, tips, related topics, unsolicited details, or follow-up suggestions that were not part of the question.
- Keep the answer short and direct. One question = one direct answer. Do not pad the response with background context unless the visitor explicitly asked for it.
- Do NOT volunteer information about other exhibits, programs, events, rules, or facilities unless the visitor asked about them.
- Do NOT end answers with phrases like "Feel free to ask more!", "Let me know if you have other questions!", "You might also be interested in...", or any similar add-ons.
- Use only facts explicitly stated in this museum knowledge base. Do not guess, invent, or fill gaps with plausible-sounding details.
- If the requested museum information is not in the knowledge base above, say it is not available and suggest contacting the museum at ${info.phone} or info@museosangbata.org. Do not speculate.
- For questions unrelated to the museum, politely decline in the response language and say you can only help with museum-related questions.
- Follow the response language rules above in every answer — every sentence must be in the visitor's detected language.
- Treat the knowledge base as factual reference — translate wording into the visitor's language while preserving proper names, codes, and exact values.
- Use simple markdown formatting (bold or bullet list) only when it makes the direct answer clearer, not to pad the reply.`;
}

// ─── Helper to format response in the matched language only ───
// Select the requested language from a prepared English/Tagalog/Bisaya reply.
function formatTrilingualReply({ en, tl, bis }, targetLang = 'en') {
  const cleanEn = (en || '').trim();
  const cleanTl = (tl || '').trim();
  const cleanBis = (bis || '').trim();

  if (targetLang === 'tl') {
    return cleanTl;
  }
  if (targetLang === 'bis' || targetLang === 'ceb') {
    return cleanBis;
  }
  return cleanEn;
}

// Translate known exhibit categories while preserving unrecognized labels.
function localizeExhibitCategory(category, targetLang) {
  const translations = {
    'Marine & Nature': { tl: 'Dagat at Kalikasan', bis: 'Dagat ug Kinaiyahan' },
    'Touch & Play': { tl: 'Hawak at Laro', bis: 'Hikap ug Dula' },
    'Toys & Collections': { tl: 'Mga Laruan at Koleksiyon', bis: 'Mga Dulaan ug Koleksiyon' },
    'Character & Heritage': { tl: 'Pagpapahalaga at Pamana', bis: 'Kinaiya ug Panulondon' },
    Environmental: { tl: 'Kapaligiran', bis: 'Kapalibotan' },
    'Reading & Learning': { tl: 'Pagbabasa at Pagkatuto', bis: 'Pagbasa ug Pagkat-on' },
    Other: { tl: 'Iba pa', bis: 'Uban pa' },
    General: { tl: 'Pangkalahatan', bis: 'Kinatibuk-an' }
  };
  return translations[category]?.[targetLang] || category || (targetLang === 'tl' ? 'Pangkalahatan' : 'Kinatibuk-an');
}

// ─── Intelligent Local Fallback Engine (Answers & Translates Offline / Resilient) ───
// Answer common visitor questions locally when Groq is unavailable or returns no reply.
function generateLocalFallbackReply(userMessage, { info, allExhibits, allPrograms, allEvents }, preferredLang = 'auto') {
  const msg = (userMessage || '').toLowerCase().trim();

  const activeLang = detectChatLanguage(msg, preferredLang);

  // ── TRANSLATION REQUESTS ──
  const isTranslateRequest = /\b(translate|i-translate|itranslate|isalin|salin|hubad|ihubad|paghubad|kahulugan|meaning)\b/i.test(msg);
  if (isTranslateRequest) {
    const toBisaya = /\b(bisaya|hiligaynon|cebuano|ilonggo)\b/i.test(msg);
    const toTagalog = /\b(tagalog|filipino)\b/i.test(msg);

    let enText = "Welcome to Museo Sang Bata sa Negros! An interactive children's science and marine museum dedicated to educational exploration. We are delighted to assist you!";
    let tlText = "Maligayang pagdating sa Museo Sang Bata sa Negros! Isang interactive na museo para sa mga bata upang matuto ukol sa karagatan, sining, at kultura. Ikinalulugod namin kayong paglingkuran!";
    let bisText = "Maayong pag-abot sa Museo Sang Bata sa Negros! Usa kini ka interactive nga museyo sa kabataan alang sa edukasyon sa kadagatan ug kultura. Malipayon kami nga mo-abiabi kaninyo!";

    if (msg.includes('staff office') || msg.includes('office') || msg.includes('opisina')) {
      enText = 'The Staff Office is located on Level 1 (Ground Floor) inside the Central Function Hall, situated directly under the stairs, beside the J.G. Marañon memorial section.';
      tlText = 'Ang Staff Office ay matatagpuan sa Level 1 (Ground Floor) sa loob ng Central Function Hall, sa ilalim mismo ng hagdanan, katabi ng J.G. Marañon memorial gallery.';
      bisText = 'Ang Staff Office anaa sa Level 1 (Ground Floor) sa sulod sa Central Function Hall, diretso sa ilalom sa hagdanan, tapad sa J.G. Marañon memorial section.';
    } else if (msg.includes('touch pool') || msg.includes('starfish') || msg.includes('hikap')) {
      enText = 'At the Touch Pool in the Splash Zone, you can gently interact with live sea stars (starfish) and sea cucumbers. Please wash hands with water before touching.';
      tlText = 'Sa Touch Pool ng Splash Zone, malugod kayong makakahawak sa mga buhay na starfish at sea cucumbers. Paki-hugas po ang inyong mga kamay gamit ang tubig bago humawak.';
      bisText = 'Sa Touch Pool sa Splash Zone, mahimo ninyong hikapon ang buhi nga mga bituon sa dagat (starfish) ug mga balat (sea cucumbers). Palihug panghunaw sa kamot gamit ang tubig sa dili pa mohikap.';
    } else if (msg.includes('ticket') || msg.includes('fee') || msg.includes('entrance') || msg.includes('bayad')) {
      enText = 'Admission fees for Museo Sang Bata sa Negros: Students ₱20, Senior Citizens/PWD ₱40, Adults ₱50, and children under 3 years enter for free.';
      tlText = 'Bayad sa pagpasok sa Museo Sang Bata sa Negros: Mag-aaral ₱20, Senior Citizen/PWD ₱40, Matatanda ₱50, at libre ang mga batang wala pang 3 taong gulang.';
      bisText = 'Ang bayad sa pagsulod sa Museo Sang Bata sa Negros: Mga Estudyante ₱20, Senior Citizen/PWD ₱40, Adulto ₱50, ug libre ang mga bata nga ubos sa 3 ka tuig.';
    } else if (msg.includes('rule') || msg.includes('photo') || msg.includes('picture') || msg.includes('food') || msg.includes('litrato') || msg.includes('kaon')) {
      enText = 'Photography is warmly welcomed but please turn off flash near aquariums and Touch Pool. Eating and drinking are prohibited inside exhibit galleries.';
      tlText = 'Maaaring kumuha ng litrato at video ngunit mangyaring patayin ang flash malapit sa mga aquarium at Touch Pool. Bawal kumain o uminom sa loob ng mga exhibit gallery.';
      bisText = 'Gidasig ang pagkuha og litrato ug video apan palihug patya ang flash sa camera duol sa mga aquarium ug Touch Pool. Bawal magkaon o mag-inom sa sulod sa mga gallery.';
    }

    if (toBisaya) {
      return `🌐 **Hubad sa Bisaya:**\n"${bisText}"`;
    }
    if (toTagalog) {
      return `🌐 **Salin sa Tagalog (Translation to Tagalog):**\n"${tlText}"`;
    }
    return `🌐 **English Translation:**\n"${enText}"`;
  }

  // 1. Staff Office Location
  if (msg.includes('staff office') || msg.includes('office') || msg.includes('admin') || msg.includes('opisina') || (msg.includes('staff') && (msg.includes('where') || msg.includes('saan') || msg.includes('asa') || msg.includes('diin')))) {
    return formatTrilingualReply({
      en: `💼 **Staff Office Location:**\nThe **Staff Office** is located on **Level 1 (Ground Floor) inside the Central Function Hall, situated directly under the stairs** and right beside the J.G. Marañon memorial gallery section.\n\nIf you need administrative assistance, tour booking coordination, or staff guidance, enter through the Main Entrance doors, walk across the Function Hall, and look to your left under the staircase!`,
      tl: `💼 **Lokasyon ng Staff Office:**\nAng **Staff Office** ay matatagpuan sa **Level 1 (Ground Floor)** sa loob ng **Central Function Hall, direktang nasa ilalim ng hagdanan (under the stairs)**, katabi ng J.G. Marañon memorial section.\n\nKung kailangan ninyo ng tulong sa tour booking, impormasyon sa pamunuan, o tulong ng staff, pumasok lamang sa Main Entrance, tumawid sa Function Hall, at kumaliwa patungo sa ilalim ng hagdan!`,
      bis: `💼 **Lokasyon sang Staff Office:**\nAng **Staff Office** ara sa **Level 1 (Ground Floor)** sa sulod sang **Central Function Hall**, direkta sa idalom sang hagdan, kag tupad sang memorial nga bahin ni J.G. Marañon.\n\nKon kinahanglan mo sang bulig sa pagpareserba sang tour ukon impormasyon, magsulod sa Main Entrance, magtabok sa Function Hall, kag magliso sa wala pakadto sa idalom sang hagdan!`
    }, activeLang);
  }

  // 2. Wheelchair Access & Ramp
  if (msg.includes('wheelchair') || msg.includes('ramp') || msg.includes('accessible') || msg.includes('pwd') || msg.includes('stroller') || msg.includes('disab')) {
    return formatTrilingualReply({
      en: `♿ **Accessibility & Wheelchair Access:**\nYes! Museo Sang Bata sa Negros is fully wheelchair and stroller accessible.\n\n- **Access Ramp:** A dedicated exterior concrete access ramp is located directly at the front entrance alongside the steps, leading smoothly into the reception foyer.\n- **Ground Floor Layout:** All Ground Floor exhibition rooms (Marine & Nature Room, Splash Zone Touch Pool, Reading Corner, Heritage Gallery, and Function Hall) are on a single flat level with wide doorways.`,
      tl: `♿ **Accessibility at Wheelchair Ramp:**\nOo, ganap na accessible ang Museo Sang Bata sa Negros para sa mga naka-wheelchair at stroller!\n\n- **Entrance Ramp:** May kongkretong access ramp sa harapan ng Main Entrance katabi ng mga baytang ng hagdan para sa maginhawang pagpasok.\n- **Ground Floor:** Ang lahat ng gallery sa Ground Floor (Marine & Nature Room, Touch Pool, Franco's Reading Corner, Character & Heritage Room, at Function Hall) ay nasa iisang patag na palapag na may malalapad na pintuan.`,
      bis: `♿ **Dali nga Pagsulod kag Rampa:**\nOo, masulod sing hapos ang Museo Sang Bata sa Negros sang mga tawo nga nagagamit sang wheelchair kag kariton sang bata!\n\n- **Rampa:** May konkreto nga rampa sa atubang sang Main Entrance, tupad sang hagdan, agod mangin hapos ang pagsulod.\n- **Ground Floor:** Ang tanan nga galeriya sa idalom (Marine & Nature Room, Splash Zone Touch Pool, Franco's Reading Corner, Character & Heritage Room, kag Function Hall) ara sa pareho nga patag nga salog kag may malapad nga mga puwertahan.`
    }, activeLang);
  }

  // 3. Photography & Videography Rules
  if (msg.includes('photo') || msg.includes('picture') || msg.includes('camera') || msg.includes('video') || msg.includes('shoot') || msg.includes('film') || msg.includes('selfie') || msg.includes('litrato') || msg.includes('kuha')) {
    return formatTrilingualReply({
      en: `📸 **Photography & Video Guidelines:**\n- **Personal Souvenir Photos & Videos:** Warmly welcomed! Visitors and families are encouraged to take souvenir photos with our interactive displays.\n- **Flash Precaution:** Please turn off camera flash around live saltwater aquariums and the Touch Pool to protect the sensitive eyes of our marine animals.\n- **Commercial Shoots:** Commercial filming requires advance coordination with museum management at the Staff Office.`,
      tl: `📸 **Panuntunan sa Pagkuha ng Litrato at Video:**\n- **Personal Photos & Videos:** Pwedeng-pwede po kumuha ng litrato at souvenir videos kasama ang inyong pamilya sa mga interactive exhibits!\n- **Pakiusap sa Flash:** Iwasan po ang camera flash malapit sa mga saltwater aquarium at Touch Pool upang hindi masilaw o maabala ang mga live marine animals.\n- **Commercial Shoots:** Para sa commercial filming o media video shoots, mangyaring makipag-ugnayan muna sa Staff Office.`,
      bis: `📸 **Mga Lagda sa Pagkuha sang Retrato kag Bidyo:**\n- **Retrato kag bidyo para sa handumanan:** Ginasugyot ang pagkuha sang retrato kag bidyo upod sa pamilya sa mga exhibit.\n- **Pahimangno sa suga sang kamera:** Palihug patya ang suga sang kamera malapit sa mga aquarium nga may tubig-dagat kag sa Touch Pool agod indi madisturbo ang mga sapat sa dagat.\n- **Pagkuha para sa negosyo:** Kon may pagkuha sang bidyo para sa negosyo ukon media, palihug magpakig-angot anay sa Staff Office.`
    }, activeLang);
  }

  // 4. Food & Drinks Rules
  if (msg.includes('food') || msg.includes('drink') || msg.includes('snack') || msg.includes('eat') || msg.includes('water') || msg.includes('lunch') || msg.includes('baon') || msg.includes('pagkain') || msg.includes('kaon') || msg.includes('inum')) {
    return formatTrilingualReply({
      en: `🍱 **Food & Beverage Policy:**\n- Eating and drinking are strictly prohibited inside the exhibition galleries and at the Touch Pool to safeguard our displays and sea creatures.\n- Visitors are welcome to enjoy snacks, drinks, and packed lunch (*baon*) at designated seating in the central Function Hall during tour breaks or outdoors.`,
      tl: `🍱 **Panuntunan sa Pagkain at Inumin:**\n- Bawal po kumain at uminom sa loob ng mga **exhibition galleries** at sa tabi ng **Touch Pool** upang maprotektahan ang mga exhibits at marine creatures.\n- Maaari ninyong kainin ang inyong baon, meryenda, o inumin sa mga designated seating areas sa labas ng museo o sa loob ng **Function Hall** tuwing break time.`,
      bis: `🍱 **Mga Lagda sa Pagkaon kag Inom:**\n- **Bawal magkaon ukon mag-inom** sa sulod sang mga galeriya sang exhibit kag malapit sa Touch Pool agod maprotektahan ang mga butang nga ginapakita kag ang mga sapat sa dagat.\n- Mahimo ka magkaon sang baon, meryenda, ukon ilimnon sa mga gintudlo nga lugar sa gwa ukon sa **Function Hall** samtang nagapahuway sa paglibot.`
    }, activeLang);
  }

  // 5. Entrance Fees & Ticket Rates
  if (msg.includes('ticket') || msg.includes('fee') || msg.includes('price') || msg.includes('entrance') || msg.includes('cost') || msg.includes('magkano') || msg.includes('tagpila') || msg.includes('bayad') || msg.includes('pila')) {
    const feesListEn = (info.entranceFees && info.entranceFees.length) ? info.entranceFees.map(f => `• ${f}`).join('\n') : `• Students with ID: ₱20.00\n• Senior Citizens & PWD: ₱40.00\n• Adults: ₱50.00`;
    const feesListTl = `• Mga Mag-aaral (may ID): ₱20.00\n• Senior Citizens at PWD: ₱40.00\n• Matatanda (Adults): ₱50.00`;
    const feesListBis = `• Mga estudyante (may ID): ₱20.00\n• Mga tigulang kag PWD: ₱40.00\n• Mga adulto: ₱50.00`;

    return formatTrilingualReply({
      en: `🎟️ **Entrance Fees & Admission Rates:**\n${feesListEn}\n• Children under 3 years old: FREE admission.\n\nTickets can be purchased directly at the Visitor Reception Desk upon arrival at the Main Entrance!`,
      tl: `🎟️ **Halaga ng Entrance Ticket:**\n${feesListTl}\n• Libre ang mga batang wala pang 3 taong gulang.\n\nMabibili ang tickets sa Visitor Reception Desk pagpasok sa Main Entrance foyer!`,
      bis: `🎟️ **Bayad sa Pagsulod:**\n${feesListBis}\n• Libre ang mga bata nga wala pa magtatlo ka tuig.\n\nMakabakal ka sang tiket sa lamesa sang pagbaton sa mga bisita pag-abot sa Main Entrance!`
    }, activeLang);
  }

  // 6. Hours & Schedule
  if (msg.includes('hour') || msg.includes('time') || msg.includes('open') || msg.includes('close') || msg.includes('schedule') || msg.includes('oras') || msg.includes('bukas') || msg.includes('sirado') || msg.includes('abli') || msg.includes('weekend') || msg.includes('sunday') || msg.includes('saturday')) {
    return formatTrilingualReply({
      en: `⏰ **Operating Hours & Schedule:**\n- **Monday to Friday:** 8:00 AM – 5:00 PM (open for general public, walk-ins, families, and school tours).\n- **Saturday & Sunday:** Open exclusively for advance-booked group tours and special reservations.\n- **Recommended Duration:** Most visitors spend about 1.5 to 2.5 hours exploring all interactive galleries across both floors.`,
      tl: `⏰ **Oras at Iskedyul ng Museo:**\n- **Lunes hanggang Biyernes:** 8:00 AM – 5:00 PM (bukas para sa regular walk-ins, pamilya, at school field trips).\n- **Sabado at Linggo:** Bukas para sa mga advance-booked group tours at special events.\n- **Rekomendadong Oras:** Karaniwang tumatagal ng 1.5 hanggang 2.5 oras ang paglilibot sa lahat ng exhibits sa Ground Floor at Level 2.`,
      bis: `⏰ **Oras kag Iskedyul sang Pag-abli:**\n- **Lunes tubtob Biyernes:** 8:00 AM – 5:00 PM (abri para sa tanan nga bisita, pamilya, kag mga pagbisita sang eskwelahan).\n- **Sabado kag Domingo:** Abri para sa mga grupo nga nagpareserba anay kag sa mga pinasahi nga kalihokan.\n- **Gidugayon sang Pagbisita:** Kasagaran nagalawig sing 1.5 tubtob 2.5 ka oras ang paglibot sa mga galeriya sa Ground Floor kag Level 2.`
    }, activeLang);
  }

  // 7. Level 2 / Second Floor / Stairs
  if (msg.includes('level 2') || msg.includes('second floor') || msg.includes('2nd floor') || msg.includes('mezzanine') || msg.includes('stairs') || msg.includes('hagdan') || msg.includes('itaas') || msg.includes('taas') || msg.includes('hampanganan')) {
    return formatTrilingualReply({
      en: `🪜 **Level 2 (Upper Mezzanine Level):**\nAccessed via the staircase inside the Function Hall (directly above the Staff Office), Level 2 houses:\n1. **🧸 Toys & Collections Room (*Hampanganan*):** A world of folk toys from over 50 countries, vintage McDonald's promotional toys, and Beanie Babies collection.\n2. **🎡 Carnival & Discovery Room:** An interactive Play Lab featuring sensory exploration hubs, game stations, and brain-teasing puzzles.\n3. **👀 Mezzanine Void Balcony:** An open-to-below balcony overlooking the central Function Hall.`,
      tl: `🪜 **Level 2 (Ikalawang Palapag / Upper Mezzanine):**\nMaaaring puntahan gamit ang hagdanan sa loob ng Function Hall (sa itaas mismo ng Staff Office):\n1. **🧸 Toys & Collections Room (*Hampanganan*):** Koleksyon ng mga tradisyonal na laruan mula sa mahigit 50 bansa, vintage McDonald's toys, at Beanie Babies.\n2. **🎡 Carnival & Discovery Room:** Isang interactive Play Lab na may mga hands-on games at sensory learning stations.\n3. **👀 Mezzanine Void Balcony:** Isang bukas na balkonahe na tanaw ang buong Central Function Hall sa ibaba.`,
      bis: `🪜 **Level 2 (Ikaduha nga Salog):**\nMaabot ini paagi sa hagdan sa Function Hall, direkta sa ibabaw sang Staff Office:\n1. **🧸 Toys & Collections Room (*Hampanganan*):** Koleksyon sang tradisyonal nga mga dulaan halin sa sobra 50 ka pungsod, lakip ang mga dulaan sang McDonald's kag Beanie Babies.\n2. **🎡 Carnival & Discovery Room:** Lugar sang pagtuon paagi sa pag-eksperimento, mga dula, kag mga buluhaton para sa mga pagbati.\n3. **👀 Mezzanine Void Balcony:** Bukas nga balkonahe nga nagatan-aw sa Central Function Hall sa idalom.`
    }, activeLang);
  }

  // 8. Touch Pool / Splash Zone
  if (msg.includes('touch pool') || msg.includes('splash zone') || msg.includes('starfish') || msg.includes('cucumber') || msg.includes('touch and play') || msg.includes('hikap') || msg.includes('hawak')) {
    return formatTrilingualReply({
      en: `💦 **Touch & Play Room (Splash Zone):**\nLocated in the Ground Floor East Wing, the Splash Zone features our famous living marine **Touch Pool**!\n- Children and visitors can gently interact with real seashore animals including sea stars (starfish), sea cucumbers, hermit crabs, sea snails, and small reef fish.\n- Junior Museum Guides assist each visitor to ensure animals are handled safely underwater. Wash hands with clean water (no soap) before touching!`,
      tl: `💦 **Touch & Play Room (Splash Zone):**\nMatatagpuan sa Ground Floor East Wing, tampok dito ang ating tanyag na marine **Touch Pool**!\n- Malugod na makakahawak ang mga bata at bisita sa mga buhay na yamang-dagat tulad ng starfish (sea stars), sea cucumbers, hermit crabs, at maliliit na isda sa bahura.\n- Paki-hugas po ang mga kamay gamit ang malinis na tubig (walang sabon) bago humawak, at hawakan sila nang marahan sa ilalim ng tubig.`,
      bis: `💦 **Touch & Play Room (Splash Zone):**\nAri sa Ground Floor East Wing ang aton **Touch Pool** nga may buhi nga mga sapat sa dagat!\n- Mahimo mahikap sing mahinalongon sang mga bisita kag kabataan ang mga bituon sa dagat, balat, alimango nga nagapuyo sa mga kinhason, kag magagmay nga isda sa bahura.\n- Palihug hugasi ang mga kamot sa matinlo nga tubig nga wala sing sabon antes maghikap. Hikapa sila sing mahinalongon samtang yara sa tubig.`
    }, activeLang);
  }

  // 9. Specific Exhibit queries
  const matchedExhibit = (allExhibits || []).find(e => {
    const t = (e.title || '').toLowerCase();
    const c = (e.code || '').toLowerCase();
    return msg.includes(t) || msg.includes(c) || (e.category && msg.includes(e.category.toLowerCase()));
  });

  if (matchedExhibit) {
    const floorNum = matchedExhibit.floor === 2 ? 2 : 1;
    const localizedDescription = activeLang === 'tl'
      ? matchedExhibit.description_tl
      : activeLang === 'bis'
        ? (matchedExhibit.description_hil || matchedExhibit.description_cb)
        : matchedExhibit.description;
    const missingDescription = activeLang === 'tl'
      ? 'Wala pay hubad nga deskripsyon para niining eksibit.'
      : 'Wala pay gihubad nga deskripsyon alang niini nga pasundayag.';
    return formatTrilingualReply({
      en: `📦 **Exhibit: ${matchedExhibit.title} (${matchedExhibit.code || 'EXHIBIT'})**\n- **Category:** ${matchedExhibit.category || 'General'}\n- **Floor:** Level ${floorNum}\n- **Location:** ${matchedExhibit.location || 'Exhibition area'}\n- **Overview:** ${matchedExhibit.description || 'Hands-on interactive learning display.'}`,
      tl: `📦 **Eksibit: ${matchedExhibit.title} (${matchedExhibit.code || 'EXHIBIT'})**\n- **Kategorya:** ${localizeExhibitCategory(matchedExhibit.category, 'tl')}\n- **Palapag:** ${floorNum}\n- **Lokasyon:** ${matchedExhibit.location || 'Lugar sa eksibit'}\n- **Paliwanag:** ${matchedExhibit.description_tl || 'Walang nakahandang salin ng paglalarawan para sa eksibit na ito.'}`,
      bis: `📦 **Pasundayag: ${matchedExhibit.title} (${matchedExhibit.code || 'EXHIBIT'})**\n- **Kategorya:** ${localizeExhibitCategory(matchedExhibit.category, 'bis')}\n- **Salog:** ${floorNum}\n- **Lokasyon:** ${matchedExhibit.location || 'Dapit sa pasundayag'}\n- **Deskripsyon:** ${localizedDescription || missingDescription}`
    }, activeLang);
  }

  // 10. General Exhibits List
  if (msg.includes('exhibit') || msg.includes('gallery') || msg.includes('makikita') || msg.includes('makita') || msg.includes('rooms') || msg.includes('room')) {
    const list = (allExhibits || []).map(e => {
      const category = e.category || 'General';
      return `• **${e.title}** (${activeLang === 'tl' || activeLang === 'bis' ? localizeExhibitCategory(category, activeLang) : category} • ${activeLang === 'tl' ? 'Palapag' : activeLang === 'bis' ? 'Salog' : 'Level'} ${e.floor === 2 ? 2 : 1})`;
    }).join('\n');
    return formatTrilingualReply({
      en: `🏛️ **Exhibits at Museo Sang Bata sa Negros:**\nOur museum features hands-on exhibits across two floors:\n\n${list || 'Multiple interactive galleries across Ground Floor and Level 2.'}\n\nYou can explore each exhibit's details in our [Exhibits Catalog](/exhibits.html) or navigate them on the [Interactive Floor Map](/map.html)!`,
      tl: `🏛️ **Mga Exhibit sa Museo Sang Bata sa Negros:**\nTampok ang mga hands-on exhibits sa dalawang palapag ng museo:\n\n${list || 'Maraming interactive galleries sa Ground Floor at Level 2.'}\n\nMaaari ninyong suriin ang kumpletong detalye sa [Exhibits Catalog](/exhibits.html) o sundan sa [Interactive Floor Map](/map.html)!`,
      bis: `🏛️ **Mga Exhibit sa Museo Sang Bata sa Negros:**\nMay nagkalain-lain nga exhibit sa duha ka salog sang museyo:\n\n${list || 'May madamo nga galeriya sa Ground Floor kag Level 2.'}\n\nTan-awa ang bug-os nga detalye sa [Talaan sang mga Exhibit](/exhibits.html) ukon pangitaa ang mga ini sa [Mapa sang Salog](/map.html)!`
    }, activeLang);
  }

  // 11. Location & How to Get There / Commute
  if (msg.includes('where') || msg.includes('location') || msg.includes('address') || msg.includes('how to get') || msg.includes('commute') || msg.includes('direction') || msg.includes('bacolod') || msg.includes('sagay') || msg.includes('saan') || msg.includes('diin') || msg.includes('asa') || msg.includes('adto') || msg.includes('pumunta')) {
    return formatTrilingualReply({
      en: `📍 **Location & Travel Directions:**\n- **Address:** ${info.address} (Shoreline of Barangay Old Sagay, beside the Sagay Marine Reserve and Old Sagay Port).\n- **From Bacolod City:**\n  1. Take a Ceres Bus or passenger van from Bacolod North Bus Terminal to Sagay City (~2 to 2.5 hours).\n  2. At Sagay terminal, take a tricycle or pedicab directly to *Museo Sang Bata sa Negros* at Old Sagay Port (~10 to 15 minutes).\n- **Parking:** Free visitor parking is available directly in front of the museum.`,
      tl: `📍 **Lokasyon at Direksyon sa Pagbiyahe (Commute galing Bacolod):**\n- **Address:** ${info.address} (Baybayin ng Barangay Old Sagay, katabi ng Sagay Marine Reserve at Old Sagay Port).\n- **Paggaling sa Bacolod City:**\n  1. Sumakay ng Ceres Bus o van mula Bacolod North Bus Terminal patungong Sagay City (~2 hanggang 2.5 oras).\n  2. Sa Sagay terminal, sumakay ng tricycle o pedicab papuntang *Museo Sang Bata sa Negros* sa Old Sagay Port (~10 hanggang 15 minuto).\n- **Paradahan:** May libreng paradahan sa tapat ng museo.`,
      bis: `📍 **Lokasyon kag Giya sa Pagbiyahe:**\n- **Adres:** ${info.address} (Sa baybayon sang Barangay Old Sagay, tupad sang Sagay Marine Reserve kag Old Sagay Port).\n- **Halin sa Bacolod City:**\n  1. Sakay sang Ceres Bus ukon van halin sa Bacolod North Bus Terminal pakadto sa Sagay City (mga 2 tubtob 2.5 ka oras).\n  2. Pag-abot sa terminal sang Sagay, sakay sang traysikol ukon pedikab pakadto sa *Museo Sang Bata sa Negros* sa Old Sagay Port (mga 10 tubtob 15 ka minutos).\n- **Paradahan:** May libre nga paradahan sa atubang sang museyo.`
    }, activeLang);
  }

  // 12. School Tours & Group Bookings
  if (msg.includes('school') || msg.includes('field trip') || msg.includes('group') || msg.includes('tour') || msg.includes('booking') || msg.includes('reserve') || msg.includes('class') || msg.includes('lakbay') || msg.includes('eskwela')) {
    return formatTrilingualReply({
      en: `🚌 **School Field Trips & Group Tours:**\nWe warmly welcome educational field trips, delegations, and community groups!\n- **Junior Museum Guides:** School groups are led by our trained youth Junior Guides for interactive marine science storytelling.\n- **Advance Booking:** Please reserve in advance by calling **${info.phone}** or emailing **info@museosangbata.org** with your estimated group size and preferred date.`,
      tl: `🚌 **School Field Trips at Group Tours:**\nMalugod naming tinatanggap ang mga lakbay-aral ng mga paaralan at grupo!\n- **Junior Museum Guides:** Ang inyong grupo ay gagabayan ng ating sinanay na Junior Guides para sa masayang pag-aaral ng marine science.\n- **Paunang Booking:** Mangyaring tumawag sa **${info.phone}** o mag-email sa **info@museosangbata.org** bago ang inyong nakatakdang pagbisita.`,
      bis: `🚌 **Mga Pagbisita sang Eskwelahan kag Grupo:**\nMalipayon kami nga magbaton sang mga eskwelahan, grupo, kag delegasyon!\n- **Junior Museum Guides:** Giyahan sang amon nabansay nga mga batan-on nga giya ang mga grupo samtang ginapaathag ang siyensiya sang kadagatan.\n- **Pagpareserba:** Palihug magpareserba anay paagi sa pagtawag sa **${info.phone}** ukon pagpadala sang mensahe sa **info@museosangbata.org**. Isugid ang kadamuon sang inyo grupo kag ang gusto nga petsa.`
    }, activeLang);
  }

  // 13. Donations & Volunteering
  if (msg.includes('donate') || msg.includes('donation') || msg.includes('volunteer') || msg.includes('support') || msg.includes('tulong') || msg.includes('ambag') || msg.includes('tabang')) {
    return formatTrilingualReply({
      en: `💖 **Donations & Volunteering:**\n*Museo Sang Bata sa Negros* is a non-stock, non-profit children's learning center.\n- **Donations:** Help us sponsor free admissions and marine tours for underprivileged public school children and sustain our living marine habitats. You can donate via our [Donate Page](/donate.html) or in person at the Staff Office.\n- **Volunteering:** Inquire at the front desk or call ${info.phone}.`,
      tl: `💖 **Donasyon at Pagboboluntaryo:**\nAng *Museo Sang Bata sa Negros* ay isang non-profit foundation para sa kabataan.\n- **Donasyon:** Ang bawat ambag ay nakatutulong na pondohan ang libreng lakbay-aral ng mga batang mag-aaral mula sa public schools at mapangalagaan ang ating marine habitats. Mag-donate sa [Donate Page](/donate.html) o sa Staff Office.\n- **Pagboboluntaryo:** Tumawag sa ${info.phone} para sa programang Junior Guides!`,
      bis: `💖 **Donasyon kag Pagboluntaryo:**\nAng *Museo Sang Bata sa Negros* isa ka institusyon nga wala nagapangita sang ganansiya.\n- **Donasyon:** Ang imo bulig makasuporta sa libre nga pagbisita sang mga kabataan halin sa pampubliko nga eskwelahan kag sa pag-atipan sang mga sapat sa Touch Pool. Maghatag paagi sa [Pahina sang Donasyon](/donate.html) ukon sa Staff Office.\n- **Pagboluntaryo:** Ginatugutan ang mga estudyante kag manug-asoy sang estorya nga magbulig bilang Junior Guides. Tawag sa ${info.phone}.`
    }, activeLang);
  }

  // 14. History & Governance / Gov. Joseph Marañon
  if (msg.includes('history') || msg.includes('founder') || msg.includes('maranon') || msg.includes('governor') || msg.includes('kasaysayan') || msg.includes('about') || msg.includes('sinugdanan')) {
    return formatTrilingualReply({
      en: `🏛️ **About & History:**\nFounded in 2003 through the vision of late Governor Joseph G. Marañon and community cultural advocates, *Museo Sang Bata sa Negros* is the first hands-on interactive children's museum in the Philippines outside Metro Manila, dedicated to marine conservation and children's discovery.`,
      tl: `🏛️ **Kasaysayan ng Museo:**\nItinatag noong 2003 sa pamamagitan ng adhikain ni dating Gobernador Joseph G. Marañon, ang *Museo Sang Bata sa Negros* ang kauna-unahang hands-on children's museum sa labas ng Metro Manila.\n- Katabi ng Sagay Marine Reserve, ang layunin nito ay magturo ng pangangalaga sa kalikasan at yamang-dagat sa pamamagitan ng **Marine Conservation Education Program**.`,
      bis: `🏛️ **Parte kag Kasaysayan sang Museyo:**\nGintukod sang tuig 2003 paagi sa panan-aw sang anay Gobernador Joseph G. Marañon kag mga tigpalapnag sang kultura ang *Museo Sang Bata sa Negros*, ang una nga museyo para sa kabataan nga may mga interactive nga exhibit sa guwa sang Metro Manila.\n- Tupad ini sang Sagay Marine Reserve. Ang panguna nga katuyuan sini amo ang **Marine Conservation Education Program**, nga nagatudlo sa kabataan sa pag-atipan sang aton kadagatan.`
    }, activeLang);
  }

  // 15. Greetings & General Help / Fallback
  if (msg.includes('hi') || msg.includes('hello') || msg.includes('hey') || msg.includes('kumusta') || msg.includes('kamusta') || msg.includes('maayong') || msg.includes('good morning') || msg.includes('good afternoon')) {
    return formatTrilingualReply({
      en: `👋 **Hello and welcome to Museo Sang Bata sa Negros!**\nI'm **Bata Guide**, your interactive museum guide. I answer in English, Tagalog, and Bisaya!\n• 🏛️ **Exhibits** (Under the Sea, Touch Pool, Hampanganan)\n• 📍 **Staff Office** (under the stairs in Function Hall)\n• 🎟️ **Tickets & Hours** (₱20-₱50, 8 AM–5 PM)\n• ♿ **Accessibility & Ramp**\n• 📸 **Photo & Food Rules**`,
      tl: `👋 **Maligayang pagdating sa Museo Sang Bata sa Negros!**\nAko si **Bata Guide**, ang iyong interactive museum guide. Sumasagot ako sa Tagalog, Bisaya, at English!\n• 🏛️ **Mga Exhibit** (Under the Sea, Touch Pool, Hampanganan)\n• 📍 **Staff Office** (sa ilalim ng hagdanan sa Function Hall)\n• 🎟️ **Tickets at Oras** (₱20-₱50, 8 AM–5 PM)\n• ♿ **Wheelchair Access at Ramp**\n• 📸 **Panuntunan sa Litrato at Pagkain**`,
      bis: `👋 **Maayong pag-abot sa Museo Sang Bata sa Negros!**\nAko si **Bata Guide**, ang imo giya sa museyo. Motubag ako sa pinulongan nga imo ginpili!\n• 🏛️ **Mga Exhibit** (Under the Sea, Touch Pool, Hampanganan)\n• 📍 **Staff Office** (sa idalom sang hagdan sa Function Hall)\n• 🎟️ **Bayad kag Oras** (₱20-₱50, 8 AM–5 PM)\n• ♿ **Rampa para sa wheelchair**\n• 📸 **Mga lagda sa retrato kag pagkaon**`
    }, activeLang);
  }

  // Unknown questions should be acknowledged, not answered with invented details.
  return formatTrilingualReply({
    en: `Sorry, I don't have that information in the museum system, and I don't want to guess. Please contact the museum at **${info.phone}** or **info@museosangbata.org** for help. I can answer questions about museum visits, exhibits, programs, and events.`,
    tl: `Pasensya na, wala sa sistema ng museo ang impormasyong iyan kaya ayaw kong manghula. Makipag-ugnayan sa museo sa **${info.phone}** o **info@museosangbata.org** para matulungan kayo. Maaari akong sumagot tungkol sa pagbisita, mga exhibit, programa, at event ng museo.`,
    bis: `Pasayloa ko, wala sa sistema sa museyo ang maong impormasyon, ug dili ko gusto manghula. Palihug kontaka ang museyo sa **${info.phone}** o **info@museosangbata.org** aron matabangan ka. Makasulti ko bahin sa pagbisita, mga exhibit, programa, ug kalihokan sa museyo.`
  }, activeLang);
}

// Answer visitor questions with Groq; return explicit errors instead of local fallbacks.
router.post('/', chatLimiter, async (req, res) => {
  let apiKey;
  try {
    ({ apiKey } = await chatApiKey.getGroqConfiguration());
  } catch (err) {
    console.error('Failed to load Groq chatbot settings:', err.message);
    return res.status(500).json({ error: 'Failed to load chatbot settings.' });
  }
  const model = process.env.GROQ_MODEL || 'openai/gpt-oss-120b';

  const { message, history, language } = req.body || {};
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'Message is required.' });
  }
  if (message.length > MAX_MESSAGE_LENGTH) {
    return res.status(400).json({ error: `Message is too long (max ${MAX_MESSAGE_LENGTH} characters).` });
  }
  if (!apiKey) {
    return res.status(503).json({
      error: 'The Groq chatbot is not configured. Add a Groq API key in API Management or the server environment.',
      code: 'GROQ_CHAT_NOT_CONFIGURED'
    });
  }

  // Sanitize incoming history
  let cleanHistory = [];
  if (Array.isArray(history)) {
    cleanHistory = history
      .filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .slice(-MAX_HISTORY_MESSAGES)
      .map(m => ({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) }));
  }

  // Fetch museum records to ground the Groq response.
  const context = await getFullMuseumContext();
  const responseLanguage = detectChatLanguage(message, language);

  // Build shared messages payload for all providers
  const sysPrompt = buildSystemPrompt(context, responseLanguage);
  const messages = [
    { role: 'system', content: sysPrompt },
    ...cleanHistory,
    { role: 'user', content: message.trim() }
  ];

  // ── Helper: call OpenRouter as a fallback chat provider ──
  async function tryOpenRouterChat() {
    if (process.env.NODE_ENV === 'test' && !process.env.TEST_OPENROUTER_FALLBACK) {
      return null;
    }
    const openRouterKey = (process.env.OPENROUTER_API_KEY || '').trim();
    if (!openRouterKey) return null;
    const openRouterModel = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';
    console.log(`[Chat] Calling OpenRouter (${openRouterModel})...`);
    let resp = null;
    try {
      const controller = new AbortController();
      const tid = setTimeout(() => controller.abort(), 12000);
      resp = await fetch(`${OPENROUTER_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${openRouterKey}`,
          'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
          'X-Title': process.env.SITE_NAME || 'Museo Sang Bata sa Negros'
        },
        body: JSON.stringify({
          model: openRouterModel,
          max_tokens: 650,
          temperature: 0.5,
          messages
        }),
        signal: controller.signal
      });
      clearTimeout(tid);

      if (!resp.ok) {
        await apiUsage.recordApiUsageSafely({
          provider: 'openrouter',
          service: 'chat',
          model: openRouterModel,
          response: resp
        });
        console.warn(`[Chat] OpenRouter fallback returned HTTP ${resp.status}.`);
        return null;
      }

      const data = await resp.json();
      await apiUsage.recordApiUsageSafely({
        provider: 'openrouter',
        service: 'chat',
        model: openRouterModel,
        response: resp,
        usage: data.usage
      });

      const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
      if (reply) {
        console.log('[Chat] OpenRouter fallback succeeded.');
        return reply;
      }
      return null;
    } catch (err) {
      await apiUsage.recordApiUsageSafely({
        provider: 'openrouter',
        service: 'chat',
        model: openRouterModel,
        response: resp
      });
      console.warn('[Chat] OpenRouter fallback error:', err.message);
      return null;
    }
  }

  // ── Check if Groq is already actively rate-limited ──
  const groqRateLimitCheck = apiUsage.isRateLimited('groq', model);
  if (apiKey && groqRateLimitCheck.limited) {
    const hasOpenRouter = Boolean((process.env.OPENROUTER_API_KEY || '').trim());
    if (hasOpenRouter) {
      console.warn(`[Chat] Groq is currently in rate-limit state (${groqRateLimitCheck.reason}). Directly switching to OpenRouter.`);
      const orReply = await tryOpenRouterChat();
      if (orReply) {
        return res.json({ reply: orReply, provider: 'openrouter-fallback' });
      }
    }
  }

  // ── Tier 1: Groq (primary provider) ──
  if (apiKey) {
    let groqResponse = null;
    let usageRecorded = false;
    let timeoutId;
    let shouldFallback = false;
    try {
      const controller = new AbortController();
      timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${GROQ_API_BASE}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          max_completion_tokens: 650,
          temperature: 0.5,
          messages
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      groqResponse = response;

      if (response.ok) {
        const data = await response.json();
        await apiUsage.recordGroqUsageSafely({
          service: 'chat',
          model,
          response,
          usage: data.usage
        });
        usageRecorded = true;
        const reply = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();
        if (reply) {
          return res.json({ reply, provider: 'groq' });
        }
        // Empty reply — fall through to OpenRouter
        console.warn('[Chat] Groq returned empty reply — trying OpenRouter fallback.');
        shouldFallback = true;
      } else {
        let groqErrBody = {};
        try { groqErrBody = await response.json(); } catch (_) {}
        const groqErrMsg = (groqErrBody.error && (groqErrBody.error.message || groqErrBody.error)) || '';
        await apiUsage.recordGroqUsageSafely({
          service: 'chat',
          model,
          response
        });
        usageRecorded = true;
        console.warn('[Chat] Groq non-OK:', response.status, groqErrMsg);

        const isOverloaded = response.status === 429
          || response.status === 413
          || response.status === 503
          || (typeof groqErrMsg === 'string' && (
            groqErrMsg.toLowerCase().includes('overloaded')
            || groqErrMsg.toLowerCase().includes('rate limit')
            || groqErrMsg.toLowerCase().includes('rate_limit')
            || groqErrMsg.toLowerCase().includes('quota')
            || groqErrMsg.toLowerCase().includes('tokens')
            || groqErrMsg.toLowerCase().includes('tpm')
            || groqErrMsg.toLowerCase().includes('rpm')
            || groqErrMsg.toLowerCase().includes('rpd')
            || groqErrMsg.toLowerCase().includes('capacity')
            || groqErrMsg.toLowerCase().includes('model output')
          ));

        if (isOverloaded) {
          // ── Tier 2: OpenRouter fallback on rate-limit / overload ──
          console.warn('[Chat] Groq rate-limited or overloaded — switching to OpenRouter next.');
          shouldFallback = true;
        } else {
          return res.status(502).json({
            error: `Groq chatbot request failed (HTTP ${response.status}). Please try again.`,
            code: 'GROQ_CHAT_FAILED'
          });
        }
      }
    } catch (err) {
      clearTimeout(timeoutId);
      if (!usageRecorded) {
        await apiUsage.recordGroqUsageSafely({
          service: 'chat',
          model,
          response: groqResponse
        });
      }
      console.warn('[Chat] Groq request threw:', err.message);
      const timedOut = err.name === 'AbortError';
      if (timedOut) {
        // Timeout — try OpenRouter before giving up
        shouldFallback = true;
      } else {
        return res.status(502).json({
          error: 'Groq chatbot request failed. Please try again.',
          code: 'GROQ_CHAT_FAILED'
        });
      }
    }

    if (shouldFallback) {
      // ── Tier 2: OpenRouter fallback when Groq hits rate limit or error ──
      console.log('[Chat] Groq limit reached — transferring to OpenRouter...');
      const orReply = await tryOpenRouterChat();
      if (orReply) {
        return res.json({ reply: orReply, provider: 'openrouter' });
      }

      // If in production and OpenRouter has no answer, use local museum engine
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Chat] OpenRouter unavailable — answering with local museum engine.');
        const localReply = generateLocalFallbackReply(message, context, language);
        if (localReply) {
          await apiUsage.recordApiUsageSafely({
            provider: 'local-offline',
            service: 'chat',
            model: 'museum-rule-engine',
            response: { ok: true, status: 200 }
          });
          return res.json({ reply: localReply, provider: 'local-offline', offline: true });
        }
      }

      // In test runner or if no fallback available, return standard GROQ_CHAT_FAILED
      return res.status(502).json({
        error: 'Groq chatbot request failed. Please try again.',
        code: 'GROQ_CHAT_FAILED'
      });
    }
  }

  // ── No Groq key: try OpenRouter directly, then return 503 ──
  const orReply = await tryOpenRouterChat();
  if (orReply) {
    return res.json({ reply: orReply, provider: 'openrouter' });
  }

  return res.status(503).json({
    error: 'The Groq chatbot is not configured. Add a Groq API key in API Management or the server environment.',
    code: 'GROQ_CHAT_NOT_CONFIGURED'
  });
});

module.exports = router;
