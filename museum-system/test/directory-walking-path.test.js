const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function run() {
  console.log('--- Testing Directory Click: Direct to Walking Path (No Drawer) ---');
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-dir-test-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9267',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get('http://localhost:9267/json/list', res => {
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
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });

  await send('Runtime.evaluate', {
    expression: `
      sessionStorage.setItem('museum_visitor_checked_in', 'true');
      localStorage.setItem('museum_visitor_checked_in', 'true');
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/map.html' });
  await new Promise(r => setTimeout(r, 2500));

  // Test 1: Click "Under the Sea" (EX-001) in directory
  console.log('Clicking "Under the Sea" (EX-001) in the directory...');
  const clickRes1 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const item = document.querySelector('.cat-exhibit-item[data-code="EX-001"]');
        if (!item) return { found: false };
        item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        const drawer = document.getElementById('exhibitDrawer');
        const dirPanel = document.getElementById('directionsPanel');
        const destName = document.getElementById('dirDestName');
        const routePath = document.querySelector('#routeLayer .walking-route-path');
        const steps = document.querySelectorAll('#dirStepsList .dir-step-item');
        return {
          found: true,
          drawerOpen: drawer ? drawer.classList.contains('open') : false,
          directionsPanelActive: dirPanel ? dirPanel.classList.contains('active') : false,
          destText: destName ? destName.textContent : null,
          hasRoutePath: !!routePath,
          stepCount: steps.length
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Result for Level 1 exhibit click (EX-001):', clickRes1.result.value);

  // Take screenshot of walking path view
  await new Promise(r => setTimeout(r, 500));
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const shot1Path = path.join('C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923', 'verified-dir-click-walking-path-l1.png');
  fs.writeFileSync(shot1Path, Buffer.from(shot1.data, 'base64'));
  console.log('Saved screenshot: verified-dir-click-walking-path-l1.png');

  // Test 2: Switch to Level 2 and click "Hampanganan (Toy Room)" (EX-006) as shown in user's screenshot
  console.log('Switching to Level 2 and clicking Hampanganan (EX-006) in the directory...');
  const clickRes2 = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btnL2 = document.getElementById('btnFloor2');
        if (btnL2) btnL2.click();
        const item = document.querySelector('.cat-exhibit-item[data-code="EX-006"]');
        if (!item) return { found: false };
        item.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        const drawer = document.getElementById('exhibitDrawer');
        const dirPanel = document.getElementById('directionsPanel');
        const destName = document.getElementById('dirDestName');
        const routePath = document.querySelector('#routeLayer .walking-route-path');
        const steps = document.querySelectorAll('#dirStepsList .dir-step-item');
        return {
          found: true,
          drawerOpen: drawer ? drawer.classList.contains('open') : false,
          directionsPanelActive: dirPanel ? dirPanel.classList.contains('active') : false,
          destText: destName ? destName.textContent : null,
          hasRoutePath: !!routePath,
          stepCount: steps.length
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Result for Level 2 exhibit click (EX-006):', clickRes2.result.value);

  await new Promise(r => setTimeout(r, 500));
  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const shot2Path = path.join('C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923', 'verified-dir-click-hampanganan-walking-path.png');
  fs.writeFileSync(shot2Path, Buffer.from(shot2.data, 'base64'));
  console.log('Saved screenshot: verified-dir-click-hampanganan-walking-path.png');

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
  console.log('--- Finished Directory Click Walking Path Test ---');
}

run().catch(err => {
  console.error('Test error:', err);
  process.exit(1);
});
