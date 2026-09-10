const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testTagModal() {
  console.log('--- Testing Tag Modal Close Button & Removed Copy Link ---');
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-tagmodal-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9278',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'http://localhost:3000/admin.html'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get('http://localhost:9278/json/list', res => {
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(JSON.parse(d)));
    }).on('error', reject);
  });

  const page = list.find(item => item.type === 'page' && !item.url.startsWith('chrome-extension:'));
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.onopen = r);
  let id = 1;
  const callbacks = new Map();
  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    if (msg.id && callbacks.has(msg.id)) {
      callbacks.get(msg.id)(msg.result);
      callbacks.delete(msg.id);
    }
  };
  const send = (m, p = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    callbacks.set(curId, resolve);
    ws.send(JSON.stringify({ id: curId, method: m, params: p }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  // Log in as superadmin
  console.log('Logging in as superadmin...');
  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const res = await Api.login('superadmin', 'superadmin2026');
        Api.setToken(res.token);
      })()
    `,
    awaitPromise: true
  });

  // Reload admin dashboard
  await send('Page.navigate', { url: 'http://localhost:3000/admin.html' });
  await new Promise(r => setTimeout(r, 2500));

  // Switch to Exhibits Catalog tab to populate exhibitsCache and render table
  console.log('Switching to Exhibits Catalog section...');
  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        activeTab = 'catalog';
        await renderDashboard();
      })()
    `,
    awaitPromise: true
  });
  await new Promise(r => setTimeout(r, 2000));

  // Open Tag modal for EX-001
  console.log('Opening Tag modal for EX-001...');
  await send('Runtime.evaluate', {
    expression: `openTagModal('EX-001');`
  });
  await new Promise(r => setTimeout(r, 800));

  // Check state of modal
  const modalInspection = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const overlay = document.getElementById('modalOverlay');
        const copyBtn = document.getElementById('copyUrlBtn');
        const urlInput = document.getElementById('exhibitDirectUrl');
        const closeBtn = document.getElementById('closeTagModalBtn');
        const cornerCloseBtn = document.getElementById('closeTagModalCornerBtn');
        const downloadBtn = document.querySelector('a[download*="EX-001"]');
        const printBtn = document.getElementById('printTagBtn');

        return {
          overlayExists: !!overlay,
          copyBtnExists: !!copyBtn,
          urlInputExists: !!urlInput,
          closeBtnExists: !!closeBtn,
          cornerCloseBtnExists: !!cornerCloseBtn,
          downloadBtnExists: !!downloadBtn,
          printBtnExists: !!printBtn
        };
      })()
    `,
    returnByValue: true
  });

  console.log('Modal Inspection:', modalInspection.result.value);

  // Capture screenshot of updated modal without copy link section
  const snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-tag-modal-clean.png'), Buffer.from(snap.data, 'base64'));
  console.log('Saved verified-tag-modal-clean.png');

  // Now click the Close button
  console.log('Clicking the Close button...');
  await send('Runtime.evaluate', {
    expression: `document.getElementById('closeTagModalBtn').click();`
  });
  await new Promise(r => setTimeout(r, 500));

  const afterCloseCheck = await send('Runtime.evaluate', {
    expression: `!document.getElementById('modalOverlay') && !document.querySelector('.modal-overlay')`,
    returnByValue: true
  });
  console.log('Modal closed successfully after clicking Close button:', afterCloseCheck.result.value);

  // Re-open and test corner close button
  console.log('Re-opening modal to test corner close button (✕)...');
  await send('Runtime.evaluate', { expression: `openTagModal('EX-001');` });
  await new Promise(r => setTimeout(r, 500));
  await send('Runtime.evaluate', { expression: `document.getElementById('closeTagModalCornerBtn').click();` });
  await new Promise(r => setTimeout(r, 500));
  const afterCornerCheck = await send('Runtime.evaluate', {
    expression: `!document.getElementById('modalOverlay') && !document.querySelector('.modal-overlay')`,
    returnByValue: true
  });
  console.log('Modal closed successfully after clicking corner (✕) button:', afterCornerCheck.result.value);

  // Re-open and test Escape key
  console.log('Re-opening modal to test Escape key...');
  await send('Runtime.evaluate', { expression: `openTagModal('EX-001');` });
  await new Promise(r => setTimeout(r, 500));
  await send('Runtime.evaluate', {
    expression: `document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));`
  });
  await new Promise(r => setTimeout(r, 500));
  const afterEscCheck = await send('Runtime.evaluate', {
    expression: `!document.getElementById('modalOverlay') && !document.querySelector('.modal-overlay')`,
    returnByValue: true
  });
  console.log('Modal closed successfully with Escape key:', afterEscCheck.result.value);

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  if (
    modalInspection.result.value.overlayExists &&
    modalInspection.result.value.copyBtnExists === false &&
    modalInspection.result.value.urlInputExists === false &&
    afterCloseCheck.result.value === true &&
    afterCornerCheck.result.value === true &&
    afterEscCheck.result.value === true
  ) {
    console.log('--- ALL MODAL CLOSE & CLEANUP CHECKS PASSED! ---');
  } else {
    throw new Error('Test assertions failed');
  }
}

testTagModal().catch(err => {
  console.error(err);
  process.exit(1);
});
