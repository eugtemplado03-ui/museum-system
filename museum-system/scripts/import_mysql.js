const fs = require('fs');
const path = require('path');
const readline = require('readline');

function ask(q){
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(q, ans => { rl.close(); resolve(ans); }));
}

(async function(){
  const args = require('minimist')(process.argv.slice(2));
  const host = args.host || process.env.MYSQL_HOST || 'localhost';
  const user = args.user || process.env.MYSQL_USER || 'root';
  const database = args.database || process.env.MYSQL_DB || 'museum_db';
  const sqlPath = path.join(__dirname, '..', 'db', 'mysql_dump.sql');
  if(!fs.existsSync(sqlPath)){
    console.error('SQL file not found:', sqlPath);
    process.exit(1);
  }
  const password = process.env.MYSQL_PWD || await ask(`Password for ${user}@${host}: `);

  const mysql = require('mysql2/promise');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  const conn = await mysql.createConnection({ host, user, password, multipleStatements: true });
  try{
    console.log('Importing into database', database, 'on', host);
    // ensure database exists
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await conn.query(`USE \`${database}\`;`);
    // execute full script
    await conn.query(sql);
    console.log('Import completed successfully.');
  }catch(err){
    console.error('Import failed:', err.message || err);
    process.exit(2);
  }finally{
    await conn.end();
  }
})();
