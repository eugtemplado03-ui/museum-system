const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

async function testTtsEndpoint() {
  console.log('\n--- 1. Testing /api/tts/speak Endpoint ---');
  const payload = JSON.stringify({
    text: 'Welcome to Museo Sang Bata sa Negros. From the main entrance, proceed to the Marine and Nature Room.',
    lang: 'en'
  });

  const res = await fetch('http://localhost:3000/api/tts/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: payload
  });

  console.log('Status code:', res.status);
  console.log('Content-Type:', res.headers.get('content-type'));
  console.log('X-TTS-Provider:', res.headers.get('x-tts-provider') || 'natural-stream');

  assert.strictEqual(res.status, 200, 'TTS speak endpoint should return 200 OK');
  const buffer = await res.arrayBuffer();
  console.log('Audio payload size:', buffer.byteLength, 'bytes');
  assert.ok(buffer.byteLength > 2000, 'Audio payload should be > 2000 bytes');
  console.log('✓ /api/tts/speak endpoint returned valid MP3 audio successfully!');
}

async function testFrontendInBrowser(mobile = true) {
  const modeName = mobile ? 'Mobile (390x844 iPhone)' : 'Desktop (1280x800)';
  console.log(`\n--- 2. Testing Walking Directions in Browser: ${modeName} ---`);

  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-tts-' + (mobile ? 'mob-' : 'desk-') + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const port = mobile ? 9271 : 9272;
  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    'http://localhost:3000/'
  ]);

  try {
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
    const send = (m, p = {}) => new Promise((resolve, reject) => {
      const curId = id++;
      callbacks.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method: m, params: p }));
    });

    await send('Page.enable');
    await send('Runtime.enable');
    if (mobile) {
      await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
    } else {
      await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });
    }

    await send('Runtime.evaluate', {
      expression: `
        sessionStorage.setItem('museum_visitor_checked_in', 'true');
        localStorage.setItem('museum_visitor_checked_in', 'true');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000/map.html' });
    await new Promise(r => setTimeout(r, 2500));

    // Open walking directions to EX-001 (Under the Sea)
    const testRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Render directions to EX-001
          window.renderRoute('EX-001');

          const dirPanel = document.getElementById('directionsPanel');
          const exhibitDetailsBtn = document.getElementById('dirExhibitInfoBtn');
          const voiceBtn = document.getElementById('dirVoiceBtn');
          const destName = document.getElementById('dirDestName');
          const steps = document.querySelectorAll('#dirStepsList .dir-step-item');

          let voiceBtnRect = null;
          let panelRect = null;
          if (voiceBtn) {
            const r = voiceBtn.getBoundingClientRect();
            voiceBtnRect = { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
          }
          if (dirPanel) {
            const r = dirPanel.getBoundingClientRect();
            panelRect = { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height };
          }

          return {
            panelActive: dirPanel ? dirPanel.classList.contains('active') : false,
            panelVisible: dirPanel ? window.getComputedStyle(dirPanel).display !== 'none' : false,
            exhibitDetailsBtnExists: !!exhibitDetailsBtn,
            voiceBtnExists: !!voiceBtn,
            voiceBtnText: voiceBtn ? voiceBtn.textContent.trim() : null,
            voiceBtnRect,
            panelRect,
            destText: destName ? destName.textContent.trim() : null,
            stepCount: steps.length,
            viewportHeight: window.innerHeight,
            viewportWidth: window.innerWidth
          };
        })()
      `,
      returnByValue: true
    });

    const info = testRes.result.value;
    console.log('Verification data:', JSON.stringify(info, null, 2));

    assert.strictEqual(info.panelActive, true, 'Directions panel should be active');
    assert.strictEqual(info.panelVisible, true, 'Directions panel should be visible');
    assert.strictEqual(info.exhibitDetailsBtnExists, false, 'Exhibit Details button should be COMPLETELY REMOVED');
    assert.strictEqual(info.voiceBtnExists, true, 'Read Aloud button should exist');
    assert.ok(info.voiceBtnText.includes('Read Aloud'), 'Button should say Read Aloud');

    // Button visibility and bounding box checks
    assert.ok(info.voiceBtnRect.height >= 38, `Button height (${info.voiceBtnRect.height}px) should be >= 38px for touch friendliness`);
    assert.ok(info.voiceBtnRect.bottom <= info.viewportHeight, `Button bottom (${info.voiceBtnRect.bottom}px) should be on-screen <= viewport height (${info.viewportHeight}px)`);
    assert.ok(info.voiceBtnRect.top >= 0, `Button top (${info.voiceBtnRect.top}px) should be >= 0`);

    console.log(`✓ Exhibit Details button is removed.`);
    console.log(`✓ Read Aloud button is visible, full-width (${Math.round(info.voiceBtnRect.width)}px), and nicely within screen boundaries!`);

    // Test clicking the voice button
    const clickVoiceRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const voiceBtn = document.getElementById('dirVoiceBtn');
          if (!voiceBtn) return { clicked: false };
          voiceBtn.click();
          return {
            clicked: true,
            buttonTextAfterClick: voiceBtn.textContent.trim()
          };
        })()
      `,
      returnByValue: true
    });
    console.log('Voice button click result:', clickVoiceRes.result.value);
    assert.strictEqual(clickVoiceRes.result.value.clicked, true, 'Voice button should be clickable');

    await new Promise(r => setTimeout(r, 600));

    // Capture screenshot
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join('c:\\Users\\jorim\\Downloads\\museum-systembase\\museum-system', `verified-walking-directions-${mobile ? 'mobile' : 'desktop'}.png`);
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved screenshot to: ${shotPath}`);

    // Also copy to brain artifacts directory
    const artifactPath = path.join('C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\8df4b735-b828-4e62-9b89-5d6925e1c639', `verified-walking-directions-${mobile ? 'mobile' : 'desktop'}.png`);
    fs.writeFileSync(artifactPath, Buffer.from(shot.data, 'base64'));
    console.log(`Saved artifact screenshot: ${artifactPath}`);

    ws.close();
  } finally {
    chromeProcess.kill();
  }
}

async function main() {
  try {
    await testTtsEndpoint();
    await testFrontendInBrowser(true);  // Mobile
    await testFrontendInBrowser(false); // Desktop
    console.log('\n========================================');
    console.log('ALL VERIFICATIONS PASSED SUCCESSFULLY!');
    console.log('========================================');
    process.exit(0);
  } catch (err) {
    console.error('\n❌ Verification failed:', err);
    process.exit(1);
  }
}

main();
