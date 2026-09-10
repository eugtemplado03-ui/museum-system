const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const QRCode = require('qrcode');

async function testScanner() {
  console.log('--- Testing Robust Exhibit Tag Scanner ---');
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-scanner-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9275',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--use-fake-ui-for-media-stream',
    '--use-fake-device-for-media-stream',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get('http://localhost:9275/json/list', res => {
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
      console.log('BROWSER CONSOLE:', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
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
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `
      sessionStorage.setItem('museum_visitor_checked_in', 'true');
      localStorage.setItem('museum_visitor_checked_in', 'true');
    `
  });

  await send('Page.navigate', { url: 'http://localhost:3000/dashboard.html' });
  await new Promise(r => setTimeout(r, 2000));

  // 1. Initial State Check
  const info = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          hasMediaDevices: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
          hasJsQR: typeof jsQR === 'function',
          btnText: document.getElementById('openScannerBtn')?.innerText,
          hasPhotoBtn: !!document.getElementById('fileScanBtn'),
          hasQuickTags: document.querySelectorAll('.quick-tag-pill').length
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Initial scanner state:', info.result.value);

  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-scanner-ready.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved verified-scanner-ready.png');

  // 2. Open Live Scanner
  console.log('Activating live camera scanner...');
  await send('Runtime.evaluate', {
    expression: `document.getElementById('openScannerBtn').click();`
  });
  await new Promise(r => setTimeout(r, 1500));

  const afterOpen = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const v = document.querySelector('#viewport video');
        const l = document.querySelector('.scan-line');
        return {
          btnText: document.getElementById('openScannerBtn')?.innerText,
          statusText: document.getElementById('scanStatus')?.innerText,
          hasVideo: !!v,
          videoReady: v ? v.readyState : 0,
          hasScanLine: !!l,
          placeholderHidden: document.getElementById('viewportPlaceholder')?.style.display === 'none'
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Active camera state:', afterOpen.result.value);

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-scanner-active.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved verified-scanner-active.png');

  // 3. Stop Scanner
  console.log('Testing Stop Scanner...');
  await send('Runtime.evaluate', {
    expression: `document.getElementById('openScannerBtn').click();`
  });
  await new Promise(r => setTimeout(r, 600));

  const afterStop = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          btnText: document.getElementById('openScannerBtn')?.innerText,
          hasVideo: !!document.querySelector('#viewport video'),
          placeholderVisible: document.getElementById('viewportPlaceholder')?.style.display !== 'none'
        };
      })()
    `,
    returnByValue: true
  });
  console.log('After stop scanner state:', afterStop.result.value);

  // 4. Test QR Photo Decoder using a real QR image for EX-001
  console.log('Generating QR code data URL for EX-001...');
  const qrDataUrl = await QRCode.toDataURL('http://localhost:3000/exhibit.html?code=EX-001&src=scan', {
    width: 400,
    margin: 2
  });

  console.log('Feeding QR image to handleQrImageFile()...');
  const decodeResult = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Create an Image from data URL and decode with decodeCanvasQR
        const img = new Image();
        await new Promise(resolve => {
          img.onload = resolve;
          img.src = ${JSON.stringify(qrDataUrl)};
        });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);

        const decoded = await decodeCanvasQR(canvas);
        return { decoded };
      })()
    `,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('QR Code Decode Test Result:', decodeResult.result.value);

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  if (afterOpen.result.value.hasVideo && decodeResult.result.value.decoded) {
    console.log('All scanner tests passed with flying colors!');
  } else {
    throw new Error('Scanner assertion failed: ' + JSON.stringify({ afterOpen, decodeResult }));
  }
}

testScanner().catch(err => {
  console.error(err);
  process.exit(1);
});
