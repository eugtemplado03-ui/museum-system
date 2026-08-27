async function test() {
  const text = "One of the museum's eight permanent exhibits, following freshwater systems on their way toward the sea — part of the museum's broader effort to build appreciation for Negros' marine and coastal environment.";
  console.log("Original text length:", text.length);

  function splitIntoChunks(str, maxLen = 140) {
    const sentences = str.match(/[^.!?—–\n]+[.!?—–\n]+|[^.!?—–\n]+$/g) || [str];
    const chunks = [];
    let current = '';

    for (const s of sentences) {
      const trimmed = s.trim();
      if (!trimmed) continue;
      if ((current + ' ' + trimmed).trim().length <= maxLen) {
        current = (current + ' ' + trimmed).trim();
      } else {
        if (current) chunks.push(current);
        if (trimmed.length > maxLen) {
          // split by commas or words
          const words = trimmed.split(' ');
          let sub = '';
          for (const w of words) {
            if ((sub + ' ' + w).trim().length <= maxLen) {
              sub = (sub + ' ' + w).trim();
            } else {
              if (sub) chunks.push(sub);
              sub = w;
            }
          }
          if (sub) current = sub;
        } else {
          current = trimmed;
        }
      }
    }
    if (current) chunks.push(current);
    return chunks;
  }

  const chunks = splitIntoChunks(text);
  console.log("Chunks:", chunks);

  const buffers = [];
  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=tl&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' } });
    console.log(`Chunk "${chunk.slice(0, 30)}..." status:`, res.status);
    if (res.ok) {
      const buf = await res.arrayBuffer();
      buffers.push(Buffer.from(buf));
    }
  }

  const total = Buffer.concat(buffers);
  console.log("Total audio buffer size in bytes:", total.length);
}

test().catch(console.error);
