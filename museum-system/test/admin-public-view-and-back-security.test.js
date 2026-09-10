const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

async function testAdminPublicViewAndBackSecurity() {
  console.log('--- Testing Admin Public View as Admin & Back Button Security ---');
  const artifactDir = 'C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\f688c3f7-8413-4888-9985-25a0512bb923';
  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-adminpub-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const chromeProcess = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9280',
    `--user-data-dir=${userDataDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-extensions',
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

  // Set mobile device metrics to test mobile topbar button & floating dock
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true
  });

  // STEP 1: Check in as Visitor
  console.log('1. Checking in as Visitor...');
  await send('Page.navigate', { url: 'http://localhost:3000/' });
  await new Promise(r => setTimeout(r, 1500));

  await send('Runtime.evaluate', {
    expression: `
      (() => {
        document.getElementById('visitorName').value = 'Test Visitor Pedro';
        document.getElementById('address').value = 'Bacolod City';
        document.getElementById('sex').value = 'Male';
        document.getElementById('age').value = '28';
        document.getElementById('checkinForm').dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  // STEP 2: Log in as Admin
  console.log('2. Logging in as Admin...');
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

  const adminPortalCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          url: window.location.href,
          isAdmin: (typeof Gate !== 'undefined') ? Gate.isAdminLoggedIn() : false
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Admin Portal Check:', adminPortalCheck.result.value);

  // STEP 3: Admin switches to Public View (View Public Site)
  console.log('3. Admin clicks "View Public Site" to view public view as admin...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const btn = document.getElementById('adminViewSiteBtn') || document.querySelector('.admin-view-site-link');
        if (btn) btn.click();
        else window.location.href = '/dashboard.html';
      })()
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  const publicViewAsAdminCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const topbarBtn = document.getElementById('adminMobileTopbarBtn');
        const dock = document.getElementById('adminPublicDock');
        return {
          url: window.location.href,
          isAdmin: (typeof Gate !== 'undefined') ? Gate.isAdminLoggedIn() : false,
          isVisitor: (typeof Gate !== 'undefined') ? Gate.isVisitorCheckedIn() : false,
          hasTopbarAdminBtn: !!topbarBtn,
          topbarBtnHref: topbarBtn ? topbarBtn.getAttribute('href') : null,
          hasAdminDock: !!dock,
          dockBadgeText: dock ? dock.querySelector('.admin-dock-badge')?.innerText : null
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Public View as Admin Check:', publicViewAsAdminCheck.result.value);

  // Screenshot of Public View as Admin
  const snap1 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-admin-in-public-view.png'), Buffer.from(snap1.data, 'base64'));
  console.log('Saved verified-admin-in-public-view.png');

  // STEP 4: Return to Admin Dashboard from Public View
  console.log('4. Returning to Admin Dashboard using mobile topbar button...');
  await send('Runtime.evaluate', {
    expression: `
      document.getElementById('adminMobileTopbarBtn').click();
    `
  });
  await new Promise(r => setTimeout(r, 2000));

  const returnToAdminCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        return {
          url: window.location.href,
          isAdmin: (typeof Gate !== 'undefined') ? Gate.isAdminLoggedIn() : false
        };
      })()
    `,
    returnByValue: true
  });
  console.log('Returned to Admin Dashboard Check:', returnToAdminCheck.result.value);

  // STEP 5: Click Browser Back Button (←) while in Admin Portal
  console.log('5. Clicking browser Back button (history.back()) from Admin Portal...');
  await send('Runtime.evaluate', {
    expression: `window.history.back();`
  });
  await new Promise(r => setTimeout(r, 2000));

  const afterBackSecurityCheck = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const form = document.getElementById('checkinForm');
        const notice = document.getElementById('portalTagNotice');
        return {
          url: window.location.href,
          isAdmin: (typeof Gate !== 'undefined') ? Gate.isAdminLoggedIn() : false,
          isVisitor: (typeof Gate !== 'undefined') ? Gate.isVisitorCheckedIn() : false,
          adminTokenCleared: !localStorage.getItem('museum_admin_token') && !sessionStorage.getItem('museum_admin_token'),
          visitorCheckinCleared: !localStorage.getItem('museum_visitor_checked_in') && !sessionStorage.getItem('museum_visitor_checked_in'),
          hasCheckinForm: !!form,
          noticeVisible: notice ? notice.style.display !== 'none' : false,
          noticeTitle: document.getElementById('tagNoticeTitle')?.innerText
        };
      })()
    `,
    returnByValue: true
  });
  console.log('State after Browser Back Button:', afterBackSecurityCheck.result.value);

  const snap2 = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(path.join(artifactDir, 'verified-back-button-forces-signup.png'), Buffer.from(snap2.data, 'base64'));
  console.log('Saved verified-back-button-forces-signup.png');

  ws.close();
  chromeProcess.kill();
  try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (e) {}

  const passes = (
    adminPortalCheck.result.value.isAdmin === true &&
    publicViewAsAdminCheck.result.value.isAdmin === true &&
    publicViewAsAdminCheck.result.value.hasTopbarAdminBtn === true &&
    publicViewAsAdminCheck.result.value.hasAdminDock === true &&
    returnToAdminCheck.result.value.isAdmin === true &&
    returnToAdminCheck.result.value.url.includes('admin.html') &&
    afterBackSecurityCheck.result.value.isAdmin === false &&
    afterBackSecurityCheck.result.value.isVisitor === false &&
    afterBackSecurityCheck.result.value.adminTokenCleared === true &&
    afterBackSecurityCheck.result.value.hasCheckinForm === true
  );

  if (passes) {
    console.log('--- ALL ADMIN PUBLIC VIEW & BACK BUTTON SECURITY CHECKS PASSED! ---');
  } else {
    throw new Error('Test assertions failed');
  }
}

testAdminPublicViewAndBackSecurity().catch(err => {
  console.error(err);
  process.exit(1);
});
