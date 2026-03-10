const { Client } = require('ssh2');

// Usa variável de ambiente para o host, com fallback para localhost
const host = process.env.SSH_HOST || 'localhost';
const username = 'root';
const password = process.env.SSH_PASSWORD || '1823ORav';

const command = process.argv.slice(2).join(' ');

if (!command) {
  console.error('Please provide a command to run');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.exec(command, (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
      process.exit(code);
    }).on('data', (data) => {
      process.stdout.write(data);
    }).stderr.on('data', (data) => {
      process.stderr.write(data);
    });
  });
}).on('error', (err) => {
  console.error('Connection error:', err);
  process.exit(1);
}).connect({
  host,
  port: 22,
  username,
  password
});
