const fs = require('fs');
const path = require('path');

function esc(s){
  if(s === null || s === undefined) return 'NULL';
  return "'" + String(s).replace(/\\/g,'\\\\').replace(/'/g,"\\'") + "'";
}

function isoToMySQLDatetime(iso){
  if(!iso) return 'NULL';
  const d = new Date(iso);
  if(isNaN(d)) return esc(iso);
  // keep milliseconds
  const pad = n => String(n).padStart(2,'0');
  const ms = String(d.getUTCMilliseconds()).padStart(3,'0');
  return `'${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${ms}'`;
}

const repoRoot = path.join(__dirname, '..');
const dataPath = path.join(repoRoot, 'db', 'data.json');
const outPath = path.join(repoRoot, 'db', 'mysql_dump.sql');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

let out = '';
out += '-- MySQL dump generated from db/data.json\n';
out += 'SET FOREIGN_KEY_CHECKS=0;\n\n';

out += 'DROP TABLE IF EXISTS `scan_events`;\n';
out += `CREATE TABLE \`scan_events\` (\n  \`id\` VARCHAR(64) PRIMARY KEY,\n  \`exhibit_id\` VARCHAR(64) NOT NULL,\n  \`source\` VARCHAR(64),\n  \`at\` DATETIME(3)\n);\n\n`;

out += 'DROP TABLE IF EXISTS `ratings`;\n';
out += `CREATE TABLE \`ratings\` (\n  \`id\` VARCHAR(64) PRIMARY KEY,\n  \`visitor_id\` VARCHAR(128),\n  \`exhibit_id\` VARCHAR(64),\n  \`rating\` INT,\n  \`comment\` TEXT,\n  \`created_at\` DATETIME(3),\n  \`updated_at\` DATETIME(3)\n);\n\n`;

out += 'DROP TABLE IF EXISTS `favorites`;\n';
out += `CREATE TABLE \`favorites\` (\n  \`visitor_id\` VARCHAR(128) NOT NULL,\n  \`exhibit_id\` VARCHAR(64) NOT NULL,\n  \`created_at\` DATETIME(3),\n  PRIMARY KEY (\`visitor_id\`, \`exhibit_id\`)\n);\n\n`;

out += 'DROP TABLE IF EXISTS `exhibits`;\n';
out += `CREATE TABLE \`exhibits\` (\n  \`id\` VARCHAR(64) PRIMARY KEY,\n  \`code\` VARCHAR(64),\n  \`title\` VARCHAR(255),\n  \`category\` VARCHAR(128),\n  \`origin\` VARCHAR(255),\n  \`year\` VARCHAR(64),\n  \`location\` VARCHAR(255),\n  \`image_path\` TEXT,\n  \`description\` TEXT,\n  \`description_tl\` TEXT,\n  \`description_cb\` TEXT,\n  \`created_at\` DATETIME(3),\n  \`updated_at\` DATETIME(3)\n);\n\n`;

out += 'DROP TABLE IF EXISTS `users`;\n';
out += `CREATE TABLE \`users\` (\n  \`id\` VARCHAR(64) PRIMARY KEY,\n  \`username\` VARCHAR(128) UNIQUE,\n  \`password_hash\` VARCHAR(255),\n  \`role\` VARCHAR(64),\n  \`created_at\` DATETIME(3)\n);\n\n`;

// Inserts
if(Array.isArray(data.exhibits) && data.exhibits.length){
  out += '-- exhibits\n';
  data.exhibits.forEach(ex => {
    out += `INSERT INTO \`exhibits\` (id,code,title,category,origin,year,location,image_path,description,description_tl,description_cb,created_at,updated_at) VALUES (`+
      [esc(ex.id), esc(ex.code), esc(ex.title), esc(ex.category), esc(ex.origin), esc(ex.year), esc(ex.location), esc(ex.imagePath), esc(ex.description), esc(ex.description_tl), esc(ex.description_cb), isoToMySQLDatetime(ex.createdAt), isoToMySQLDatetime(ex.updatedAt)].join(',') +
      `);\n`;
  });
  out += '\n';
}

if(Array.isArray(data.users) && data.users.length){
  out += '-- users\n';
  data.users.forEach(u=>{
    out += `INSERT INTO \`users\` (id,username,password_hash,role,created_at) VALUES (`+
      [esc(u.id), esc(u.username), esc(u.passwordHash), esc(u.role), isoToMySQLDatetime(u.createdAt)].join(',') + `);\n`;
  });
  out += '\n';
}

if(Array.isArray(data.favorites) && data.favorites.length){
  out += '-- favorites\n';
  data.favorites.forEach(f=>{
    out += `INSERT INTO \`favorites\` (visitor_id,exhibit_id,created_at) VALUES (`+
      [esc(f.visitorId), esc(f.exhibitId), isoToMySQLDatetime(f.createdAt)].join(',') + `);\n`;
  });
  out += '\n';
}

if(Array.isArray(data.ratings) && data.ratings.length){
  out += '-- ratings\n';
  data.ratings.forEach(r=>{
    out += `INSERT INTO \`ratings\` (id,visitor_id,exhibit_id,rating,comment,created_at,updated_at) VALUES (`+
      [esc(r.id), esc(r.visitorId), esc(r.exhibitId), (r.rating==null? 'NULL': r.rating), esc(r.comment), isoToMySQLDatetime(r.createdAt), isoToMySQLDatetime(r.updatedAt)].join(',') + `);\n`;
  });
  out += '\n';
}

if(Array.isArray(data.scanEvents) && data.scanEvents.length){
  out += '-- scan_events\n';
  data.scanEvents.forEach(s=>{
    out += `INSERT INTO \`scan_events\` (id,exhibit_id,source,at) VALUES (`+
      [esc(s.id), esc(s.exhibitId), esc(s.source), isoToMySQLDatetime(s.at)].join(',') + `);\n`;
  });
  out += '\n';
}

out += 'SET FOREIGN_KEY_CHECKS=1;\n';

fs.writeFileSync(outPath, out, 'utf8');
console.log('Wrote', outPath);
