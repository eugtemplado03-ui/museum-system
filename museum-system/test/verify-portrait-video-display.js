const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function verifyPortraitVideo() {
  console.log('=== Verifying Portrait & Landscape Video Display in Exhibits & Gallery ===');
  const userDataDir = path.join(os.tmpdir(), 'chrome-verify-video-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const port = 9298;

  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    '--window-size=1280,1000',
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

  // 1. Check in visitor on origin
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1000));
  await evaluate(`
    localStorage.setItem('museum_visitor_checked_in', 'true');
    localStorage.setItem('museum_visitor_date', new Date().toISOString().slice(0, 10));
    sessionStorage.setItem('museum_visitor_checked_in', 'true');
  `);

  // ── PART 1: TEST EXHIBIT EX-012 ──
  console.log('\n--- 1. Testing Exhibit EX-012 Video ---');
  await send('Page.navigate', { url: 'http://localhost:3000/exhibit.html?code=EX-012' });
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(`!!document.querySelector('.plaque-media video')`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1500));

  // Trigger video metadata loading and play
  const exVideoStats = await evaluate(`(() => {
    const v = document.querySelector('.plaque-media video');
    const plaque = document.querySelector('.plaque-media');
    if (!v) return { error: 'No video found' };
    const style = window.getComputedStyle(v);
    const plaqueStyle = window.getComputedStyle(plaque);
    return {
      src: v.src,
      videoWidth: v.videoWidth,
      videoHeight: v.videoHeight,
      isPortrait: v.videoHeight > v.videoWidth,
      objectFit: style.objectFit,
      videoClientWidth: v.clientWidth,
      videoClientHeight: v.clientHeight,
      plaqueHeight: plaque.clientHeight,
      hasPortraitClass: plaque.classList.contains('has-portrait-video')
    };
  })()`);
  console.log('Exhibit Video Stats before play:', exVideoStats);

  // Play the video
  console.log('Playing exhibit video...');
  await evaluate(`(() => {
    const v = document.querySelector('.plaque-media video');
    if (v) {
      v.muted = true;
      v.play().catch(e => console.log('play err', e));
    }
  })()`);
  await new Promise(r => setTimeout(r, 1000));

  const exVideoStatsPlaying = await evaluate(`(() => {
    const v = document.querySelector('.plaque-media video');
    const plaque = document.querySelector('.plaque-media');
    return {
      paused: v ? v.paused : true,
      currentTime: v ? v.currentTime : 0,
      objectFit: v ? window.getComputedStyle(v).objectFit : null,
      plaqueHeight: plaque ? plaque.clientHeight : 0,
      hasPortraitClass: plaque ? plaque.classList.contains('has-portrait-video') : false
    };
  })()`);
  console.log('Exhibit Video Stats while playing:', exVideoStatsPlaying);
  await captureScreenshot(path.join(artifactDir, 'verified-exhibit-portrait-video.png'));

  // Test switching between tabs
  console.log('Testing exhibit media tab switcher with portrait video...');
  await evaluate(`(() => {
    const pTab = document.querySelector('.media-combo-tab[data-target="photos"]');
    if (pTab) pTab.click();
  })()`);
  await new Promise(r => setTimeout(r, 500));
  const afterPhotos = await evaluate(`(() => {
    const plaque = document.querySelector('.plaque-media');
    const v = document.querySelector('.plaque-media video');
    return {
      hasPortraitClassOnPhotos: plaque.classList.contains('has-portrait-video'),
      videoPaused: v.paused
    };
  })()`);
  console.log('After switching to Photos tab:', afterPhotos);

  await evaluate(`(() => {
    const vTab = document.querySelector('.media-combo-tab[data-target="video"]');
    if (vTab) vTab.click();
  })()`);
  await new Promise(r => setTimeout(r, 500));
  const afterVideoBack = await evaluate(`(() => {
    const plaque = document.querySelector('.plaque-media');
    return {
      hasPortraitClassOnVideo: plaque.classList.contains('has-portrait-video')
    };
  })()`);
  console.log('After switching back to Video tab:', afterVideoBack);


  // ── PART 2: TEST GALLERY ──
  console.log('\n--- 2. Testing Gallery Page & Modal ---');
  await send('Page.navigate', { url: 'http://localhost:3000/gallery.html' });
  for (let i = 0; i < 40; i++) {
    const ready = await evaluate(`!!document.querySelector('.gallery-content-card video')`);
    if (ready) break;
    await new Promise(r => setTimeout(r, 200));
  }
  await new Promise(r => setTimeout(r, 1500));

  const galCardStats = await evaluate(`(() => {
    const v = document.querySelector('.gallery-content-card video');
    return {
      videoWidth: v ? v.videoWidth : 0,
      videoHeight: v ? v.videoHeight : 0,
      isPortrait: v ? v.videoHeight > v.videoWidth : false,
      objectFit: v ? window.getComputedStyle(v).objectFit : null
    };
  })()`);
  console.log('Gallery Card Video Stats:', galCardStats);

  // Play video on gallery card
  console.log('Playing video on gallery card...');
  await evaluate(`(() => {
    const v = document.querySelector('.gallery-content-card video');
    if (v) {
      v.muted = true;
      v.play().catch(e => console.log('gal play err', e));
    }
  })()`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot(path.join(artifactDir, 'verified-gallery-card-video.png'));

  // Open Gallery Detail Modal
  console.log('Opening Gallery Detail Modal for video item...');
  await evaluate(`(() => {
    const btn = document.querySelector('.gallery-content-card button[onclick*="openGalleryDetail"]');
    if (btn) btn.click();
  })()`);
  await new Promise(r => setTimeout(r, 1200));

  const modalStats = await evaluate(`(() => {
    const overlay = document.getElementById('galleryDetailOverlay');
    if (!overlay) return { error: 'No overlay found' };
    const mediaWrap = overlay.querySelector('.gallery-detail-media-wrap');
    const v = overlay.querySelector('video');
    return {
      isOpen: true,
      hasVideo: !!v,
      videoWidth: v ? v.videoWidth : 0,
      videoHeight: v ? v.videoHeight : 0,
      isPortrait: v ? v.videoHeight > v.videoWidth : false,
      objectFit: v ? window.getComputedStyle(v).objectFit : null,
      wrapHeight: mediaWrap ? mediaWrap.clientHeight : 0,
      hasPortraitClass: mediaWrap ? mediaWrap.classList.contains('has-portrait-video') : false
    };
  })()`);
  console.log('Gallery Modal Video Stats:', modalStats);

  // Play in modal
  await evaluate(`(() => {
    const overlay = document.getElementById('galleryDetailOverlay');
    const v = overlay ? overlay.querySelector('video') : null;
    if (v) {
      v.muted = true;
      v.play().catch(e => console.log('modal play err', e));
    }
  })()`);
  await new Promise(r => setTimeout(r, 800));
  await captureScreenshot(path.join(artifactDir, 'verified-gallery-modal-video.png'));

  ws.close();
  chrome.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  const exSuccess = exVideoStats.objectFit === 'contain' &&
                    exVideoStatsPlaying.objectFit === 'contain' &&
                    exVideoStatsPlaying.hasPortraitClass === true;
  const galSuccess = galCardStats.objectFit === 'contain' &&
                     modalStats.objectFit === 'contain' &&
                     modalStats.hasPortraitClass === true;

  console.log('\n=== FINAL VERIFICATION SUMMARY ===');
  console.log('Exhibit Portrait Video Check:', exSuccess ? 'PASS' : 'FAIL');
  console.log('Gallery Portrait Video Check:', galSuccess ? 'PASS' : 'FAIL');

  const allPassed = exSuccess && galSuccess;
  console.log('Overall Status:', allPassed ? 'ALL TESTS PASSED' : 'SOME TESTS FAILED');
  process.exit(allPassed ? 0 : 1);
}

verifyPortraitVideo().catch(err => {
  console.error(err);
  process.exit(1);
});
