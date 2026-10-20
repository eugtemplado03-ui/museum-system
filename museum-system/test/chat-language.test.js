const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const exhibits = require('../db/exhibits');
const events = require('../db/events');
const museumInfo = require('../db/museum-info');
const programs = require('../db/programs');
const chatRoutes = require('../routes/chat');

test('offline exhibit answers use the requested language description', async () => {
  const originalApiKey = process.env.GROQ_API_KEY;
  const originalFetch = global.fetch;
  const originalGetInfo = museumInfo.getInfo;
  const originalExhibitsAll = exhibits.all;
  const originalProgramsAll = programs.all;
  const originalEventsAll = events.all;
  process.env.GROQ_API_KEY = '';
  museumInfo.getInfo = async () => ({
    name: 'Museo Sang Bata sa Negros',
    address: 'Barangay Old Sagay',
    phone: '+63 900 000 0000',
    entranceFees: []
  });
  const exhibitRecord = {
    title: 'Story of Plastic',
    code: 'EX-008',
    category: 'Environmental',
    floor: 1,
    location: 'Main Marine Gallery',
    description: 'This exhibit explains plastic pollution and its effects on marine life.',
    description_tl: 'Ipinapaliwanag ng eksibit na ito ang polusyon mula sa plastik at epekto nito sa yamang-dagat.',
    description_cb: 'Gipasabot sa pasundayag ang polusyon sa plastik ug ang epekto niini sa kinabuhi sa dagat.'
  };
  exhibits.all = async () => [exhibitRecord];
  programs.all = async () => [];
  events.all = async () => [];

  try {
    const app = express();
    app.use(express.json());
    app.use('/api/chat', chatRoutes);

    const bisayaResponse = await request(app)
      .post('/api/chat')
      .send({ message: 'Unsa ang Story of Plastic?', language: 'auto' });
    assert.equal(bisayaResponse.status, 200);
    assert.ok(bisayaResponse.body.reply.includes('Gipasabot sa pasundayag ang polusyon sa plastik'));
    assert.ok(!bisayaResponse.body.reply.includes('This exhibit explains plastic pollution'));

    exhibitRecord.description_cb = '';
    const missingBisayaTranslation = await request(app)
      .post('/api/chat')
      .send({ message: 'Unsa ang Story of Plastic?', language: 'auto' });
    assert.equal(missingBisayaTranslation.status, 200);
    assert.ok(missingBisayaTranslation.body.reply.includes('Wala pay gihubad nga deskripsyon'));
    assert.ok(!missingBisayaTranslation.body.reply.includes('This exhibit explains plastic pollution'));
    exhibitRecord.description_cb = 'Gipasabot sa pasundayag ang polusyon sa plastik ug ang epekto niini sa kinabuhi sa dagat.';

    const tagalogResponse = await request(app)
      .post('/api/chat')
      .send({ message: 'Ano ang Story of Plastic?', language: 'auto' });
    assert.equal(tagalogResponse.status, 200);
    assert.ok(tagalogResponse.body.reply.includes('Ipinapaliwanag ng eksibit na ito'));
    assert.ok(!tagalogResponse.body.reply.includes('This exhibit explains plastic pollution'));

    let groqRequest;
    process.env.GROQ_API_KEY = 'test-key';
    global.fetch = async (url, options) => {
      groqRequest = { url, body: JSON.parse(options.body) };
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: 'Ang deskripsyon gipahayag sa Bisaya.' } }],
          usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 }
        })
      };
    };
    const aiResponse = await request(app)
      .post('/api/chat')
      .send({ message: 'Unsa ang Story of Plastic?', language: 'auto' });
    assert.equal(aiResponse.status, 200);
    assert.equal(aiResponse.body.reply, 'Ang deskripsyon gipahayag sa Bisaya.');
    assert.equal(groqRequest.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.match(groqRequest.body.messages[0].content, /Translate descriptive source data into Bisaya \/ Cebuano \/ Hiligaynon/i);
    assert.match(groqRequest.body.messages[0].content, /Never copy an English description/i);
    assert.match(groqRequest.body.messages[0].content, /REQUIRED OUTPUT LANGUAGE: Bisaya \/ Cebuano \/ Hiligaynon/i);
    assert.match(groqRequest.body.messages[0].content, /Write every sentence of the answer in this language/i);
    assert.ok(groqRequest.body.messages[0].content.includes(exhibitRecord.description_cb));
    assert.ok(!groqRequest.body.messages[0].content.includes(exhibitRecord.description));

    const selectedBisayaResponse = await request(app)
      .post('/api/chat')
      .send({ message: 'What does Story of Plastic explain?', language: 'bis' });
    assert.equal(selectedBisayaResponse.status, 200);
    assert.match(groqRequest.body.messages[0].content, /REQUIRED OUTPUT LANGUAGE: Bisaya \/ Cebuano \/ Hiligaynon/i);
  } finally {
    if (originalApiKey === undefined) delete process.env.GROQ_API_KEY;
    else process.env.GROQ_API_KEY = originalApiKey;
    global.fetch = originalFetch;
    museumInfo.getInfo = originalGetInfo;
    exhibits.all = originalExhibitsAll;
    programs.all = originalProgramsAll;
    events.all = originalEventsAll;
  }
});
