const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function test() {
  const userDataDir = path.join(os.tmpdir(), 'chrome-test-play-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });
  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9292',
    '--user-data-dir=' + userDataDir,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((res, rej) => {
    http.get('http://localhost:9292/json/list', r => {
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
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map(a => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.log('[BROWSER EXCEPTION]', msg.params.exceptionDetails.text, msg.params.exceptionDetails.exception?.description);
    }
    if (msg.method === 'Network.responseReceived') {
      console.log('[NETWORK]', msg.params.response.url, msg.params.response.status);
    }
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
  await send('Network.enable');

  await send('Runtime.evaluate', {
    expression: "sessionStorage.setItem('museum_visitor_checked_in', 'true'); localStorage.setItem('museum_visitor_checked_in', 'true');"
  });

  await send('Page.navigate', { url: 'http://localhost:3000/map.html' });
  // Wait for data to load completely
  await new Promise(r => setTimeout(r, 3000));

  console.log('\nStep 1: Clicking River Basin (EX-002) in the Rooms Directory sidebar (exactly what user did)...');
  const clickEx = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const item = document.querySelector('.cat-exhibit-item[data-code="EX-002"]');
        if (!item) return { foundItem: false };
        item.click();
        const dirPanel = document.getElementById('directionsPanel');
        const destName = document.getElementById('dirDestName');
        const steps = Array.from(document.querySelectorAll('#dirStepsList .dir-step-item')).map(s => s.textContent);
        return {
          foundItem: true,
          panelActive: dirPanel ? dirPanel.classList.contains('active') : false,
          destName: destName ? destName.textContent : null,
          stepsCount: steps.length,
          steps: steps
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Click exhibit in directory result:', clickEx.result.value);

  console.log('\nStep 2: Clicking the "Read Aloud" button (#dirVoiceBtn)...');
  const clickVoice = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.getElementById('dirVoiceBtn');
        if (!btn) return { foundBtn: false };
        btn.click();
        return {
          foundBtn: true,
          btnText: btn.textContent
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Click voice button result:', clickVoice.result.value);

  // Poll for 3 seconds to watch audio playback state
  for (let i = 1; i <= 3; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const status = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('dirVoiceBtn');
          return {
            btnText: btn ? btn.textContent : null,
            isPlayingClass: btn ? btn.classList.contains('playing') : false
          };
        })()
      `,
      returnByValue: true
    });
    console.log(`State at ${i}s:`, status.result.value);
  }

  console.log('\nStep 3: Clicking the button again to toggle STOP...');
  const clickStop = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.getElementById('dirVoiceBtn');
        btn.click();
        return {
          btnTextAfterStop: btn.textContent,
          isPlayingClass: btn.classList.contains('playing')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Click stop result:', clickStop.result.value);

  chromeProcess.kill();
  process.exit(0);
}

test();
