const express = require('express');

const router = express.Router();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'openai/gpt-4o-mini';

// Translation endpoint
router.post('/translate', async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'Translation service not configured. Set OPENROUTER_API_KEY in .env.' });
  }

  const { text, targetLang } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }
  if (!targetLang) {
    return res.status(400).json({ error: 'Target language is required.' });
  }

  const langNames = {
    tl: 'Tagalog (Filipino)',
    cb: 'Cebuano (Bisaya)',
    en: 'English'
  };
  const langName = langNames[targetLang] || targetLang;

  const systemPrompt = `You are a precise translator. Translate the given text to ${langName}. Preserve the exact meaning, tone, and formatting. Do not add explanations, notes, or extra text. Return only the translation.`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + OPENROUTER_API_KEY,
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.SITE_NAME || 'Museo Sang Bata sa Negros'
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: 500,
        temperature: 0.1,
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

// TTS endpoint (returns MP3 audio)
router.post('/speak', async (req, res) => {
  if (!OPENROUTER_API_KEY) {
    return res.status(503).json({ error: 'TTS service not configured. Set OPENROUTER_API_KEY in .env.' });
  }

  const { text, voice = 'nova' } = req.body || {};
  if (!text || typeof text !== 'string' || !text.trim()) {
    return res.status(400).json({ error: 'Text is required.' });
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/audio/speech', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        Authorization: 'Bearer ' + OPENROUTER_API_KEY,
        'HTTP-Referer': process.env.SITE_URL || 'http://localhost:3000',
        'X-Title': process.env.SITE_NAME || 'Museo Sang Bata sa Negros'
      },
      body: JSON.stringify({
        model: 'tts-1-hd',
        input: text,
        voice: voice,
        response_format: 'mp3'
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('OpenRouter TTS error:', response.status, errBody);
      return res.status(502).json({ error: 'TTS service error.' });
    }

    const audioBuffer = await response.arrayBuffer();
    res.set('Content-Type', 'audio/mpeg');
    res.set('Content-Length', audioBuffer.byteLength);
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    console.error('TTS request failed:', err);
    res.status(502).json({ error: 'TTS failed.' });
  }
});

module.exports = router;