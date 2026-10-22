require('dotenv').config();
const request = require('supertest');
const express = require('express');
const chatApiKey = require('../db/chat-api-key');
const apiUsage = require('../db/api-usage');
const ttsRoutes = require('../routes/tts');

const app = express();
app.use(express.json());
app.use('/api/tts', ttsRoutes);

// These checks hit the translation layer directly without depending on a live external service.
describe('TTS and Translation API', () => {
  it('GET /api/tts/status returns system configuration', async () => {
    const res = await request(app).get('/api/tts/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('translationConfigured');
    expect(res.body).toHaveProperty('fishAudioConfigured');
    expect(res.body).toHaveProperty('fishAudioModel');
  });

  it('POST /api/tts/translate translates English to Hiligaynon accurately', async () => {
    const res = await request(app)
      .post('/api/tts/translate')
      .send({
        text: 'Welcome to the museum! Discover marine life and colorful learning exhibits.',
        targetLang: 'hil'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('translatedText');
    const text = res.body.translatedText;
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(10);
    // Strict accuracy checks: Must NOT use Tagalog "Mabuhay" or "makulay"
    expect(text.toLowerCase()).not.toContain('mabuhay');
    expect(text.toLowerCase()).not.toContain('makulay');
  }, 15000);

  it('POST /api/tts/translate translates English to Cebuano accurately', async () => {
    const res = await request(app)
      .post('/api/tts/translate')
      .send({
        text: 'Welcome to the museum! Discover marine life and colorful learning exhibits.',
        targetLang: 'cb'
      });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('translatedText');
    const text = res.body.translatedText;
    expect(typeof text).toBe('string');
    expect(text.length).toBeGreaterThan(10);
    expect(text.toLowerCase()).not.toContain('mabuhay');
  }, 15000);

  it('POST /api/tts/speak reports that unsupported local-language voices need a device voice', async () => {
    const res = await request(app)
      .post('/api/tts/speak')
      .send({
        text: 'Maayong pag-abot sa Museo Sang Bata sa Negros.',
        lang: 'hil'
      });

    expect(res.status).toBe(503);
    expect(res.body.code).toBe('DEVICE_VOICE_REQUIRED');
    expect(res.body.language).toBe('hil');
  }, 15000);

  it.each([
    ['cb', 'Cebuano/Bisaya'],
    ['hil', 'Hiligaynon']
  ])('POST /api/tts/speak asks for a device %s voice instead of mispronouncing it', async (lang, languageName) => {
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const originalFetch = global.fetch;
    global.fetch = jest.fn();

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Language-specific voice test ${lang} ${Date.now()}`, lang });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('DEVICE_VOICE_REQUIRED');
      expect(res.body.language).toBe(lang);
      expect(res.body.error).toContain(languageName);
      expect(keySpy).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      keySpy.mockRestore();
    }
  });

  it('POST /api/tts/speak routes Tagalog narration to a Tagalog speech locale', async () => {
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response(Buffer.from('test-audio'), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' }
    }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Tagalog voice test ${Date.now()}`, lang: 'tl' });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('google-tts');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toContain('tl=tl');
      expect(global.fetch.mock.calls[0][0]).toContain('translate.google.com/translate_tts');
      expect(keySpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      keySpy.mockRestore();
      usageSpy.mockRestore();
    }
  });

  it('POST /api/tts/speak uses Groq Orpheus for English narration', async () => {
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => new Response(Buffer.from('test-wav-audio'), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav' }
    }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `English voice test ${Date.now()}`, lang: 'en' });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('groq-orpheus');
      expect(global.fetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/audio/speech');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body).model).toBe('canopylabs/orpheus-v1-english');
    } finally {
      global.fetch = originalFetch;
      keySpy.mockRestore();
      usageSpy.mockRestore();
    }
  });
});
