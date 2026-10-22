require('dotenv').config();
const request = require('supertest');
const express = require('express');
const chatApiKey = require('../db/chat-api-key');
const apiUsage = require('../db/api-usage');
const ttsRoutes = require('../routes/tts');

const app = express();
app.use(express.json());
app.use('/api/tts', ttsRoutes);

describe('TTS and Translation API', () => {
  it('GET /api/tts/status returns system configuration', async () => {
    const res = await request(app).get('/api/tts/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('translationConfigured');
    expect(res.body).toHaveProperty('openRouterTtsConfigured');
    expect(res.body.openRouterTtsModel).toBe('openai/gpt-audio-mini');
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

  it.each([
    ['tl', 'Filipino (Tagalog)'],
    ['cb', 'Cebuano (Bisaya)'],
    ['hil', 'Hiligaynon (Ilonggo)']
  ])('POST /api/tts/speak uses OpenRouter audio for %s', async (lang, languageName) => {
    const originalFetch = global.fetch;
    const envKeys = ['OPENROUTER_API_KEY', 'OPENROUTER_TTS_MODEL', 'OPENROUTER_TTS_VOICE'];
    const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    process.env.OPENROUTER_TTS_MODEL = 'openai/gpt-audio-mini';
    process.env.OPENROUTER_TTS_VOICE = 'alloy';
    const expectedAudio = Buffer.from(`openrouter-audio-${lang}`);
    const firstChunk = expectedAudio.subarray(0, 8);
    const secondChunk = expectedAudio.subarray(8);
    const eventStream = [
      `data: ${JSON.stringify({ choices: [{ delta: { audio: { data: firstChunk.toString('base64') } } }] })}`,
      `data: ${JSON.stringify({ choices: [{ delta: { audio: { data: secondChunk.toString('base64') } } }] })}`,
      'data: [DONE]',
      ''
    ].join('\n');
    global.fetch = jest.fn(async () => new Response(eventStream, {
      status: 200,
      headers: { 'Content-Type': 'text/event-stream' }
    }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `OpenRouter voice test ${lang} ${Date.now()}`, lang });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('openrouter-audio');
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(res.body).toEqual(expectedAudio);
      expect(global.fetch).toHaveBeenCalledTimes(1);

      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
      expect(options.headers.Authorization).toBe('Bearer test-openrouter-key');
      expect(JSON.parse(options.body)).toMatchObject({
        model: 'openai/gpt-audio-mini',
        modalities: ['text', 'audio'],
        audio: { voice: 'alloy', format: 'wav' },
        messages: [
          { role: 'system', content: expect.stringContaining(languageName) },
          { role: 'user', content: expect.stringContaining('OpenRouter voice test') }
        ],
        stream: true
      });
    } finally {
      global.fetch = originalFetch;
      envKeys.forEach(key => {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      });
    }
  });

  it.each(['tl', 'cb', 'hil'])('POST /api/tts/speak explains missing OpenRouter configuration for %s', async lang => {
    const originalFetch = global.fetch;
    const savedKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = '';
    global.fetch = jest.fn();

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Missing OpenRouter key ${lang} ${Date.now()}`, lang });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('MULTILINGUAL_TTS_NOT_CONFIGURED');
      expect(res.body.language).toBe(lang);
      expect(res.body.error).toContain('OPENROUTER_API_KEY');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
      if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = savedKey;
    }
  });

  it('POST /api/tts/speak reports OpenRouter provider errors', async () => {
    const originalFetch = global.fetch;
    const savedKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    global.fetch = jest.fn(async () => new Response('provider failure', { status: 401 }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `OpenRouter failure ${Date.now()}`, lang: 'cb' });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('MULTILINGUAL_TTS_FAILED');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
      if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = savedKey;
    }
  });

  it('POST /api/tts/speak reports an empty OpenRouter audio stream', async () => {
    const originalFetch = global.fetch;
    const savedKey = process.env.OPENROUTER_API_KEY;
    process.env.OPENROUTER_API_KEY = 'test-openrouter-key';
    global.fetch = jest.fn(async () => new Response('data: [DONE]\n\n', { status: 200 }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Empty OpenRouter stream ${Date.now()}`, lang: 'hil' });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('MULTILINGUAL_TTS_FAILED');
    } finally {
      global.fetch = originalFetch;
      if (savedKey === undefined) delete process.env.OPENROUTER_API_KEY;
      else process.env.OPENROUTER_API_KEY = savedKey;
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
