const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

(async () => {
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\8df4b735-b828-4e62-9b89-5d6925e1c639';
  const userDataDir = path.join(os.tmpdir(), 'chrome-snap-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9282',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--window-size=1280,1000',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((res, rej) => {
    http.get('http://localhost:9282/json/list', r => {
      let d = ''; r.on('data', c => d += c); r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
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
  const send = (m, p = {}) => new Promise((res, rej) => {
    const curId = id++;
    callbacks.set(curId, res);
    ws.send(JSON.stringify({ id: curId, method: m, params: p }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1500));

  // Scroll to exhibits
  await send('Runtime.evaluate', { expression: `document.getElementById('exhibitsSection').scrollIntoView();` });
  await new Promise(r => setTimeout(r, 800));
  const snapExhibits = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-welcome-exhibits.png'), Buffer.from(snapExhibits.data, 'base64'));

  // Scroll to programs
  await send('Runtime.evaluate', { expression: `document.getElementById('programsSection').scrollIntoView();` });
  await new Promise(r => setTimeout(r, 800));
  const snapPrograms = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-welcome-programs.png'), Buffer.from(snapPrograms.data, 'base64'));

  // Scroll to gallery
  await send('Runtime.evaluate', { expression: `document.getElementById('gallerySection').scrollIntoView();` });
  await new Promise(r => setTimeout(r, 800));
  const snapGallery = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-welcome-gallery.png'), Buffer.from(snapGallery.data, 'base64'));

  // Scroll to events
  await send('Runtime.evaluate', { expression: `document.getElementById('eventsSection').scrollIntoView();` });
  await new Promise(r => setTimeout(r, 800));
  const snapEvents = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-welcome-events.png'), Buffer.from(snapEvents.data, 'base64'));

  console.log('All section screenshots captured successfully!');
  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}
})();
