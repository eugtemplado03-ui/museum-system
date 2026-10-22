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

  it('POST /api/tts/speak explains missing multilingual TTS configuration', async () => {
    const envKeys = [
      'FISH_AUDIO_API_KEY',
      'FISH_AUDIO_VOICE_ID',
      'FISH_AUDIO_REFERENCE_ID',
      'FISH_AUDIO_VOICE_ID_HIL'
    ];
    const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    envKeys.forEach(key => { process.env[key] = ''; });
    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({
          text: 'Maayong pag-abot sa Museo Sang Bata sa Negros.',
          lang: 'hil'
        });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('MULTILINGUAL_TTS_NOT_CONFIGURED');
      expect(res.body.language).toBe('hil');
      expect(res.body.error).toContain('FISH_AUDIO_VOICE_ID_HIL');
    } finally {
      envKeys.forEach(key => {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      });
    }
  }, 15000);

  it.each([
    ['cb', 'Cebuano/Bisaya'],
    ['hil', 'Hiligaynon']
  ])('POST /api/tts/speak explains that %s narration needs Fish Audio setup', async (lang, languageName) => {
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const originalFetch = global.fetch;
    const envKeys = [
      'FISH_AUDIO_API_KEY',
      'FISH_AUDIO_VOICE_ID',
      'FISH_AUDIO_REFERENCE_ID',
      'FISH_AUDIO_VOICE_ID_CEB',
      'FISH_AUDIO_VOICE_ID_HIL'
    ];
    const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    global.fetch = jest.fn();
    envKeys.forEach(key => { process.env[key] = ''; });

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Language-specific voice test ${lang} ${Date.now()}`, lang });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('MULTILINGUAL_TTS_NOT_CONFIGURED');
      expect(res.body.language).toBe(lang);
      expect(res.body.error).toContain(languageName);
      expect(keySpy).not.toHaveBeenCalled();
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      envKeys.forEach(key => {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      });
      keySpy.mockRestore();
    }
  });

  it.each([
    ['tl', 'FISH_AUDIO_VOICE_ID_TL'],
    ['cb', 'FISH_AUDIO_VOICE_ID_CEB'],
    ['hil', 'FISH_AUDIO_VOICE_ID_HIL']
  ])('POST /api/tts/speak uses Fish Audio for %s with a language-specific voice', async (lang, voiceEnvName) => {
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const originalFetch = global.fetch;
    const envKeys = ['FISH_AUDIO_API_KEY', 'FISH_AUDIO_MODEL', voiceEnvName];
    const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    process.env.FISH_AUDIO_API_KEY = 'test-fish-key';
    process.env.FISH_AUDIO_MODEL = 's2.1-pro-free';
    process.env[voiceEnvName] = `test-voice-${lang}`;
    global.fetch = jest.fn(async () => new Response(Buffer.from('test-fish-audio'), {
      status: 200,
      headers: { 'Content-Type': 'audio/mpeg' }
    }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Fish voice test ${lang} ${Date.now()}`, lang });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('fish-audio');
      expect(res.headers['content-type']).toContain('audio/mpeg');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toBe('https://api.fish.audio/v1/tts');
      expect(global.fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer test-fish-key');
      expect(global.fetch.mock.calls[0][1].headers.model).toBe('s2.1-pro-free');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
        text: expect.stringContaining('Fish voice test'),
        reference_id: `test-voice-${lang}`,
        language: { tl: 'tl', cb: 'ceb', hil: 'hil' }[lang],
        format: 'mp3'
      });
      expect(keySpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      envKeys.forEach(key => {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      });
      keySpy.mockRestore();
    }
  });

  it('POST /api/tts/speak does not substitute a different language when Fish Audio rejects a Cebuano voice', async () => {
    const originalFetch = global.fetch;
    const envKeys = ['FISH_AUDIO_API_KEY', 'FISH_AUDIO_VOICE_ID_CEB'];
    const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    process.env.FISH_AUDIO_API_KEY = 'test-fish-key';
    process.env.FISH_AUDIO_VOICE_ID_CEB = 'test-cebuano-voice';
    global.fetch = jest.fn(async () => new Response('unsupported test voice', { status: 400 }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Unsupported voice test ${Date.now()}`, lang: 'cb' });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('MULTILINGUAL_TTS_FAILED');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
      envKeys.forEach(key => {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      });
    }
  });

  it('POST /api/tts/speak routes Tagalog narration to a Tagalog speech locale', async () => {
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    const originalFetch = global.fetch;
    const fishEnvKeys = [
      'FISH_AUDIO_API_KEY',
      'FISH_AUDIO_VOICE_ID',
      'FISH_AUDIO_REFERENCE_ID',
      'FISH_AUDIO_VOICE_ID_TL'
    ];
    const savedFishEnv = Object.fromEntries(fishEnvKeys.map(key => [key, process.env[key]]));
    fishEnvKeys.forEach(key => { process.env[key] = ''; });
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
      fishEnvKeys.forEach(key => {
        if (savedFishEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedFishEnv[key];
      });
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
