const express = require('express');

const router = express.Router();

// In-memory caches for instant response and reliability
const translationCache = new Map();
const audioCache = new Map();

function splitIntoChunks(str, maxLen = 140) {
  const clean = str.replace(/[\r\n]+/g, ' ').trim();
  const sentences = clean.match(/[^.!?—–;]+[.!?—–;]+|[^.!?—–;]+$/g) || [clean];
  const chunks = [];
  let current = '';

  for (const s of sentences) {
    const trimmed = s.trim();
    if (!trimmed) continue;
    if ((current ? current + ' ' + trimmed : trimmed).length <= maxLen) {
      current = current ? current + ' ' + trimmed : trimmed;
    } else {
      if (current) chunks.push(current);
      if (trimmed.length > maxLen) {
        const words = trimmed.split(' ');
        let sub = '';
        for (const w of words) {
          if ((sub ? sub + ' ' + w : w).length <= maxLen) {
            sub = sub ? sub + ' ' + w : w;
          } else {
            if (sub) chunks.push(sub);
            sub = w;
          }
        }
        if (sub) current = sub;
        else current = '';
      } else {
        current = trimmed;
      }
    }
  }
  if (current) chunks.push(current);
  return chunks.length ? chunks : [clean.slice(0, maxLen)];
}

function normalizeTargetLang(raw) {
  if (!raw) return 'en';
  const l = String(raw).toLowerCase().trim();
  if (l === 'hil' || l === 'hiligaynon' || l === 'ilonggo' || l === 'ilo' || l.startsWith('hil') || l.includes('ilonggo') || l.includes('hiligaynon')) return 'hil';
  if (l === 'cb' || l === 'ceb' || l === 'cebuano' || l === 'bisaya' || l === 'binisaya' || l.includes('ceb') || l.includes('bisaya')) return 'cb';
  if (l === 'tl' || l === 'tag' || l === 'tagalog' || l === 'fil' || l === 'filipino' || l.includes('tag') || l.includes('filipino')) return 'tl';
  if (l === 'en' || l === 'eng' || l === 'english' || l === 'original') return 'en';
  return l;
}

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
router.get('/status', (req, res) => {
  const hasFishKey = Boolean((process.env.FISH_AUDIO_API_KEY || '').trim());
  const hasTranslationKey = Boolean((process.env.TRANSLATION_API_KEY || process.env.OPENROUTER_API_KEY || '').trim());
  res.json({
    translationConfigured: hasTranslationKey,
    fishAudioConfigured: hasFishKey,
    fishAudioModel: process.env.FISH_AUDIO_MODEL || 's2.1-pro-free',
    fishAudioVoiceId: process.env.FISH_AUDIO_VOICE_ID || process.env.FISH_AUDIO_REFERENCE_ID || null
  });
});

// ── Translation endpoint ──────────────────────────────────────────
router.post('/translate', async (req, res) => {
  const apiKey = process.env.TRANSLATION_API_KEY || process.env.OPENROUTER_API_KEY;
  const primaryModel = process.env.TRANSLATION_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  const text = req.body && req.body.text;
  const rawLang = (req.body && (req.body.targetLang || req.body.lang || req.body.language)) || '';
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (!rawLang || !String(rawLang).trim()) {
    return res.status(400).json({ error: 'Target language is required.' });
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

  if (!apiKey) {
    return res.status(503).json({ error: 'Translation service not configured. Set TRANSLATION_API_KEY or OPENROUTER_API_KEY in .env.' });
  }

  const systemPrompt = getSystemPrompt(targetLang);
  // Calculate a proportional max_tokens so we never trigger OpenRouter credit over-reservation
  const calculatedTokens = Math.min(500, Math.max(150, Math.ceil(trimmedText.length * 1.5)));

  const callModel = async (modelName) => {
    return await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.SITE_NAME || 'Museo Sang Bata sa Negros'
      },
      body: JSON.stringify({
        model: modelName,
        max_tokens: calculatedTokens,
        temperature: 0.1,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: trimmedText }
        ]
      })
    });
  };

  try {
    let response = await callModel(primaryModel);

    // If primary model failed due to credit limit or unavailability, attempt fallback
    if (!response.ok && response.status === 402) {
      console.warn(`[Translation] Primary model ${primaryModel} returned 402. Attempting fallback free model...`);
      const fallbackModels = ['google/gemma-4-26b-a4b-it:free', 'deepseek/deepseek-v4-flash-0731:free'];
      for (const fallback of fallbackModels) {
        try {
          const fbResp = await callModel(fallback);
          if (fbResp.ok) {
            response = fbResp;
            break;
          }
        } catch (e) {
          /* try next fallback */
        }
      }
    }

    if (!response.ok) {
      const errBody = await response.text();
      console.error('[Translation] OpenRouter translation error:', response.status, errBody);
      return res.status(502).json({ error: 'Translation service error.' });
    }

    const data = await response.json();
    let translatedText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();

    // Clean up surrounding quotes if the model wrapped output
    if ((translatedText.startsWith('"') && translatedText.endsWith('"')) || (translatedText.startsWith("'") && translatedText.endsWith("'"))) {
      translatedText = translatedText.slice(1, -1).trim();
    }

    if (translatedText) {
      translationCache.set(cacheKey, translatedText);
    }

    res.json({ translatedText });
  } catch (err) {
    console.error('[Translation] Translation request failed:', err);
    res.status(502).json({ error: 'Translation failed.' });
  }
});

// ── TTS endpoint (Fish Audio AI API with natural high-fidelity streaming fallback) ──
router.post('/speak', async (req, res) => {
  const rawLang = (req.body && (req.body.lang || req.body.targetLang || req.body.language)) || 'tl';
  const lang = normalizeTargetLang(rawLang);
  const text = req.body && req.body.text;
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  const cleanText = text.slice(0, 1500).replace(/[\r\n]+/g, ' ').trim();
  const cacheKey = `${lang}:${cleanText}`;

  if (audioCache.has(cacheKey)) {
    const cachedBuffer = audioCache.get(cacheKey);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', cachedBuffer.byteLength);
    res.set('X-TTS-Provider', 'cached');
    return res.send(cachedBuffer);
  }

  // ── 1. Fish Audio AI API Integration ──────────────────────────────
  const fishKey = (req.body && req.body.fishApiKey) || req.headers['x-fish-audio-key'] || process.env.FISH_AUDIO_API_KEY;
  if (fishKey && String(fishKey).trim()) {
    const apiKeyClean = String(fishKey).trim();
    try {
      const fishPayload = {
        text: cleanText,
        format: 'mp3',
        latency: 'balanced',
        prosody: {
          speed: 1.0,
          volume: 0
        }
      };

      const voiceRef = req.body.reference_id || req.body.voice || process.env.FISH_AUDIO_VOICE_ID || process.env.FISH_AUDIO_REFERENCE_ID || (process.env.FISH_AUDIO_MODEL && process.env.FISH_AUDIO_MODEL !== 's2.1-pro-free' && process.env.FISH_AUDIO_MODEL !== 's2.1-pro' ? process.env.FISH_AUDIO_MODEL : null);
      if (voiceRef) {
        fishPayload.reference_id = voiceRef;
      }

      const controller = new AbortController();
      const fishTimeout = setTimeout(() => controller.abort(), 15000);

      const response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + apiKeyClean,
          model: process.env.FISH_AUDIO_MODEL || 's2.1-pro-free'
        },
        body: JSON.stringify(fishPayload),
        signal: controller.signal
      });
      clearTimeout(fishTimeout);

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const buf = Buffer.from(audioBuffer);
        audioCache.set(cacheKey, buf);
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', buf.byteLength);
        res.set('X-TTS-Provider', 'fish-audio');
        console.log(`[TTS] Voice audio generated with Fish Audio AI API (${buf.byteLength} bytes).`);
        return res.send(buf);
      } else {
        const errText = await response.text();
        console.warn(`[TTS] Fish Audio returned status ${response.status}: ${errText}. Falling back to natural audio streaming.`);
      }
    } catch (err) {
      console.error('[TTS] Fish Audio request error:', err.message, '- Using natural voice fallback.');
    }
  }

  // ── 2. Natural High-Fidelity Voice Streaming Fallback ────────────
  try {
    const ttsLang = (lang === 'cb' || lang === 'tl' || lang === 'hil') ? 'tl' : 'en';
    const chunks = splitIntoChunks(cleanText, 140);
    const audioBuffers = [];

    for (const chunk of chunks) {
      if (!chunk.trim()) continue;
      const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
      const ttsResp = await fetch(googleTtsUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
        }
      });

      if (ttsResp.ok) {
        const ab = await ttsResp.arrayBuffer();
        audioBuffers.push(Buffer.from(ab));
      }
    }

    if (audioBuffers.length === 0) {
      return res.status(502).json({ error: 'Voice audio service error.' });
    }

    const combinedBuffer = Buffer.concat(audioBuffers);
    audioCache.set(cacheKey, combinedBuffer);

    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', combinedBuffer.byteLength);
    res.set('X-TTS-Provider', 'natural-stream');
    res.send(combinedBuffer);
  } catch (err) {
    console.error('[TTS] Voice audio request failed:', err);
    res.status(502).json({ error: 'Voice audio failed.' });
  }
});

module.exports = router;