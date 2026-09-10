const test = require('node:test');
const assert = require('node:assert');

test('AI Chatbot Trilingual (Tagalog, Bisaya, English) Responses', async (t) => {
  const baseUrl = 'http://localhost:3000';

  const testCases = [
    {
      name: 'English question includes Tagalog and Bisaya sections',
      body: { message: 'How much are tickets & hours?', language: 'auto' },
      expectedHeadings: ['Sa Tagalog', 'Sa Bisaya']
    },
    {
      name: 'English Staff Office question includes Tagalog and Bisaya',
      body: { message: 'Where is the Staff Office located?', language: 'auto' },
      expectedHeadings: ['Sa Tagalog', 'Sa Bisaya']
    },
    {
      name: 'English Touch Pool question includes Tagalog and Bisaya',
      body: { message: 'Tell me about the Touch Pool and starfish', language: 'auto' },
      expectedHeadings: ['Sa Tagalog', 'Sa Bisaya']
    },
    {
      name: 'Tagalog inquiry is answered with Tagalog first, plus Bisaya & English',
      body: { message: 'Saan po matatagpuan ang staff office?', language: 'auto' },
      expectedHeadings: ['Sa Bisaya', 'In English']
    },
    {
      name: 'Tagalog entrance fee inquiry answered with Tagalog, Bisaya, English',
      body: { message: 'Magkano po ang bayad sa ticket at entrance?', language: 'auto' },
      expectedHeadings: ['Sa Bisaya', 'In English']
    },
    {
      name: 'Bisaya inquiry answered with Bisaya first, plus Tagalog & English',
      body: { message: 'Asa dapit ang opisina sa staff?', language: 'auto' },
      expectedHeadings: ['Sa Tagalog', 'In English']
    },
    {
      name: 'Bisaya ticket inquiry answered with Bisaya, Tagalog, English',
      body: { message: 'Tagpila ang bayad sa ticket ug unsa oras abli?', language: 'auto' },
      expectedHeadings: ['Sa Tagalog', 'In English']
    },
    {
      name: 'Explicit Tagalog mode returns Tagalog first plus Bisaya and English',
      body: { message: 'What exhibits are on Level 2?', language: 'tl' },
      expectedHeadings: ['Sa Bisaya', 'In English']
    },
    {
      name: 'Explicit Bisaya mode returns Bisaya first plus Tagalog and English',
      body: { message: 'What exhibits are on Level 2?', language: 'bis' },
      expectedHeadings: ['Sa Tagalog', 'In English']
    }
  ];

  for (const tc of testCases) {
    await t.test(tc.name, async () => {
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tc.body)
      });
      assert.strictEqual(res.status, 200, 'Chat endpoint returned 200 OK');
      const data = await res.json();
      assert.ok(data.reply, 'Response contains reply text');
      for (const h of tc.expectedHeadings) {
        assert.ok(
          data.reply.includes(h),
          `Expected response to contain "${h}". Response:\n${data.reply}`
        );
      }
    });
  }
});
