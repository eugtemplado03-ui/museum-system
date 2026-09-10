const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function run() {
  console.log('--- Testing Access Gate & Mobile Admin Return ---');
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-gate-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9277',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get('http://localhost:9277/json/list', res => {
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

  // Mobile viewport: iPhone 14
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  // TEST 1: Unauthenticated user opens /exhibit.html?code=EX-001
  console.log('1. Testing Unauthenticated Scanned Link Access (/exhibit.html?code=EX-001)...');
  await send('Page.navigate', { url: 'http://localhost:3000/exhibit.html?code=EX-001' });
  await new Promise(r => setTimeout(r, 2000));

  const gateCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          currentUrl: window.location.href,
          noticeVisible: document.getElementById('portalTagNotice')?.style.display !== 'none',
          noticeTitle: document.getElementById('tagNoticeTitle')?.innerText,
          noticeSub: document.getElementById('tagNoticeSubtitle')?.innerText,
          hasVisitorTab: !!document.getElementById('tabVisitorBtn'),
          hasAdminTab: !!document.getElementById('tabAdminBtn')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Gate redirect check:', gateCheck.result.value);

  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-gate-scan-redirect.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved verified-gate-scan-redirect.png');

  // Submit visitor check-in form to unlock exhibit
  console.log('Submitting check-in form on gate page...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        document.getElementById('visitorName').value = 'Test Visitor Juan';
        document.getElementById('address').value = 'Bacolod City, Negros Occidental';
        document.getElementById('sex').value = 'Male';
        document.getElementById('age').value = '25';
        document.getElementById('checkinForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  const postCheckinUrl = await send('Runtime.evaluate', {
    expression: `window.location.href`,
    returnByValue: true
  });
  console.log('URL after check-in:', postCheckinUrl.result.value);

  // TEST 2: Admin switching to Public View on Mobile
  console.log('2. Testing Admin in Public View on Mobile...');
  // Log in with real superadmin credentials
  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        const res = await Api.login('superadmin', 'superadmin2026');
        Api.setToken(res.token);
        Gate.setVisitorCheckedIn('superadmin');
      })()
    `,
    awaitPromise: true
  });

  // Navigate to /dashboard.html
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard.html' });
  await new Promise(r => setTimeout(r, 2000));

  const adminControlsCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const topbarBtn = document.getElementById('adminMobileTopbarBtn');
        const dock = document.getElementById('adminPublicDock');
        return {
          topbarBtnExists: !!topbarBtn,
          topbarBtnText: topbarBtn ? topbarBtn.innerText : null,
          topbarBtnHref: topbarBtn ? topbarBtn.getAttribute('href') : null,
          dockExists: !!dock,
          dockBadge: dock ? dock.querySelector('.admin-dock-badge')?.innerText : null,
          dockBtnHref: dock ? dock.querySelector('.admin-dock-btn')?.getAttribute('href') : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Admin mobile return controls:', adminControlsCheck.result.value);

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-mobile-admin-return-controls.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved verified-mobile-admin-return-controls.png');

  // Open mobile sidebar and verify admin card
  console.log('Opening mobile sidebar to verify admin card...');
  await send('Runtime.evaluate', {
    expression: `
      document.getElementById('sidebarToggleBtn').click();
    `
  });
  await new Promise(r => setTimeout(r, 800));

  const sidebarAdminCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const adminCard = document.querySelector('.sidebar-admin-active-card, .admin-return-sublink');
        const returnLink = document.querySelector('.admin-return-sublink');
        return {
          hasAdminSidebarCard: !!adminCard,
          returnLinkHref: returnLink ? returnLink.getAttribute('href') : null,
          returnLinkText: returnLink ? returnLink.innerText : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Sidebar admin return check:', sidebarAdminCheck.result.value);

  const snap3 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-mobile-sidebar-admin-return.png'), Buffer.from(snap3.data, 'base64'));
  console.log('Saved verified-mobile-sidebar-admin-return.png');

  // Click topbar "🛡️ Admin" button to test return to admin dashboard
  console.log('Clicking topbar admin button to test return to /admin.html...');
  await send('Runtime.evaluate', {
    expression: `
      document.getElementById('adminMobileTopbarBtn').click();
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  const finalUrl = await send('Runtime.evaluate', {
    expression: `window.location.href`,
    returnByValue: true
  });
  console.log('Final URL after clicking Admin return button:', finalUrl.result.value);

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  if (
    gateCheck.result.value.noticeVisible &&
    postCheckinUrl.result.value.includes('exhibit.html') &&
    adminControlsCheck.result.value.topbarBtnExists &&
    finalUrl.result.value.includes('admin.html')
  ) {
    console.log('All gate and mobile admin return tests passed successfully!');
  } else {
    throw new Error('Test assertions failed');
  }
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
