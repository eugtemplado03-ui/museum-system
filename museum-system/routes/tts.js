const express = require('express');

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

// Translation endpoint
router.post('/translate', async (req, res) => {
  const apiKey = process.env.TRANSLATION_API_KEY || process.env.OPENROUTER_API_KEY;
  const model = process.env.TRANSLATION_MODEL || process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

  if (!apiKey) {
    return res.status(503).json({ error: 'Translation service not configured. Set TRANSLATION_API_KEY or OPENROUTER_API_KEY in .env.' });
  }

  const { text, targetLang } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (!targetLang) {
    return res.status(400).json({ error: 'Target language is required.' });
  }

  let langInstruction = 'Translate the text accurately into English.';
  if (targetLang === 'tl') {
    langInstruction = 'Translate the text into natural, fluent, and contemporary Filipino (Tagalog) suitable for a children and family museum in the Philippines. Use appropriate and natural phrasing, not awkward word-for-word literal translations. Keep proper nouns and place names intact.';
  } else if (targetLang === 'cb') {
    langInstruction = 'Translate the text into natural, authentic Cebuano / Bisaya as spoken in the Visayas (Negros / Central Visayas). Ensure proper grammar and vocabulary suitable for visitors. Keep proper nouns and place names intact.';
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

    res.json({ translatedText });
  } catch (err) {
    console.error('Translation request failed:', err);
    res.status(502).json({ error: 'Translation failed.' });
  }
});

// TTS endpoint (returns high-fidelity MP3 audio)
router.post('/speak', async (req, res) => {
  const fishKey = process.env.FISH_AUDIO_API_KEY;
  const { text, lang = 'tl' } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  const cleanText = text.slice(0, 500).replace(/[\r\n]+/g, ' ').trim();

  // If Fish Audio key is set, use Fish Audio s2.1-pro
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
        res.set('Content-Type', 'audio/mpeg');
        res.set('Content-Length', audioBuffer.byteLength);
        return res.send(Buffer.from(audioBuffer));
      }
      console.error('Fish Audio returned non-ok, using high-fidelity fallback:', response.status);
    } catch (err) {
      console.error('Fish Audio failed, using fallback:', err);
    }
  }

  // High-fidelity natural voice streaming
  try {
    const ttsLang = (lang === 'cb' || lang === 'tl') ? 'tl' : 'en';
    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${ttsLang}&client=tw-ob&q=${encodeURIComponent(cleanText)}`;
    const ttsResp = await fetch(googleTtsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!ttsResp.ok) {
      return res.status(502).json({ error: 'Voice audio service error.' });
    }

    const audioBuffer = await ttsResp.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('Voice audio request failed:', err);
    res.status(502).json({ error: 'Voice audio failed.' });
  }
});

module.exports = router;