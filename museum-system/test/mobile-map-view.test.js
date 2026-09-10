const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function run() {
  console.log('--- Testing Mobile Map View & Compact Layout ---');
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-mobile-map-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9271',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get('http://localhost:9271/json/list', res => {
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
  
  // Set Mobile Viewport (iPhone 14 / modern smartphone: 390 x 844)
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Runtime.evaluate', {
    expression: `
      sessionStorage.setItem('museum_visitor_checked_in', 'true');
      localStorage.setItem('museum_visitor_checked_in', 'true');
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/map.html' });
  await new Promise(r => setTimeout(r, 2500));

  // 1. Capture initial mobile view with compact header and map
  const headerMetrics = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const header = document.querySelector('.map-header');
        const switchers = document.querySelector('.switchers-group');
        const toolbar = document.querySelector('.map-toolbar-row');
        return {
          headerHeight: header ? header.offsetHeight : 0,
          switchersScrollable: switchers ? switchers.scrollWidth > switchers.clientWidth : false,
          toolbarHeight: toolbar ? toolbar.offsetHeight : 0
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Mobile header metrics:', headerMetrics.result.value);

  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-mobile-map-compact-header.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved verified-mobile-map-compact-header.png');

  // 2. Trigger walking directions to Franco's Reading Corner (cat_reading_learning)
  await send('Runtime.evaluate', {
    expression: `
      window.renderRoute('cat_reading_learning');
    `
  });
  await new Promise(r => setTimeout(r, 1200));

  const dirMetrics = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const panel = document.getElementById('directionsPanel');
        const rect = panel ? panel.getBoundingClientRect() : null;
        return {
          active: panel ? panel.classList.contains('active') : false,
          height: rect ? rect.height : 0,
          destName: document.getElementById('dirDestName') ? document.getElementById('dirDestName').innerText : ''
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Directions expanded metrics:', dirMetrics.result.value);

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-mobile-map-directions-expanded.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved verified-mobile-map-directions-expanded.png');

  // 3. Click collapse button to minimize directions
  await send('Runtime.evaluate', {
    expression: `
      document.getElementById('dirCollapseBtn').click();
    `
  });
  await new Promise(r => setTimeout(r, 600));

  const minMetrics = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const panel = document.getElementById('directionsPanel');
        const rect = panel ? panel.getBoundingClientRect() : null;
        return {
          minimized: panel ? panel.classList.contains('minimized') : false,
          height: rect ? rect.height : 0,
          icon: document.getElementById('dirCollapseIcon') ? document.getElementById('dirCollapseIcon').innerText : ''
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Directions minimized metrics:', minMetrics.result.value);

  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-mobile-map-directions-minimized.png'), Buffer.from(snap3.data, 'base64'));
  console.log('Saved verified-mobile-map-directions-minimized.png');

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  if (dirMetrics.result.value.active && minMetrics.result.value.minimized) {
    console.log('All mobile layout and directions tests passed successfully!');
  } else {
    throw new Error('Verification assertions failed: ' + JSON.stringify({ dirMetrics, minMetrics }));
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
