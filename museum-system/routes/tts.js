// Groq-backed translation and speech endpoints.
const express = require('express');
const chatApiKey = require('../db/chat-api-key');
const apiUsage = require('../db/api-usage');

const router = express.Router();

// In-memory caches for instant response and reliability
const translationCache = new Map();
const audioCache = new Map();
const audioCacheMeta = new Map();

// Groq API base URL
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';
const MAX_TTS_RATE_LIMIT_RETRIES = 1;
const MAX_AUTOMATIC_TTS_RETRY_MS = 2000;

function getRetryAfterMs(response) {
  const retryAfter = response.headers && response.headers.get('retry-after');
  if (!retryAfter) return null;

  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds >= 0) return seconds * 1000;

  const retryAt = Date.parse(retryAfter);
  return Number.isNaN(retryAt) ? null : Math.max(0, retryAt - Date.now());
}

function getTtsRateLimitMessage(retryAfterMs) {
  if (retryAfterMs === null) {
    return 'Groq speech is temporarily rate-limited. Please wait a little while and try again. If this continues, check your Groq organization request and audio limits.';
  }
  if (retryAfterMs < 1000) {
    return 'Groq speech is temporarily rate-limited. Please try again shortly. If this continues, check your Groq organization request and audio limits.';
  }

  const waitSeconds = Math.ceil(retryAfterMs / 1000);
  return `Groq speech is temporarily rate-limited. Please wait at least ${waitSeconds} seconds and try again. If this continues, check your Groq organization request and audio limits.`;
}

async function fetchSpeechWithRateLimitRetry(makeRequest, onResponse) {
  let retryCount = 0;
  let response = await makeRequest();
  await onResponse(response);

  const retryAfterMs = response.status === 429 ? getRetryAfterMs(response) : null;
  if (
    retryCount >= MAX_TTS_RATE_LIMIT_RETRIES ||
    retryAfterMs === null ||
    retryAfterMs > MAX_AUTOMATIC_TTS_RETRY_MS
  ) {
    return response;
  }

  retryCount++;
  await new Promise(resolve => setTimeout(resolve, retryAfterMs));
  response = await makeRequest();
  await onResponse(response);
  return response;
}

// Groq Orpheus accepts at most 200 characters per speech request.
function splitIntoChunks(str, maxLen = 200) {
  const clean = str.replace(/[\r\n]+/g, ' ').trim();
  const chunks = [];
  let current = '';

  for (const word of clean.split(/\s+/)) {
    if (!word) continue;
    if (word.length > maxLen) {
      if (current) chunks.push(current);
      current = '';
      for (let offset = 0; offset < word.length; offset += maxLen) {
        chunks.push(word.slice(offset, offset + maxLen));
      }
      continue;
    }

    const next = current ? `${current} ${word}` : word;
    if (next.length <= maxLen) {
      current = next;
    } else {
      chunks.push(current);
      current = word;
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : [clean.slice(0, maxLen)];
}

// Map common language names and codes to the service's supported language identifiers.
function normalizeTargetLang(raw) {
  if (!raw) return 'en';
  const l = String(raw).toLowerCase().trim();
  if (l === 'ar' || l === 'arabic' || l === 'ar-sa' || l.startsWith('ar-')) return 'ar';
  if (l === 'hil' || l === 'hiligaynon' || l === 'ilonggo' || l === 'ilo' || l.startsWith('hil') || l.includes('ilonggo') || l.includes('hiligaynon')) return 'hil';
  if (l === 'cb' || l === 'ceb' || l === 'cebuano' || l === 'bisaya' || l === 'binisaya' || l.includes('ceb') || l.includes('bisaya')) return 'cb';
  if (l === 'tl' || l === 'tag' || l === 'tagalog' || l === 'fil' || l === 'filipino' || l.includes('tag') || l.includes('filipino')) return 'tl';
  if (l === 'en' || l === 'eng' || l === 'english' || l === 'original') return 'en';
  return l;
}

function getGroqSpeechConfiguration(lang) {
  if (lang === 'en') {
    return {
      model: 'canopylabs/orpheus-v1-english',
      voice: process.env.GROQ_TTS_VOICE || 'autumn'
    };
  }
  if (lang === 'ar') {
    return {
      model: 'canopylabs/orpheus-arabic-saudi',
      voice: process.env.GROQ_TTS_ARABIC_VOICE || 'aisha'
    };
  }
  return null;
}

function parseWavBuffer(buffer) {
  if (buffer.length < 12 || buffer.toString('ascii', 0, 4) !== 'RIFF' ||
    buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Groq returned audio that is not a valid WAV file.');
  }

  let formatChunk = null;
  let audioData = null;
  let offset = 12;

  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString('ascii', offset, offset + 4);
    const chunkSize = buffer.readUInt32LE(offset + 4);
    const chunkStart = offset + 8;

    if (chunkId === 'data') {
      // In streaming WAV files (e.g. Lavf / FFmpeg used by Groq), data chunkSize is 0xFFFFFFFF (-1)
      // or exceeds the received buffer length. In that case, audio data extends to EOF.
      if (chunkSize === 0xFFFFFFFF || chunkStart + chunkSize > buffer.length) {
        audioData = buffer.subarray(chunkStart, buffer.length);
        break;
      }
      audioData = buffer.subarray(chunkStart, chunkStart + chunkSize);
      offset = chunkStart + chunkSize + (chunkSize % 2);
      continue;
    }

    const chunkEnd = chunkStart + chunkSize;
    if (chunkEnd > buffer.length) {
      // A non-data chunk whose declared size exceeds the buffer is a Lavf/FFmpeg streaming
      // artifact (inflated metadata sizes). Stop parsing here; if we already found fmt+data, use them.
      break;
    }

    if (chunkId === 'fmt ') {
      formatChunk = buffer.subarray(offset, chunkEnd + (chunkSize % 2));
    }

    offset = chunkEnd + (chunkSize % 2);
  }

  if (!formatChunk || !audioData) {
    throw new Error('Groq returned a WAV file without format or audio data.');
  }

  return { formatChunk, audioData };
}

function combineWavBuffers(buffers) {
  const parsed = buffers.map(parseWavBuffer);
  const formatChunk = parsed[0].formatChunk;
  if (parsed.some(chunk => !chunk.formatChunk.equals(formatChunk))) {
    throw new Error('Groq returned incompatible WAV audio formats.');
  }

  const audioData = Buffer.concat(parsed.map(chunk => chunk.audioData));
  const padding = audioData.length % 2;
  const output = Buffer.alloc(12 + formatChunk.length + 8 + audioData.length + padding);
  output.write('RIFF', 0, 4, 'ascii');
  output.writeUInt32LE(output.length - 8, 4);
  output.write('WAVE', 8, 4, 'ascii');
  formatChunk.copy(output, 12);
  const dataHeaderOffset = 12 + formatChunk.length;
  output.write('data', dataHeaderOffset, 4, 'ascii');
  output.writeUInt32LE(audioData.length, dataHeaderOffset + 4);
  audioData.copy(output, dataHeaderOffset + 8);
  return output;
}

// Build the provider instructions for a supported translation target language.
function getSystemPrompt(rawTargetLang) {
  const targetLang = normalizeTargetLang(rawTargetLang);
  if (targetLang === 'hil') {
    return `You are a master Hiligaynon (Ilonggo) translator and cultural linguist for Museo Sang Bata sa Negros in Sagay City, Negros Occidental, Philippines.
Your mission is to translate English museum text into authentic, natural, and grammatically flawless Hiligaynon as spoken natively in Sagay City and Western Visayas.

CRITICAL RULES FOR HILIGAYNON (ILONGGO):
1. GREETINGS & TONE:
   - NEVER use Tagalog "Mabuhay". Use "Maayong pag-abot" or "Malipayon nga pag-abot".
   - Tone must be warm, enthusiastic, educational, and respectful for children, teachers, and visiting families.
2. VOCABULARY ACCURACY (STRICTLY AVOID TAGALOG CONTAMINATION):
   - "buhay" -> use "kabuhi" (e.g. "kabuhi sa kadagatan", NOT "buhay-dagat")
   - "dagat" / "ocean" -> use "kadagatan" or "dagat"
   - "makulay" -> use "mabulukon" or "maduagon"
   - "laro" / "laruan" -> use "hampang" / "hampanganan" or "duwahanan"
   - "masaya" -> use "malipayon"
   - "matuto" / "pag-aaral" -> use "magtuon" / "pagtuon" / "makatuon"
   - "aklat" -> use "libro"
   - "tahanan" / "bahay" -> use "balay"
   - "ilog" -> use "suba"
   - "bata" (plural) -> use "mga kabataan" or "mga bata"
   - "lungsod" -> use "syudad" or "dakbanwa"
   - "buhangin" -> use "balas"
   - "coral reef" -> "bahura" or "mga korales"
   - "exhibit" -> "eksibit" or "pasundayag"
   - "flagship" -> "nagapanguna" or "puno nga"
3. GRAMMAR MARKERS:
   - Use Hiligaynon markers: "sang" (of/by), "ang mga" (the plural), "sa" (in/to/at), "kag" (and).
   - NEVER use Tagalog "ng", "at", or "ay".
4. PROPER NOUNS:
   - Keep "Museo Sang Bata sa Negros", "Sagay Marine Reserve", "Sagay City", and specific room names intact.
5. FORMATTING:
   - Output ONLY the translated Hiligaynon text.
   - Do NOT include quotes, explanations, preambles, or markdown notes.`;
  }

  if (targetLang === 'cb') {
    return `You are a master Cebuano (Bisaya) translator and cultural linguist for Museo Sang Bata sa Negros.
Your mission is to translate English museum text into authentic, natural, and grammatically flawless Cebuano / Bisaya as spoken in Central and Eastern Visayas.

CRITICAL RULES FOR CEBUANO (BISAYA):
1. GREETINGS & TONE:
   - NEVER use Tagalog "Mabuhay". Use "Maayong pag-abot" or "Mainitong pagdawat".
   - Tone must be warm, educational, engaging, and friendly for children and families.
2. VOCABULARY ACCURACY (STRICTLY AVOID TAGALOG CONTAMINATION):
   - "buhay" -> use "kinabuhi" (e.g. "kinabuhi sa dagat", NOT "buhay-dagat")
   - "makulay" -> use "mabulokon" or "maduagon"
   - "laro" / "laruan" -> use "dula" / "dulaan" or "dulaanan"
   - "masaya" -> use "malipayon"
   - "matuto" / "pag-aaral" -> use "makakat-on" / "magtuon" / "pagkat-on"
   - "aklat" -> use "libro"
   - "bata" (plural) -> use "mga bata"
   - "buhangin" -> use "balas"
   - "coral reef" -> "bahura" or "mga korales"
   - "exhibit" -> "eksibit" or "pasundayag"
   - "flagship" -> "nag-unang"
3. GRAMMAR MARKERS:
   - Use Cebuano markers: "sa", "ang mga", "ug" (and).
   - NEVER use Tagalog "ng", "at", "ay", or Hiligaynon "sang", "kag".
4. PROPER NOUNS:
   - Keep "Museo Sang Bata sa Negros", "Sagay Marine Reserve", "Sagay City" intact.
5. FORMATTING:
   - Output ONLY the translated Cebuano text.
   - Do NOT include quotes, explanations, preambles, or markdown notes.`;
  }

  if (targetLang === 'tl') {
    return `You are a master Filipino (Tagalog) translator and educator for Museo Sang Bata sa Negros.
Your mission is to translate English museum text into natural, warm, grammatically correct, and engaging Filipino suitable for children and families.

CRITICAL RULES FOR FILIPINO (TAGALOG):
1. GREETINGS & TONE:
   - Use "Maligayang pagdating sa Museo Sang Bata sa Negros" for welcome messages.
   - Maintain an inspiring, educational, clear, and child-friendly tone.
2. VOCABULARY ACCURACY:
   - Avoid awkward, word-for-word machine translation.
   - Use natural Filipino expressions used in Philippine museums and schools.
   - "exhibit" -> "eksibit" or "itinatanghal"
   - "interactive" -> "interaktibo" o "maaaring subukan at maranasan"
   - "marine biodiversity" -> "biodibersidad sa dagat" o "mayamang buhay-dagat"
3. PROPER NOUNS:
   - Keep "Museo Sang Bata sa Negros", "Sagay Marine Reserve", "Sagay City" intact.
4. FORMATTING:
   - Output ONLY the translated Filipino text.
   - Do NOT include quotes, explanations, preambles, or markdown notes.`;
  }

  return `You are a professional museum translator. Translate the text accurately into English with an educational and engaging tone. Return ONLY the pure translated text.`;
}

// ── Translation status endpoint ──────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const { apiKey } = await chatApiKey.getGroqConfiguration();
    const hasGroqKey = Boolean(apiKey);
    res.json({
      translationConfigured: hasGroqKey,
      groqConfigured: hasGroqKey,
      groqTtsConfigured: hasGroqKey,
      groqTtsLanguages: ['en', 'ar'],
      speechProviders: {
        en: hasGroqKey ? 'groq-orpheus' : 'unconfigured',
        ar: hasGroqKey ? 'groq-orpheus-arabic' : 'unconfigured',
        tl: 'unsupported-by-groq',
        cb: 'unsupported-by-groq',
        hil: 'unsupported-by-groq'
      }
    });
  } catch (err) {
    console.error('Failed to load Groq service status:', err.message);
    res.status(500).json({ error: 'Failed to load AI service status.' });
  }
});

// ── Translation endpoint (Groq openai/gpt-oss-120b) ──────────────
// Translate text through Groq, using a cache and returning English unchanged.
router.post('/translate', async (req, res) => {
  const text = req.body && req.body.text;
  const rawLang = (req.body && (req.body.targetLang || req.body.lang || req.body.language)) || '';
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (!rawLang || !String(rawLang).trim()) {
    return res.status(400).json({ error: 'Target language is required.' });
  }

  let groqKey;
  try {
    ({ apiKey: groqKey } = await chatApiKey.getGroqConfiguration());
  } catch (err) {
    console.error('Failed to load Groq translation key:', err.message);
    return res.status(500).json({ error: 'Failed to load translation service settings.' });
  }

  const targetLang = normalizeTargetLang(rawLang);
  const trimmedText = text.trim();

  // If requested language is English/original, return text directly
  if (targetLang === 'en') {
    return res.json({ translatedText: trimmedText });
  }

  const cacheKey = `${targetLang}:${trimmedText}`;
  if (translationCache.has(cacheKey)) {
    return res.json({ translatedText: translationCache.get(cacheKey) });
  }

  if (!groqKey) {
    return res.status(503).json({ error: 'Translation service is not configured. Add a Groq key in the admin dashboard or server environment.' });
  }

  const systemPrompt = getSystemPrompt(targetLang);

  let groqResponse;
  let usageRecorded = false;
  try {
    console.log(`[Translation] Translating to ${targetLang} using Groq openai/gpt-oss-120b...`);

    groqResponse = await fetch(`${GROQ_API_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + groqKey
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmedText }
        ],
        temperature: 1,
        max_tokens: 2048,
        top_p: 1,
        reasoning_effort: 'medium',
        stream: false
      })
    });

    if (!groqResponse.ok) {
      await apiUsage.recordGroqUsageSafely({
        service: 'translation',
        model: 'openai/gpt-oss-120b',
        response: groqResponse
      });
      usageRecorded = true;
      const errBody = await groqResponse.text();
      console.error('[Translation] Groq API error:', groqResponse.status, errBody);
      return res.status(502).json({ error: 'Translation service error: ' + groqResponse.status });
    }

    const data = await groqResponse.json();
    await apiUsage.recordGroqUsageSafely({
      service: 'translation',
      model: 'openai/gpt-oss-120b',
      response: groqResponse,
      usage: data.usage
    });
    usageRecorded = true;
    const msg = data.choices && data.choices[0] && data.choices[0].message;
    // gpt-oss-120b is a reasoning model — content holds the final answer
    let translatedText = (msg && msg.content || '').trim();

    // Clean up surrounding quotes if the model wrapped output
    if (
      (translatedText.startsWith('"') && translatedText.endsWith('"')) ||
      (translatedText.startsWith("'") && translatedText.endsWith("'"))
    ) {
      translatedText = translatedText.slice(1, -1).trim();
    }

    if (!translatedText) {
      console.error('[Translation] Groq returned an empty translation.');
      return res.status(502).json({ error: 'Translation service returned an empty result. Please try again.' });
    }

    translationCache.set(cacheKey, translatedText);
    console.log(`[Translation] Done (${targetLang}): "${translatedText.substring(0, 60)}..."`);
    res.json({ translatedText });
  } catch (err) {
    if (!usageRecorded) {
      await apiUsage.recordGroqUsageSafely({
        service: 'translation',
        model: 'openai/gpt-oss-120b',
        response: groqResponse
      });
    }
    console.error('[Translation] Groq request threw:', err.message);
    res.status(502).json({ error: 'Translation failed: ' + err.message });
  }
});

// ── TTS endpoint (Groq Orpheus) ──────────────────────────────────
router.post('/speak', async (req, res) => {
  const rawLang = (req.body && (req.body.lang || req.body.targetLang || req.body.language)) || 'tl';
  const lang = normalizeTargetLang(rawLang);
  const text = req.body && req.body.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  const cleanText = text.slice(0, 1500).replace(/[\r\n]+/g, ' ').trim();
  const speechConfiguration = getGroqSpeechConfiguration(lang);
  if (!speechConfiguration) {
    const languageNames = {
      tl: 'Tagalog',
      cb: 'Cebuano/Bisaya',
      hil: 'Hiligaynon'
    };
    const languageName = languageNames[lang] || 'The selected language';
    return res.status(501).json({
      error: `Groq speech currently supports English and Saudi Arabic only; it cannot generate ${languageName} narration.`,
      code: 'GROQ_TTS_LANGUAGE_UNSUPPORTED',
      language: lang
    });
  }

  let groqKey;
  try {
    ({ apiKey: groqKey } = await chatApiKey.getGroqConfiguration());
  } catch (err) {
    console.error('Failed to load Groq text-to-speech key:', err.message);
    return res.status(500).json({ error: 'Failed to load text-to-speech settings.' });
  }
  if (!groqKey) {
    return res.status(503).json({
      error: 'Groq speech is not configured. Add a Groq API key in API Management or the server environment.',
      code: 'GROQ_TTS_NOT_CONFIGURED',
      language: lang
    });
  }

  const cacheKey = `${lang}:${cleanText}`;

  if (audioCache.has(cacheKey)) {
    const cachedBuffer = audioCache.get(cacheKey);
    const cachedMeta = audioCacheMeta.get(cacheKey) || { type: 'audio/wav', provider: 'cached' };
    res.set('Content-Type', cachedMeta.type);
    res.set('Content-Length', cachedBuffer.byteLength);
    res.set('X-TTS-Provider', 'cached');
    return res.send(cachedBuffer);
  }

  const chunks = splitIntoChunks(cleanText, 200);
  const audioBuffers = [];
  let groqResponse;
  let usageRecorded = false;
  let currentChunk = '';

  try {
    for (const chunk of chunks) {
      currentChunk = chunk;
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      try {
        groqResponse = await fetchSpeechWithRateLimitRetry(() => {
          groqResponse = null;
          usageRecorded = false;
          return fetch(`${GROQ_API_BASE}/audio/speech`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${groqKey.trim()}`
          },
          body: JSON.stringify({
            model: speechConfiguration.model,
            voice: speechConfiguration.voice,
            response_format: 'wav',
            input: chunk
          }),
          signal: controller.signal
          });
        }, async response => {
          groqResponse = response;
          await apiUsage.recordGroqUsageSafely({
            service: 'speech',
            model: speechConfiguration.model,
            response,
            audioCharacters: chunk.length
          });
          usageRecorded = true;
        });
      } finally {
        clearTimeout(timeout);
      }

      if (!groqResponse.ok) {
        console.error(`[TTS] Groq speech request failed (${groqResponse.status}).`);
        if (groqResponse.status === 429) {
          const retryAfterMs = getRetryAfterMs(groqResponse);
          const retryAfter = groqResponse.headers.get('retry-after');
          if (retryAfter) res.set('Retry-After', retryAfter);
          return res.status(429).json({
            error: getTtsRateLimitMessage(retryAfterMs),
            code: 'GROQ_TTS_RATE_LIMITED',
            language: lang,
            retryAfterSeconds: retryAfterMs === null ? null : Math.ceil(retryAfterMs / 1000)
          });
        }
        const error = groqResponse.status === 401
          ? 'Groq rejected the configured API key. Update GROQ_API_KEY in the server environment or API Management.'
          : `Groq speech generation failed (HTTP ${groqResponse.status}). Please try again.`;
        return res.status(502).json({
          error,
          code: 'GROQ_TTS_FAILED',
          language: lang
        });
      }

      const audioBuffer = Buffer.from(await groqResponse.arrayBuffer());
      if (!audioBuffer.length) {
        console.error('[TTS] Groq returned an empty audio response.');
        return res.status(502).json({
          error: 'Groq returned empty speech audio. Please try again.',
          code: 'GROQ_TTS_FAILED',
          language: lang
        });
      }
      audioBuffers.push(audioBuffer);
    }

    usageRecorded = true;
    const combinedBuffer = combineWavBuffers(audioBuffers);
    audioCache.set(cacheKey, combinedBuffer);
    audioCacheMeta.set(cacheKey, { type: 'audio/wav', provider: 'groq-orpheus' });
    res.set('Content-Type', 'audio/wav');
    res.set('Content-Length', combinedBuffer.byteLength);
    res.set('X-TTS-Provider', speechConfiguration.model.endsWith('arabic-saudi') ? 'groq-orpheus-arabic' : 'groq-orpheus');
    return res.send(combinedBuffer);
  } catch (err) {
    if (!usageRecorded) {
      await apiUsage.recordGroqUsageSafely({
        service: 'speech',
        model: speechConfiguration.model,
        response: groqResponse,
        audioCharacters: currentChunk.length
      });
    }
    console.error('[TTS] Groq speech request failed:', err.message);
    const timedOut = err.name === 'AbortError';
    return res.status(timedOut ? 504 : 502).json({
      error: timedOut ? 'Groq speech generation timed out. Please try again.' : 'Groq speech generation failed. Please try again.',
      code: 'GROQ_TTS_FAILED',
      language: lang
    });
  }
});

module.exports = router;