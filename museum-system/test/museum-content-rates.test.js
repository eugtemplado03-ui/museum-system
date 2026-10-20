const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

test('visitor rates render as section headings with bulleted items', async () => {
  class Element {
    constructor(tagName = 'DIV') {
      this.children = [];
      this.dataset = { museumRates: 'entranceFees' };
      this.hidden = false;
      this.textContent = '';
      this.tagName = tagName;
      this.className = '';
    }

    replaceChildren() {
      this.children = [];
    }

    appendChild(child) {
      this.children.push(child);
      return child;
    }

    get childElementCount() {
      return this.children.length;
    }
  }

  const ratesContainer = new Element();
  const document = {
    title: 'Contact — Museo Sang Bata sa Negros',
    createElement: tagName => new Element(tagName.toUpperCase()),
    querySelectorAll(selector) {
      if (selector === '[data-museum-rates]') return [ratesContainer];
      return [];
    }
  };
  const museumInfo = {
    entranceFees: [
      'Regular Tour:',
      'Students w/ ID — ₱20.00',
      'Adults — ₱50.00',
      'Special Tour with Jr. Guides & Kassie Kasag:',
      '1 Person — ₱800.00 / person',
      'Special guided tour (with Jr. Guides): PHP 800/person (1 pax), PHP 450/person (2 pax), PHP 300/person (3–4 pax), PHP 200/person (5–7 pax), PHP 150/person (8–9 pax), PHP 130/person (10+ pax)'
    ]
  };
  const source = fs.readFileSync(path.join(__dirname, '../public/js/museum-content.js'), 'utf8');

  vm.runInNewContext(source, {
    document,
    fetch: async () => ({ ok: true, json: async () => ({ museumInfo }) }),
    console
  });
  await new Promise(resolve => setImmediate(resolve));

  assert.equal(ratesContainer.hidden, false);
  assert.deepEqual(
    ratesContainer.children.map(child => [child.tagName, child.className, child.textContent]),
    [
      ['H3', 'rates-subtitle', 'Regular Tour'],
      ['UL', 'rates-list', ''],
      ['H3', 'rates-subtitle', 'Special Tour with Jr. Guides & Kassie Kasag'],
      ['UL', 'rates-list', ''],
      ['H3', 'rates-subtitle', 'Special guided tour (with Jr. Guides)'],
      ['UL', 'rates-list', '']
    ]
  );
  assert.deepEqual(
    ratesContainer.children[1].children.map(item => item.textContent),
    ['Students w/ ID — ₱20.00', 'Adults — ₱50.00']
  );
  assert.deepEqual(
    ratesContainer.children[3].children.map(item => item.textContent),
    ['1 Person — ₱800.00 / person']
  );
  assert.deepEqual(
    ratesContainer.children[5].children.map(item => item.textContent),
    [
      'PHP 800/person (1 pax)',
      'PHP 450/person (2 pax)',
      'PHP 300/person (3–4 pax)',
      'PHP 200/person (5–7 pax)',
      'PHP 150/person (8–9 pax)',
      'PHP 130/person (10+ pax)'
    ]
  );
});
