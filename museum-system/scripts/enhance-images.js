const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { fileURLToPath } = require('url');

const ROOT = path.join(__dirname, '..');
const DATA_PATH = path.join(ROOT, 'db', 'data.json');
const UPLOADS = path.join(ROOT, 'uploads');
const OPT_DIR = path.join(UPLOADS, 'optimized');

async function fetchBuffer(url){
  const res = await fetch(url);
  if(!res.ok) throw new Error('Failed to fetch ' + url);
  return Buffer.from(await res.arrayBuffer());
}

function hashName(src){
  return crypto.createHash('sha1').update(src).digest('hex') + '.jpg';
}

async function processBuffer(buf, outPath){
  await sharp(buf)
    .resize({ width: 1600, withoutEnlargement: true })
    .rotate()
    .sharpen()
    .jpeg({ quality: 85 })
    .toFile(outPath);
}

function ensureDir(dir){ if(!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }

async function enhanceImage(src){
  if(!src) return null;
  try{
    ensureDir(OPT_DIR);
    const fileName = hashName(src);
    const outPath = path.join(OPT_DIR, fileName);
    if(fs.existsSync(outPath)) return '/uploads/optimized/' + fileName;

    let buf = null;
    if(src.startsWith('http://') || src.startsWith('https://')){
      buf = await fetchBuffer(src);
    }else if(src.startsWith('/uploads/') || src.startsWith('uploads/')){
      const local = path.join(ROOT, src.replace(/^\//, ''));
      if(fs.existsSync(local)) buf = fs.readFileSync(local);
      else return null;
    }else if(fs.existsSync(path.join(ROOT, src))){
      buf = fs.readFileSync(path.join(ROOT, src));
    }else{
      // unknown format
      return null;
    }

    await processBuffer(buf, outPath);
    return '/uploads/optimized/' + fileName;
  }catch(err){
    console.error('Enhance failed for', src, err.message);
    return null;
  }
}

async function enhanceAll(){
  const data = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  // fields to check: exhibits[].imagePath, gallery[].imagePath, programs[].imagePath, events[].imagePath
  const lists = [
    { list: data.exhibits, field: 'imagePath' },
    { list: data.gallery, field: 'imagePath' },
    { list: data.programs, field: 'imagePath' },
    { list: data.events, field: 'imagePath' }
  ];

  for(const group of lists){
    for(const item of group.list){
      const src = item[group.field];
      if(!src) continue;
      try{
        const optimized = await enhanceImage(src);
        if(optimized){
          item.optimizedImagePath = optimized;
          console.log('Optimized', src, '->', optimized);
        }
      }catch(e){
        console.error('Error optimizing', src, e.message);
      }
    }
  }

  fs.writeFileSync(DATA_PATH, JSON.stringify(data, null, 2), 'utf8');
  console.log('Enhancement complete. Updated', DATA_PATH);
}

enhanceAll().catch(err=>{ console.error(err); process.exit(1); });
