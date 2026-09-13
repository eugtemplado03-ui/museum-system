const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function verifySidebarAdminDedup() {
  console.log('=== Verifying Sidebar Admin Card Deduplication ===');
  const userDataDir = path.join(os.tmpdir(), 'chrome-verify-sidebar-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const port = 9299;

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=430,932', // Mobile viewport like user screenshot
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/json/list`, res => {
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

  const send = (m, p = {}) => new Promise((resolve) => {
    const curId = id++;
    callbacks.set(curId, resolve);
    ws.send(JSON.stringify({ id: curId, method: m, params: p }));
  });

  await send('Page.enable');
  await send('Runtime.enable');

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res && res.result ? res.result.value : null;
  };

  const captureScreenshot = async (filepath) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot to ${filepath}`);
  };

  // 1. Set admin token and visitor session on origin
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1000));
  await evaluate(`
    localStorage.setItem('museum_visitor_checked_in', 'true');
    localStorage.setItem('museum_visitor_date', new Date().toISOString().slice(0, 10));
    localStorage.setItem('museum_admin_token', 'mock_admin_token');
    sessionStorage.setItem('museum_admin_token', 'mock_admin_token');
  `);

  // Navigate to /map.html (or dashboard) as in user screenshot
  console.log('Navigating to map.html with admin in public view mode...');
  await send('Page.navigate', { url: 'http://localhost:3000/map.html' });
  await new Promise(r => setTimeout(r, 2000));

  // Open sidebar
  console.log('Opening sidebar...');
  await evaluate(`
    document.getElementById('sidebarToggleBtn').click();
  `);
  await new Promise(r => setTimeout(r, 800));

  const check1 = await evaluate(`(() => {
    const cards = document.querySelectorAll('.sidebar-admin-active-card, [data-admin-card]');
    const footerLinks = document.querySelectorAll('.admin-return-sublink');
    const texts = Array.from(cards).map(c => c.innerText.replace(/\\s+/g, ' ').trim());
    return {
      adminCardCount: cards.length,
      cardTexts: texts,
      footerLinkCount: footerLinks.length
    };
  })()`);
  console.log('Sidebar Check after 1st open:', check1);

  // Take screenshot of fixed sidebar
  await captureScreenshot(path.join(artifactDir, 'verified-fixed-sidebar-admin-card.png'));

  // Toggle close then open again 3 times to test resilience
  console.log('Toggling sidebar multiple times...');
  for (let i = 0; i < 3; i++) {
    await evaluate(`window.MuseoSidebar.close();`);
    await new Promise(r => setTimeout(r, 200));
    await evaluate(`window.MuseoSidebar.open();`);
    await new Promise(r => setTimeout(r, 200));
  }

  const checkMulti = await evaluate(`(() => {
    const cards = document.querySelectorAll('.sidebar-admin-active-card, [data-admin-card]');
    const footerLinks = document.querySelectorAll('.admin-return-sublink');
    return {
      adminCardCount: cards.length,
      footerLinkCount: footerLinks.length
    };
  })()`);
  console.log('Sidebar Check after multiple toggles:', checkMulti);

  ws.close();
  chrome.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  const passed = check1.adminCardCount === 1 && checkMulti.adminCardCount === 1 && check1.footerLinkCount === 1;
  console.log('\n=== RESULT ===');
  console.log(passed ? 'SUCCESS: Exactly ONE Staff Admin card rendered (no duplicates)!' : 'FAILED: Duplicates still detected');
  process.exit(passed ? 0 : 1);
}

verifySidebarAdminDedup().catch(err => {
  console.error(err);
  process.exit(1);
});
