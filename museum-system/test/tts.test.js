require('dotenv').config();
const request = require('supertest');
const express = require('express');
const ttsRoutes = require('../routes/tts');

const app = express();
app.use(express.json());
app.use('/api/tts', ttsRoutes);

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

  it('POST /api/tts/speak generates valid MP3 audio stream', async () => {
    const res = await request(app)
      .post('/api/tts/speak')
      .send({
        text: 'Maayong pag-abot sa Museo Sang Bata sa Negros.',
        lang: 'hil'
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('audio/mpeg');
    expect(res.body.length).toBeGreaterThan(500);
  }, 15000);
});
