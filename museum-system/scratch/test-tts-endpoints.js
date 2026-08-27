async function test() {
  const riverText = "One of the museum's eight permanent exhibits, following freshwater systems on their way toward the sea — part of the museum's broader effort to build appreciation for Negros' marine and coastal environment.";
  
  console.log("=== Testing Translation API for 'The River' ===");
  const transResp = await fetch('http://localhost:3000/api/tts/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: riverText, targetLang: 'tl' })
  });
  console.log("Translation Status:", transResp.status);
  const transData = await transResp.json();
  console.log("Translated text (tl):", transData.translatedText);

  console.log("\n=== Testing TTS Speak API for 'The River' (Tagalog) ===");
  const speakResp = await fetch('http://localhost:3000/api/tts/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: transData.translatedText || riverText, lang: 'tl' })
  });
  console.log("Speak Status:", speakResp.status);
  console.log("Content-Type:", speakResp.headers.get('content-type'));
  console.log("Content-Length:", speakResp.headers.get('content-length'));

  console.log("\n=== Testing TTS Speak API for 'Under the Sea' (English) ===");
  const underSeaText = "The museum's flagship exhibit on the marine environment — how sand forms, how coral reefs grow and the threats facing them, marine mammals, and the role mangroves play along the coast.";
  const speakResp2 = await fetch('http://localhost:3000/api/tts/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: underSeaText, lang: 'en' })
  });
  console.log("Speak 2 Status:", speakResp2.status);
  console.log("Content-Length 2:", speakResp2.headers.get('content-length'));
}

test().catch(console.error);
