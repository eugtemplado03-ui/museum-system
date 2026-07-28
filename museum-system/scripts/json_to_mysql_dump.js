const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '..', 'db', 'data.json');
const outDir = path.join(__dirname, '..', 'migrations');
const out = path.join(outDir, 'data_dump.sql');

function esc(s){
  if(s === null || s === undefined) return 'NULL';
  if(typeof s === 'number') return s;
  // convert boolean
  if(typeof s === 'boolean') return s ? '1' : '0';
  return "'" + String(s).replace(/\\/g,'\\\\').replace(/'/g, "''") + "'";
}

if(!fs.existsSync(src)){
  console.error('Source file not found:', src);
  process.exit(1);
}
if(!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const data = JSON.parse(fs.readFileSync(src, 'utf8'));
let sql = '';

sql += "-- MySQL dump generated from db/data.json\n";
sql += "-- Tables: users, exhibits, favorites, ratings, scanEvents\n\n";

sql += `DROP TABLE IF EXISTS users;\n`;
sql += `CREATE TABLE users (\n  id VARCHAR(64) PRIMARY KEY,\n  username VARCHAR(255),\n  passwordHash VARCHAR(512),\n  role VARCHAR(64),\n  createdAt VARCHAR(64)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

sql += `DROP TABLE IF EXISTS exhibits;\n`;
sql += `CREATE TABLE exhibits (\n  id VARCHAR(64) PRIMARY KEY,\n  code VARCHAR(64),\n  title TEXT,\n  category VARCHAR(255),\n  origin TEXT,\n  year VARCHAR(128),\n  location VARCHAR(255),\n  imagePath TEXT,\n  description TEXT,\n  description_tl TEXT,\n  description_cb TEXT,\n  createdAt VARCHAR(64),\n  updatedAt VARCHAR(64)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

sql += `DROP TABLE IF EXISTS favorites;\n`;
sql += `CREATE TABLE favorites (\n  id VARCHAR(64) PRIMARY KEY,\n  userId VARCHAR(64),\n  exhibitId VARCHAR(64),\n  createdAt VARCHAR(64)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

sql += `DROP TABLE IF EXISTS ratings;\n`;
sql += `CREATE TABLE ratings (\n  id VARCHAR(64) PRIMARY KEY,\n  visitorId VARCHAR(128),\n  exhibitId VARCHAR(64),\n  rating INT,\n  comment TEXT,\n  createdAt VARCHAR(64),\n  updatedAt VARCHAR(64)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

sql += `DROP TABLE IF EXISTS scanEvents;\n`;
sql += `CREATE TABLE scanEvents (\n  id VARCHAR(64) PRIMARY KEY,\n  exhibitId VARCHAR(64),\n  source VARCHAR(64),\n  at VARCHAR(64)\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n`;

// Inserts
function insertRows(table, rows, columns){
  if(!rows || rows.length === 0) return '';
  let out = `-- Inserts for ${table}\n`;
  rows.forEach(r=>{
    const vals = columns.map(c => esc(r[c] === undefined ? null : r[c]));
    out += `INSERT INTO ${table} (${columns.join(',')}) VALUES (${vals.join(',')});\n`;
  });
  out += '\n';
  return out;
}

sql += insertRows('users', data.users || [], ['id','username','passwordHash','role','createdAt']);
sql += insertRows('exhibits', data.exhibits || [], ['id','code','title','category','origin','year','location','imagePath','description','description_tl','description_cb','createdAt','updatedAt']);
sql += insertRows('favorites', data.favorites || [], ['id','userId','exhibitId','createdAt']);
sql += insertRows('ratings', data.ratings || [], ['id','visitorId','exhibitId','rating','comment','createdAt','updatedAt']);
sql += insertRows('scanEvents', data.scanEvents || [], ['id','exhibitId','source','at']);

fs.writeFileSync(out, sql, 'utf8');
console.log('Wrote SQL dump to', out);
