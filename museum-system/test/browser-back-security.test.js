const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testBrowserBackSecurity() {
  console.log('--- Testing Browser Back Security: Visitor -> Admin -> Back Button -> Sign Up Again ---');
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-backsec-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9279',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
    'http://localhost:3000/'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const list = await new Promise((resolve, reject) => {
    http.get('http://localhost:9279/json/list', res => {
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

  // STEP 1: Log in / Check in as Visitor
  console.log('1. Checking in as Visitor on gate page...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        document.getElementById('visitorName').value = 'Maria BackTest Santos';
        document.getElementById('address').value = 'Sagay City, Negros Occidental';
        document.getElementById('sex').value = 'Female';
        document.getElementById('age').value = '24';
        document.getElementById('checkinForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  const postVisitorUrl = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          url: window.location.href,
          checkedIn: Gate.isVisitorCheckedIn(),
          visitorName: Gate.getVisitorName()
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Visitor Check-in State:', postVisitorUrl.result.value);

  // STEP 2: Log in as Admin
  console.log('2. Navigating to Admin login and signing in as Admin...');
  await send('Page.navigate', { url: 'http://localhost:3000/?tab=admin' });
  await new Promise(r => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    expression: `
      (async () => {
        document.getElementById('adminUsername').value = 'superadmin';
        document.getElementById('adminPassword').value = 'superadmin2026';
        document.getElementById('adminLoginForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2500));

  const adminPageState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          url: window.location.href,
          isAdmin: Gate.isAdminLoggedIn(),
          isVisitorCheckedIn: Gate.isVisitorCheckedIn()
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Admin Page State:', adminPageState.result.value);

  // STEP 3: Click the browser Back button (←)
  console.log('3. Triggering browser Back button (history.back())...');
  await send('Runtime.evaluate', {
    expression: `window.history.back();`
  });
  await new Promise(r => setTimeout(r, 2000));

  const afterBackState = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const notice = document.getElementById('portalTagNotice');
        const form = document.getElementById('checkinForm');
        return {
          url: window.location.href,
          isAdmin: (typeof Gate !== 'undefined') ? Gate.isAdminLoggedIn() : false,
          isVisitorCheckedIn: (typeof Gate !== 'undefined') ? Gate.isVisitorCheckedIn() : false,
          adminTokenInStorage: !!localStorage.getItem('museum_admin_token') || !!sessionStorage.getItem('museum_admin_token'),
          visitorCheckinInStorage: !!localStorage.getItem('museum_visitor_checked_in') || !!sessionStorage.getItem('museum_visitor_checked_in'),
          noticeVisible: notice ? notice.style.display !== 'none' : false,
          noticeTitle: document.getElementById('tagNoticeTitle')?.innerText,
          noticeSub: document.getElementById('tagNoticeSubtitle')?.innerText,
          hasCheckinForm: !!form
        };
      })()
    `,
    returnByValue: true
  });
  console.log('State after Browser Back button:', afterBackState.result.value);

  // Take screenshot of gate page after back navigation
  const snap = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-browser-back-signup.png'), Buffer.from(snap.data, 'base64'));
  console.log('Saved verified-browser-back-signup.png');

  // STEP 4: Verify unauthorized access to dashboard is blocked
  console.log('4. Verifying that trying to open /dashboard.html redirects back to sign-up...');
  await send('Page.navigate', { url: 'http://localhost:3000/dashboard.html' });
  await new Promise(r => setTimeout(r, 1500));

  const dashboardBlockedCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          currentUrl: window.location.href,
          isBlockedToGate: window.location.pathname === '/' || window.location.pathname.includes('index.html')
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Direct Dashboard Access Check:', dashboardBlockedCheck.result.value);

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  const success = (
    postVisitorUrl.result.value.checkedIn === true &&
    adminPageState.result.value.isAdmin === true &&
    afterBackState.result.value.isAdmin === false &&
    afterBackState.result.value.isVisitorCheckedIn === false &&
    afterBackState.result.value.adminTokenInStorage === false &&
    afterBackState.result.value.visitorCheckinInStorage === false &&
    (afterBackState.result.value.url.includes('action=signup') || afterBackState.result.value.hasCheckinForm) &&
    dashboardBlockedCheck.result.value.isBlockedToGate === true
  );

  if (success) {
    console.log('--- ALL BROWSER BACK BUTTON SECURITY CHECKS PASSED! ---');
  } else {
    throw new Error('Test assertions failed');
  }
}

testBrowserBackSecurity().catch(err => {
  console.error(err);
  process.exit(1);
});
