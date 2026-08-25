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

// ── Translation endpoint ──────────────────────────────────────────
router.post('/translate', async (req, res) => {
  const apiKey = process.env.TRANSLATION_API_KEY || process.env.OPENROUTER_API_KEY;
  const model = process.env.TRANSLATION_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  const { text, targetLang } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (!targetLang) {
    return res.status(400).json({ error: 'Target language is required.' });
  }

  const cacheKey = `${targetLang}:${text.trim()}`;
  if (translationCache.has(cacheKey)) {
    return res.json({ translatedText: translationCache.get(cacheKey) });
  }

  if (!apiKey) {
    return res.status(503).json({ error: 'Translation service not configured. Set TRANSLATION_API_KEY or OPENROUTER_API_KEY in .env.' });
  }

  let langInstruction = 'Translate the text accurately into English.';
  if (targetLang === 'tl') {
    langInstruction = 'Translate the text into natural, fluent, and contemporary Filipino (Tagalog) suitable for a children and family museum in the Philippines. Use appropriate and natural phrasing, not awkward word-for-word literal translations. Keep proper nouns and place names intact.';
  } else if (targetLang === 'cb') {
    langInstruction = 'Translate the text into natural, authentic Cebuano / Bisaya as spoken in the Visayas (Negros / Central Visayas). Ensure proper grammar and vocabulary suitable for visitors. Keep proper nouns and place names intact.';
  } else if (targetLang === 'hil') {
    langInstruction = 'Translate the text into natural, authentic Hiligaynon (Ilonggo) as spoken in Negros Occidental and Western Visayas. Ensure warm, respectful, and family-friendly phrasing. Keep proper nouns and place names intact.';
  }

  const systemPrompt = `You are an expert bilingual museum translator for Museo Sang Bata sa Negros in Sagay City, Philippines.
Task: ${langInstruction}
Rules:
- Preserve the exact meaning, enthusiasm, and educational tone.
- Output ONLY the translated text without commentary, quotes, notes, or explanations.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + apiKey,
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.SITE_NAME || 'Museo Sang Bata sa Negros'
      },
      body: JSON.stringify({
        model,
        max_tokens: 1000,
        temperature: 0.2,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenRouter translation error:', response.status, errBody);
      return res.status(502).json({ error: 'Translation service error.' });
    }

    const data = await response.json();
    const translatedText = (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content || '').trim();

    if (translatedText) {
      translationCache.set(cacheKey, translatedText);
    }

    res.json({ translatedText });
  } catch (err) {
    console.error('Translation request failed:', err);
    res.status(502).json({ error: 'Translation failed.' });
  }
});

// ── TTS endpoint (returns high-fidelity MP3 audio with seamless chunking) ──
router.post('/speak', async (req, res) => {
  const { text, lang = 'tl' } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  const cleanText = text.slice(0, 1000).replace(/[\r\n]+/g, ' ').trim();
  const cacheKey = `${lang}:${cleanText}`;

  if (audioCache.has(cacheKey)) {
    const cachedBuffer = audioCache.get(cacheKey);
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', cachedBuffer.byteLength);
    return res.send(cachedBuffer);
  }

  // Fish Audio integration if key exists
  const fishKey = process.env.FISH_AUDIO_API_KEY;
  if (fishKey) {
    try {
      const response = await fetch('https://api.fish.audio/v1/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer ' + fishKey,
          model: process.env.FISH_AUDIO_MODEL || 's2.1-pro-free'
        },
        body: JSON.stringify({
          text: cleanText,
          format: 'mp3'
        })
      });

      if (response.ok) {
        const audioBuffer = await response.arrayBuffer();
        const buf = Buffer.from(audioBuffer);
        audioCache.set(cacheKey, buf);
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', buf.byteLength);
        return res.send(buf);
      }
    } catch (err) {
      console.error('Fish Audio failed, using high-fidelity fallback:', err);
    }
  }

  // High-fidelity natural voice streaming with sentence chunking
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
    res.send(combinedBuffer);
  } catch (err) {
    console.error('Voice audio request failed:', err);
    res.status(502).json({ error: 'Voice audio failed.' });
  }
});

module.exports = router;