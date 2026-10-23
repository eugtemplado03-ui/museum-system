require('dotenv').config();
const request = require('supertest');
const express = require('express');
const chatApiKey = require('../db/chat-api-key');
const apiUsage = require('../db/api-usage');
const exhibits = require('../db/exhibits');
const programs = require('../db/programs');
const events = require('../db/events');
const museumInfo = require('../db/museum-info');
const ttsRoutes = require('../routes/tts');
const chatRoutes = require('../routes/chat');

const app = express();
app.use(express.json());
app.use('/api/tts', ttsRoutes);
app.use('/api/chat', chatRoutes);

function mockMuseumContext() {
  jest.spyOn(museumInfo, 'getInfo').mockResolvedValue({
    name: 'Test Museum',
    address: 'Test address',
    phone: '555-0100',
    entranceFees: []
  });
  jest.spyOn(exhibits, 'all').mockResolvedValue([]);
  jest.spyOn(programs, 'all').mockResolvedValue([]);
  jest.spyOn(events, 'all').mockResolvedValue([]);
}

function makeWavBuffer(payload) {
  const wav = Buffer.alloc(44 + payload.length + (payload.length % 2));
  wav.write('RIFF', 0, 4, 'ascii');
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write('WAVE', 8, 4, 'ascii');
  wav.write('fmt ', 12, 4, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 4, 'ascii');
  wav.writeUInt32LE(payload.length, 40);
  payload.copy(wav, 44);
  return wav;
}

function makeStreamingWavBuffer(payload) {
  // Simulates Groq/Lavf streaming output: 0xFFFFFFFF for RIFF and data chunk size
  const wav = Buffer.alloc(44 + payload.length);
  wav.write('RIFF', 0, 4, 'ascii');
  wav.writeUInt32LE(0xFFFFFFFF, 4);
  wav.write('WAVE', 8, 4, 'ascii');
  wav.write('fmt ', 12, 4, 'ascii');
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(1, 22);
  wav.writeUInt32LE(24000, 24);
  wav.writeUInt32LE(48000, 28);
  wav.writeUInt16LE(2, 32);
  wav.writeUInt16LE(16, 34);
  wav.write('data', 36, 4, 'ascii');
  wav.writeUInt32LE(0xFFFFFFFF, 40);
  payload.copy(wav, 44);
  return wav;
}

function getWavData(wav) {
  let offset = 12;
  while (offset + 8 <= wav.length) {
    const chunkId = wav.toString('ascii', offset, offset + 4);
    const chunkSize = wav.readUInt32LE(offset + 4);
    if (chunkId === 'data') return wav.subarray(offset + 8, offset + 8 + chunkSize);
    offset += 8 + chunkSize + (chunkSize % 2);
  }
  return Buffer.alloc(0);
}

describe('Groq chat, translation, and speech API', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('GET /api/tts/status reports Groq-only providers and supported speech languages', async () => {
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const res = await request(app).get('/api/tts/status');

    expect(res.status).toBe(200);
    expect(res.body.translationConfigured).toBe(true);
    expect(res.body.groqTtsConfigured).toBe(true);
    expect(res.body.groqTtsLanguages).toEqual(['en', 'ar']);
    expect(res.body.speechProviders).toMatchObject({
      en: 'groq-orpheus',
      ar: 'groq-orpheus-arabic',
      tl: 'unsupported-by-groq',
      cb: 'unsupported-by-groq',
      hil: 'unsupported-by-groq'
    });
    expect(res.body).not.toHaveProperty('openRouterTtsConfigured');
    expect(keySpy).toHaveBeenCalledTimes(1);
  });

  it.each(['tl', 'cb', 'hil'])('POST /api/tts/speak reports Groq %s speech as unsupported without another provider', async lang => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn();
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration');

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Unsupported Groq voice ${lang} ${Date.now()}`, lang });

      expect(res.status).toBe(501);
      expect(res.body.code).toBe('GROQ_TTS_LANGUAGE_UNSUPPORTED');
      expect(res.body.error).toContain('English and Saudi Arabic only');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(keySpy).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/tts/speak sends English speech to Groq and combines WAV chunks', async () => {
    const originalFetch = global.fetch;
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    const envKeys = ['GROQ_TTS_VOICE'];
    const savedEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));
    process.env.GROQ_TTS_VOICE = 'autumn';
    const responsePayloads = [Buffer.from([1, 2]), Buffer.from([3, 4]), Buffer.from([5, 6])];
    let responseIndex = 0;
    global.fetch = jest.fn(async () => new Response(
      makeWavBuffer(responsePayloads[responseIndex++]),
      { status: 200, headers: { 'Content-Type': 'audio/wav' } }
    ));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: 'A'.repeat(451), lang: 'en' });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('groq-orpheus');
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(res.body.subarray(0, 4).toString()).toBe('RIFF');
      expect(getWavData(res.body)).toEqual(Buffer.concat(responsePayloads));
      expect(global.fetch).toHaveBeenCalledTimes(3);
      for (const [url, options] of global.fetch.mock.calls) {
        expect(url).toBe('https://api.groq.com/openai/v1/audio/speech');
        expect(options.headers.Authorization).toBe('Bearer test-groq-key');
        const body = JSON.parse(options.body);
        expect(body).toMatchObject({
          model: 'canopylabs/orpheus-v1-english',
          voice: 'autumn',
          response_format: 'wav'
        });
        expect(body.input.length).toBeLessThanOrEqual(200);
      }
      expect(usageSpy).toHaveBeenCalledTimes(3);
      expect(keySpy).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
      envKeys.forEach(key => {
        if (savedEnv[key] === undefined) delete process.env[key];
        else process.env[key] = savedEnv[key];
      });
    }
  });

  it('POST /api/tts/speak handles Groq streaming WAV chunks with 0xFFFFFFFF data lengths', async () => {
    const originalFetch = global.fetch;
    jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    const payloads = [Buffer.from([10, 20]), Buffer.from([30, 40])];
    let idx = 0;
    global.fetch = jest.fn(async () => new Response(
      makeStreamingWavBuffer(payloads[idx++]),
      { status: 200, headers: { 'Content-Type': 'audio/wav' } }
    ));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: 'A'.repeat(250), lang: 'en' });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('groq-orpheus');
      expect(res.headers['content-type']).toContain('audio/wav');
      expect(res.body.subarray(0, 4).toString()).toBe('RIFF');
      expect(getWavData(res.body)).toEqual(Buffer.concat(payloads));
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/tts/speak uses Groq Saudi Arabic Orpheus for Arabic', async () => {
    const originalFetch = global.fetch;
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    global.fetch = jest.fn(async () => new Response(makeWavBuffer(Buffer.from([1, 2])), {
      status: 200,
      headers: { 'Content-Type': 'audio/wav' }
    }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Arabic voice test ${Date.now()}`, lang: 'ar-SA' });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('groq-orpheus-arabic');
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toMatchObject({
        model: 'canopylabs/orpheus-arabic-saudi',
        voice: 'aisha',
        response_format: 'wav'
      });
      expect(keySpy).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/tts/speak returns a configuration error when Groq is missing', async () => {
    const originalFetch = global.fetch;
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: '' });
    global.fetch = jest.fn();

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Missing Groq key ${Date.now()}`, lang: 'en' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('GROQ_TTS_NOT_CONFIGURED');
      expect(global.fetch).not.toHaveBeenCalled();
      expect(keySpy).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/tts/speak does not fall back to another provider after a Groq failure', async () => {
    const originalFetch = global.fetch;
    jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    global.fetch = jest.fn(async () => new Response('provider failure', { status: 401 }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Groq failure ${Date.now()}`, lang: 'en' });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('GROQ_TTS_FAILED');
      expect(res.body.error).toContain('Groq rejected the configured API key');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(global.fetch.mock.calls[0][0]).toContain('api.groq.com');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/tts/speak retries once after a short Groq rate limit', async () => {
    const originalFetch = global.fetch;
    jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response('rate limited', {
        status: 429,
        headers: { 'retry-after': '0' }
      }))
      .mockResolvedValueOnce(new Response(makeWavBuffer(Buffer.from([1, 2])), {
        status: 200,
        headers: { 'Content-Type': 'audio/wav' }
      }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Short Groq rate limit ${Date.now()}`, lang: 'en' });

      expect(res.status).toBe(200);
      expect(res.headers['x-tts-provider']).toBe('groq-orpheus');
      expect(global.fetch).toHaveBeenCalledTimes(2);
      expect(usageSpy).toHaveBeenCalledTimes(2);
      expect(usageSpy.mock.calls[0][0].response.status).toBe(429);
      expect(usageSpy.mock.calls[1][0].response.status).toBe(200);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/tts/speak returns a helpful 429 when Groq rate limit needs a longer wait', async () => {
    const originalFetch = global.fetch;
    jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    global.fetch = jest.fn(async () => new Response('rate limited', {
      status: 429,
      headers: { 'retry-after': '45' }
    }));

    try {
      const res = await request(app)
        .post('/api/tts/speak')
        .send({ text: `Long Groq rate limit ${Date.now()}`, lang: 'en' });

      expect(res.status).toBe(429);
      expect(res.headers['retry-after']).toBe('45');
      expect(res.body.code).toBe('GROQ_TTS_RATE_LIMITED');
      expect(res.body.retryAfterSeconds).toBe(45);
      expect(res.body.error).toContain('wait at least 45 seconds');
      expect(res.body.error).toContain('audio limits');
      expect(global.fetch).toHaveBeenCalledTimes(1);
      expect(usageSpy).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it.each([
    ['tl', 'Filipino (Tagalog)'],
    ['cb', 'Cebuano (Bisaya)'],
    ['hil', 'Hiligaynon (Ilonggo)']
  ])('POST /api/tts/translate uses Groq for %s translations', async (targetLang, languageName) => {
    const originalFetch = global.fetch;
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    const translatedText = `Groq translation ${targetLang}`;
    const inputText = `Translate with Groq ${targetLang} ${Date.now()}`;
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: translatedText } }],
      usage: { prompt_tokens: 3, completion_tokens: 4 }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    try {
      const res = await request(app)
        .post('/api/tts/translate')
        .send({ text: inputText, targetLang });

      expect(res.status).toBe(200);
      expect(res.body.translatedText).toBe(translatedText);
      expect(global.fetch).toHaveBeenCalledTimes(1);
      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(options.headers.Authorization).toBe('Bearer test-groq-key');
      expect(JSON.parse(options.body)).toMatchObject({
        model: 'openai/gpt-oss-120b',
        messages: expect.arrayContaining([
          { role: 'system', content: expect.stringContaining(languageName) },
          { role: 'user', content: inputText }
        ]),
        stream: false
      });
      expect(usageSpy).toHaveBeenCalledTimes(1);
      expect(keySpy).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/chat calls Groq for museum answers', async () => {
    const originalFetch = global.fetch;
    const keySpy = jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    const usageSpy = jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    mockMuseumContext();
    global.fetch = jest.fn(async () => new Response(JSON.stringify({
      choices: [{ message: { content: 'Groq museum answer' } }],
      usage: { prompt_tokens: 5, completion_tokens: 6 }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    }));

    try {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: `Museum question ${Date.now()}`, language: 'en' });

      expect(res.status).toBe(200);
      expect(res.body.reply).toBe('Groq museum answer');
      const [url, options] = global.fetch.mock.calls[0];
      expect(url).toBe('https://api.groq.com/openai/v1/chat/completions');
      expect(options.headers.Authorization).toBe('Bearer test-groq-key');
      expect(JSON.parse(options.body).model).toBe('openai/gpt-oss-120b');
      expect(usageSpy).toHaveBeenCalledTimes(1);
      expect(keySpy).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/chat returns an error instead of a local answer when Groq is not configured', async () => {
    const originalFetch = global.fetch;
    jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: '' });
    global.fetch = jest.fn();

    try {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: `Missing Groq chatbot key ${Date.now()}`, language: 'en' });

      expect(res.status).toBe(503);
      expect(res.body.code).toBe('GROQ_CHAT_NOT_CONFIGURED');
      expect(global.fetch).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('POST /api/chat returns an error instead of a local answer when Groq fails', async () => {
    const originalFetch = global.fetch;
    jest.spyOn(chatApiKey, 'getGroqConfiguration')
      .mockResolvedValue({ apiKey: 'test-groq-key' });
    jest.spyOn(apiUsage, 'recordGroqUsageSafely').mockResolvedValue();
    mockMuseumContext();
    global.fetch = jest.fn(async () => new Response('rate limited', { status: 429 }));

    try {
      const res = await request(app)
        .post('/api/chat')
        .send({ message: `Groq chatbot failure ${Date.now()}`, language: 'en' });

      expect(res.status).toBe(502);
      expect(res.body.code).toBe('GROQ_CHAT_FAILED');
      expect(global.fetch).toHaveBeenCalledTimes(1);
    } finally {
      global.fetch = originalFetch;
    }
  });
});
