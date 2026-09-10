const test = require('node:test');
const assert = require('node:assert');

test('AI Chatbot Strict Language Matching (Tagalog -> Tagalog only, English -> English only, Bisaya -> Bisaya only)', async (t) => {
  const baseUrl = 'http://localhost:3000';

  const testCases = [
    {
      name: 'English question answered ONLY in English',
      body: { message: 'How much are tickets & hours?', language: 'auto' },
      mustInclude: ['Entrance Fees', 'Admission', 'PHP'],
      mustNotInclude: ['Sa Tagalog:', 'Sa Bisaya:', 'Bayad sa Entrance', 'Halaga ng Entrance']
    },
    {
      name: 'English Staff Office question answered ONLY in English',
      body: { message: 'Where is the Staff Office located?', language: 'auto' },
      mustInclude: ['Staff Office', 'Level 1', 'under the stairs'],
      mustNotInclude: ['Sa Tagalog:', 'Sa Bisaya:', 'ilalim ng hagdang-bato', 'ilawom sa hagdang-hagdang']
    },
    {
      name: 'English Touch Pool question answered ONLY in English',
      body: { message: 'Tell me about the Touch Pool and starfish', language: 'auto' },
      mustInclude: ['Touch Pool', 'gently', 'starfish'],
      mustNotInclude: ['Sa Tagalog:', 'Sa Bisaya:']
    },
    {
      name: 'Tagalog Staff Office question answered ONLY in Tagalog',
      body: { message: 'Saan po matatagpuan ang staff office?', language: 'auto' },
      mustInclude: ['staff office', 'Level 1', 'ilalim ng hagdanan'],
      mustNotInclude: ['Sa Bisaya:', 'In English:', 'under the stairs:']
    },
    {
      name: 'Tagalog entrance fee inquiry answered ONLY in Tagalog',
      body: { message: 'Magkano po ang bayad sa ticket at entrance?', language: 'auto' },
      mustInclude: ['Halaga ng Entrance Ticket', '₱20.00', 'Mag-aaral'],
      mustNotInclude: ['Sa Bisaya:', 'In English:', 'Bayad sa Entrance & Tickets']
    },
    {
      name: 'Bisaya Staff Office question answered ONLY in Bisaya',
      body: { message: 'Asa dapit ang opisina sa staff?', language: 'auto' },
      mustInclude: ['Staff Office', 'Level 1', 'ilalom sa hagdanan'],
      mustNotInclude: ['Sa Tagalog:', 'In English:', 'ilalim ng hagdanan']
    },
    {
      name: 'Bisaya ticket inquiry answered ONLY in Bisaya',
      body: { message: 'Tagpila ang bayad sa ticket ug unsa oras abli?', language: 'auto' },
      mustInclude: ['Bayad sa Entrance', '₱20.00', 'Estudyante'],
      mustNotInclude: ['Sa Tagalog:', 'In English:', 'Halaga ng Entrance Ticket']
    },
    {
      name: 'Explicit Tagalog mode returns ONLY in Tagalog',
      body: { message: 'What exhibits are on Level 2?', language: 'tl' },
      mustInclude: ['Ikalawang Palapag', 'Level 2'],
      mustNotInclude: ['Sa Bisaya:', 'In English:']
    },
    {
      name: 'Explicit Bisaya mode returns ONLY in Bisaya',
      body: { message: 'What exhibits are on Level 2?', language: 'bis' },
      mustInclude: ['Ikaduhang Salog', 'Level 2'],
      mustNotInclude: ['Sa Tagalog:', 'In English:']
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

      if (tc.mustInclude) {
        for (const str of tc.mustInclude) {
          assert.ok(
            data.reply.toLowerCase().includes(str.toLowerCase()),
            `Expected reply to contain "${str}". Got:\n${data.reply}`
          );
        }
      }

      if (tc.mustNotInclude) {
        for (const str of tc.mustNotInclude) {
          assert.ok(
            !data.reply.includes(str),
            `Expected reply NOT to contain "${str}". Got:\n${data.reply}`
          );
        }
      }
    });
  }
});
