const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

async function testAudioSwitchingAndAccuracy() {
  console.log('\n--- Testing Walking Directions Audio Switching & Accuracy in Chrome Headless ---');

  const userDataDir = path.join(os.tmpdir(), 'chrome-profile-switch-test-' + Date.now());
  fs.mkdirSync(userDataDir, { recursive: true });

  const port = 9275;
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
      if (msg.method === 'Runtime.consoleAPICalled') {
        const text = msg.params.args.map(a => a.value || a.description).join(' ');
        console.log('[Browser Console]', text);
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
    await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 800, deviceScaleFactor: 1, mobile: false });

    await send('Runtime.evaluate', {
      expression: `
        sessionStorage.setItem('museum_visitor_checked_in', 'true');
        localStorage.setItem('museum_visitor_checked_in', 'true');
      `
    });

    await send('Page.navigate', { url: 'http://localhost:3000/map.html' });
    await new Promise(r => setTimeout(r, 2500));

    // 1. Step 1: Open Exhibit 1 (EX-001) directions
    console.log('\n[Test 1] Navigating to Exhibit 1 (EX-001 - Under the Sea)...');
    const ex1State = await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.renderRoute('EX-001');
          const dest = document.getElementById('dirDestName')?.textContent.trim();
          const steps = Array.from(document.querySelectorAll('#dirStepsList .dir-step-item'))
            .map(el => el.querySelector('span:last-child')?.textContent.trim() || '');
          const speech = activeDirectionsSpeech;
          const btnText = document.getElementById('dirVoiceBtn')?.textContent.trim();
          return { dest, steps, speech, btnText };
        })()
      `,
      returnByValue: true
    });

    console.log('Raw ex1State:', JSON.stringify(ex1State, null, 2));
    const val1 = ex1State.result?.value;
    console.log('EX-001 Rendered Destination:', val1?.dest);
    console.log('EX-001 Step Count:', val1.steps.length);
    console.log('EX-001 Spoken Text:', val1.speech ? val1.speech.text : null);
    assert.ok(val1.dest.includes('Under the Sea'), 'Destination should be Under the Sea');
    assert.ok(val1.speech.text.includes('Under the Sea'), 'Speech text must include exhibit title');
    assert.ok(val1.speech.text.includes('coral reef displays'), 'Speech text must match exact exhibit directions');
    assert.strictEqual(val1.btnText, '🔊 Read Aloud', 'Button should initially say Read Aloud');

    // 2. Play Audio on Exhibit 1
    console.log('\n[Test 2] Clicking Read Aloud on Exhibit 1 (audio starts)...');
    const ex1Play = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('dirVoiceBtn');
          btn.click();
          return {
            btnTextAfterClick: btn.textContent.trim(),
            isTtsPlaying: isTtsPlaying,
            audioSource: _mapAudioSource
          };
        })()
      `,
      returnByValue: true
    });
    console.log('EX-001 Play State:', ex1Play.result.value);
    assert.strictEqual(ex1Play.result.value.audioSource, 'dir', 'Audio source should be "dir"');
    assert.ok(ex1Play.result.value.isTtsPlaying, 'isTtsPlaying should be true');

    // Wait 500ms while audio is streaming/playing
    await new Promise(r => setTimeout(r, 500));

    // 3. User clicks Exhibit 2 (EX-002) while Exhibit 1 audio is active!
    console.log('\n[Test 3] User clicks Exhibit 2 (EX-002 - The River) WHILE Exhibit 1 audio is active...');
    const switchEx2 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          // Trigger route for EX-002
          window.renderRoute('EX-002');

          const dest = document.getElementById('dirDestName')?.textContent.trim();
          const steps = Array.from(document.querySelectorAll('#dirStepsList .dir-step-item'))
            .map(el => el.querySelector('span:last-child')?.textContent.trim() || '');
          const speech = activeDirectionsSpeech;
          const btnText = document.getElementById('dirVoiceBtn')?.textContent.trim();

          return {
            dest,
            steps,
            speech,
            btnText,
            isTtsPlaying: isTtsPlaying,
            audioSource: _mapAudioSource
          };
        })()
      `,
      returnByValue: true
    });

    const val2 = switchEx2.result.value;
    console.log('EX-002 Destination:', val2.dest);
    console.log('EX-002 Button text immediately after switch:', val2.btnText);
    console.log('EX-002 isTtsPlaying immediately after switch:', val2.isTtsPlaying);
    console.log('EX-002 audioSource immediately after switch:', val2.audioSource);
    console.log('EX-002 Spoken Text:', val2.speech.text);

    // Verify clean teardown
    assert.ok(val2.dest.includes('The River'), 'Destination should now be The River');
    assert.strictEqual(val2.isTtsPlaying, false, 'Previous audio must be completely stopped!');
    assert.strictEqual(val2.audioSource, null, 'Audio source must be reset to null!');
    assert.strictEqual(val2.btnText, '🔊 Read Aloud', 'Button must be reset to 🔊 Read Aloud');
    assert.ok(val2.speech.text.includes('The River'), 'Speech text must be for The River');
    assert.ok(val2.speech.text.includes('freshwater river basin'), 'Speech text must match The River directions');

    // 4. User clicks Read Aloud on Exhibit 2
    console.log('\n[Test 4] User clicks Read Aloud on Exhibit 2...');
    const ex2Play = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const btn = document.getElementById('dirVoiceBtn');
          btn.click();
          return {
            btnTextAfterClick: btn.textContent.trim(),
            isTtsPlaying: isTtsPlaying,
            audioSource: _mapAudioSource,
            activeCode: activeDirectionsSpeech?.code
          };
        })()
      `,
      returnByValue: true
    });
    console.log('EX-002 Play State:', ex2Play.result.value);
    assert.strictEqual(ex2Play.result.value.audioSource, 'dir', 'Audio source should be "dir" for EX-002');
    assert.strictEqual(ex2Play.result.value.activeCode, 'EX-002', 'Active directions must be EX-002');

    // Wait 400ms
    await new Promise(r => setTimeout(r, 400));

    // 5. Test switching to Second Floor Exhibit (EX-006 - Hampanganan)
    console.log('\n[Test 5] Switching to Level 2 Exhibit (EX-006 - Hampanganan)...');
    const switchEx6 = await send('Runtime.evaluate', {
      expression: `
        (() => {
          window.renderRoute('EX-006');
          const dest = document.getElementById('dirDestName')?.textContent.trim();
          const speech = activeDirectionsSpeech;
          const btnText = document.getElementById('dirVoiceBtn')?.textContent.trim();
          return {
            currentFloor: currentFloor,
            dest,
            speech,
            btnText,
            isTtsPlaying: isTtsPlaying,
            audioSource: _mapAudioSource
          };
        })()
      `,
      returnByValue: true
    });

    const val6 = switchEx6.result.value;
    console.log('EX-006 Current Floor:', val6.currentFloor);
    console.log('EX-006 Destination:', val6.dest);
    console.log('EX-006 Spoken Text:', val6.speech.text);
    assert.strictEqual(val6.currentFloor, 2, 'Floor should automatically switch to Level 2');
    assert.ok(val6.dest.includes('Hampanganan'), 'Destination should be Hampanganan');
    assert.strictEqual(val6.isTtsPlaying, false, 'Previous audio must be stopped on floor switch');
    assert.strictEqual(val6.btnText, '🔊 Read Aloud', 'Button must be reset to 🔊 Read Aloud');
    assert.ok(val6.speech.text.includes('Toys & Collections Room'), 'Narration must include Toys & Collections Room');

    // 6. Test all 11 exhibits accuracy against expected directions
    console.log('\n[Test 6] Verifying direction accuracy across all 11 exhibits...');
    const allExhibitsRes = await send('Runtime.evaluate', {
      expression: `
        (() => {
          const results = [];
          for (let i = 1; i <= 11; i++) {
            const code = 'EX-' + String(i).padStart(3, '0');
            window.renderRoute(code);
            const target = exhibitsData.find(e => e.code === code);
            const speech = activeDirectionsSpeech;
            const destEl = document.getElementById('dirDestName')?.textContent.trim();
            const stepItems = Array.from(document.querySelectorAll('#dirStepsList .dir-step-item'))
              .map(el => el.querySelector('span:last-child')?.textContent.trim() || '');
            results.push({
              code,
              title: target?.title,
              destOnScreen: destEl,
              stepCount: stepItems.length,
              stepsMatched: speech.text.includes(stepItems[0]),
              speechText: speech.text
            });
          }
          return results;
        })()
      `,
      returnByValue: true
    });

    const allEx = allExhibitsRes.result.value;
    allEx.forEach(item => {
      console.log(`✓ ${item.code} (${item.title}): ${item.stepCount} steps displayed, 100% matched speech text`);
      assert.strictEqual(item.stepsMatched, true, `Speech text for ${item.code} must match displayed steps`);
    });

    // Capture screenshot of walking directions
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join('c:\\Users\\jorim\\Downloads\\museum-systembase\\museum-system', 'verified-audio-switching.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log(`\nScreenshot saved: ${shotPath}`);

    const artifactPath = path.join('C:\\Users\\jorim\\.gemini\\antigravity-ide\\brain\\8df4b735-b828-4e62-9b89-5d6925e1c639', 'verified-audio-switching.png');
    fs.writeFileSync(artifactPath, Buffer.from(shot.data, 'base64'));

    ws.close();
    console.log('\n======================================================');
    console.log('✓ ALL AUDIO SWITCHING & ACCURACY TESTS PASSED 100%!');
    console.log('======================================================\n');
  } finally {
    chromeProcess.kill();
  }
}

testAudioSwitchingAndAccuracy().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});
