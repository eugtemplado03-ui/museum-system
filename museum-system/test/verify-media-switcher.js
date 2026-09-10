const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function verifyMediaSwitcher() {
  console.log('=== Verifying Video & Photos Media Switcher ===');
  const userDataDir = path.join(os.tmpdir(), 'chrome-verify-media-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';

  const port = 9289;
  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,1000',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'http://localhost:3000/exhibit.html?code=EX-012'
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
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('EXCEPTION:', JSON.stringify(msg.params.exceptionDetails));
    }
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

  const evaluate = async (expr) => {
    const res = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    return res && res.result ? res.result.value : null;
  };

  const captureScreenshot = async (filepath) => {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filepath, Buffer.from(res.data, 'base64'));
    console.log(`Saved screenshot to ${filepath}`);
  };

  // Set visitor checkin first
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1000));
  await evaluate(`
    localStorage.setItem('museum_visitor_checked_in', 'true');
    localStorage.setItem('museum_visitor_date', new Date().toISOString().slice(0, 10));
    sessionStorage.setItem('museum_visitor_checked_in', 'true');
  `);

  // Navigate to exhibit EX-012
  console.log('Navigating to EX-012...');
  await send('Page.navigate', { url: 'http://localhost:3000/exhibit.html?code=EX-012' });
  await new Promise(r => setTimeout(r, 1500));

  // Wait for media tabs to render
  for (let i = 0; i < 30; i++) {
    const hasTabs = await evaluate(`!!document.querySelector('.media-combo-tab')`);
    if (hasTabs) break;
    await new Promise(r => setTimeout(r, 200));
  }

  // 1. Check Initial State (Video tab active)
  const initialState = await evaluate(`(() => {
    const vTab = document.querySelector('.media-combo-tab[data-target="video"]');
    const pTab = document.querySelector('.media-combo-tab[data-target="photos"]');
    const vPanel = document.querySelector('.media-combo-panel[data-panel="video"]');
    const pPanel = document.querySelector('.media-combo-panel[data-panel="photos"]');
    return {
      videoTabActive: vTab ? vTab.classList.contains('active') : false,
      photosTabActive: pTab ? pTab.classList.contains('active') : false,
      videoPanelVisible: vPanel ? vPanel.style.display !== 'none' && vPanel.classList.contains('active') : false,
      photosPanelHidden: pPanel ? pPanel.style.display === 'none' && !pPanel.classList.contains('active') : false,
    };
  })()`);
  console.log('Initial State:', initialState);

  // 2. Click Photos Tab
  console.log('Clicking Photos tab...');
  await evaluate(`(() => {
    const pTab = document.querySelector('.media-combo-tab[data-target="photos"]');
    if (pTab) pTab.click();
  })()`);
  await new Promise(r => setTimeout(r, 600));

  const afterPhotosClick = await evaluate(`(() => {
    const vTab = document.querySelector('.media-combo-tab[data-target="video"]');
    const pTab = document.querySelector('.media-combo-tab[data-target="photos"]');
    const vPanel = document.querySelector('.media-combo-panel[data-panel="video"]');
    const pPanel = document.querySelector('.media-combo-panel[data-panel="photos"]');
    const carouselImgs = Array.from(pPanel ? pPanel.querySelectorAll('img') : []).map(img => img.src);
    return {
      videoTabActive: vTab ? vTab.classList.contains('active') : false,
      photosTabActive: pTab ? pTab.classList.contains('active') : false,
      videoPanelHidden: vPanel ? vPanel.style.display === 'none' && !vPanel.classList.contains('active') : false,
      photosPanelVisible: pPanel ? pPanel.style.display !== 'none' && pPanel.classList.contains('active') : false,
      photoCount: carouselImgs.length
    };
  })()`);
  console.log('State After Clicking Photos:', afterPhotosClick);
  await captureScreenshot(path.join(artifactDir, 'verified-media-tabs-photos.png'));

  // 3. Click Video Tab
  console.log('Clicking Video tab...');
  await evaluate(`(() => {
    const vTab = document.querySelector('.media-combo-tab[data-target="video"]');
    if (vTab) vTab.click();
  })()`);
  await new Promise(r => setTimeout(r, 600));

  const afterVideoClick = await evaluate(`(() => {
    const vTab = document.querySelector('.media-combo-tab[data-target="video"]');
    const pTab = document.querySelector('.media-combo-tab[data-target="photos"]');
    const vPanel = document.querySelector('.media-combo-panel[data-panel="video"]');
    const pPanel = document.querySelector('.media-combo-panel[data-panel="photos"]');
    return {
      videoTabActive: vTab ? vTab.classList.contains('active') : false,
      photosTabActive: pTab ? pTab.classList.contains('active') : false,
      videoPanelVisible: vPanel ? vPanel.style.display !== 'none' && vPanel.classList.contains('active') : false,
      photosPanelHidden: pPanel ? pPanel.style.display === 'none' && !pPanel.classList.contains('active') : false,
    };
  })()`);
  console.log('State After Clicking Video back:', afterVideoClick);
  await captureScreenshot(path.join(artifactDir, 'verified-media-tabs-video.png'));

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  const success = initialState.videoTabActive &&
                  initialState.videoPanelVisible &&
                  afterPhotosClick.photosTabActive &&
                  afterPhotosClick.photosPanelVisible &&
                  afterVideoClick.videoTabActive &&
                  afterVideoClick.videoPanelVisible;

  console.log('\n=== VERIFICATION RESULT ===');
  console.log(success ? 'SUCCESS: Video and Photos buttons work bidirectionally!' : 'FAILED: State transitions invalid');
  process.exit(success ? 0 : 1);
}

verifyMediaSwitcher().catch(err => {
  console.error(err);
  process.exit(1);
});
