const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testWelcomePage() {
  console.log('--- Testing Welcome Page, Carousel, Details, and Direct Check-in Flow ---');
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\8df4b735-b828-4e62-9b89-5d6925e1c639';
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-welcome-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9280',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    '--window-size=1280,900',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get('http://localhost:9280/json/list', res => {
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

  // STEP 1: Verify elements on the landing page
  console.log('1. Checking page elements and content...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1500));

  const pageChecks = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const carousel = document.getElementById('museumCarousel');
        const slides = document.querySelectorAll('.carousel-slide-item');
        const aboutSec = document.getElementById('aboutSection');
        const exhibitsSec = document.getElementById('exhibitsSection');
        const programsSec = document.getElementById('programsSection');
        const gallerySec = document.getElementById('gallerySection');
        const eventsSec = document.getElementById('eventsSection');
        const checkinSec = document.getElementById('checkinSection');
        const checkinForm = document.getElementById('checkinForm');

        return {
          hasCarousel: !!carousel,
          slideCount: slides.length,
          hasAbout: !!aboutSec && aboutSec.innerText.includes('Old Sagay'),
          hasExhibits: !!exhibitsSec && exhibitsSec.querySelectorAll('.exhibit-card').length >= 6,
          hasPrograms: !!programsSec && programsSec.querySelectorAll('.program-card').length >= 4,
          hasGallery: !!gallerySec && gallerySec.querySelectorAll('.gallery-preview-card').length >= 4,
          hasEvents: !!eventsSec && eventsSec.querySelectorAll('.event-card').length >= 4,
          hasCheckin: !!checkinSec && !!checkinForm
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Page Elements Check:', pageChecks.result.value);

  // Take screenshot of hero & carousel
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-welcome-hero-carousel.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved verified-welcome-hero-carousel.png');

  // STEP 2: Test carousel next arrow
  console.log('2. Testing carousel navigation...');
  await send('Runtime.evaluate', {
    expression: `document.getElementById('carouselNextBtn').click();`
  });
  await new Promise(r => setTimeout(r, 500));

  const carouselState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const counter = document.getElementById('carouselCounter')?.innerText;
        const activeSlide = document.querySelector('.carousel-slide-item.active');
        return {
          counter,
          activeTitle: activeSlide?.querySelector('.carousel-title')?.innerText
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Carousel State after next click:', carouselState.result.value);

  // STEP 3: Click "Check In to View All Details" on Under the Sea
  console.log('3. Clicking Check In button on Under the Sea exhibit card...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const card = document.querySelector('.exhibit-card');
        const btn = card.querySelector('.btn-checkin-direct');
        btn.click();
      })()
    `
  });
  await new Promise(r => setTimeout(r, 1000));

  const directNoticeState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const notice = document.getElementById('directUnlockNotice');
        const title = document.getElementById('directUnlockTitle')?.innerText;
        const focused = document.activeElement?.id;
        return {
          noticeVisible: notice ? notice.classList.contains('visible') : false,
          noticeTitle: title,
          focusedElement: focused
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Direct Notice & Focus State:', directNoticeState.result.value);

  // Take screenshot of checkin section with notice
  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-welcome-direct-checkin.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved verified-welcome-direct-checkin.png');

  // STEP 4: Submit check-in and verify direct redirect to exhibit EX-001
  console.log('4. Submitting check-in and verifying redirect to exhibit EX-001...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        document.getElementById('visitorName').value = 'Juan Welcome Tester';
        document.getElementById('address').value = 'Sagay City, Negros Occidental';
        document.getElementById('sex').value = 'Male';
        document.getElementById('age').value = '10';
        document.getElementById('checkinForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  const postCheckinUrl = await send('Runtime.evaluate', {
    expression: `window.location.href`,
    returnByValue: true
  });
  console.log('Post-Checkin URL:', postCheckinUrl.result.value);

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  const allPassed = (
    pageChecks.result.value.hasCarousel === true &&
    pageChecks.result.value.slideCount === 5 &&
    pageChecks.result.value.hasAbout === true &&
    pageChecks.result.value.hasExhibits === true &&
    pageChecks.result.value.hasPrograms === true &&
    pageChecks.result.value.hasGallery === true &&
    pageChecks.result.value.hasEvents === true &&
    pageChecks.result.value.hasCheckin === true &&
    carouselState.result.value.counter === '2 / 5' &&
    directNoticeState.result.value.noticeVisible === true &&
    directNoticeState.result.value.noticeTitle.includes('Under the Sea') &&
    directNoticeState.result.value.focusedElement === 'visitorName' &&
    postCheckinUrl.result.value.includes('exhibit.html') &&
    postCheckinUrl.result.value.includes('code=EX-001')
  );

  if (allPassed) {
    console.log('--- ALL WELCOME PAGE & DIRECT CHECK-IN TESTS PASSED! ---');
  } else {
    throw new Error('Some assertions failed in testWelcomePage');
  }
}

testWelcomePage().catch(err => {
  console.error(err);
  process.exit(1);
});
