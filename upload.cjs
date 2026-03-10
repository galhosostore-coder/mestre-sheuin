const { Client } = require('ssh2');
const fs = require('fs');

// Usa variável de ambiente para o host, com fallback para localhost
const host = process.env.SSH_HOST || 'localhost';
const username = 'root';
const password = process.env.SSH_PASSWORD || '1823ORav';

const localFile = process.argv[2];
const remoteFile = process.argv[3];

if (!localFile || !remoteFile) {
  console.error('Usage: node upload.cjs <localFile> <remoteFile>');
  process.exit(1);
}

const conn = new Client();
conn.on('ready', () => {
  conn.sftp((err, sftp) => {
    if (err) throw err;
    sftp.fastPut(localFile, remoteFile, (err) => {
      if (err) {
        console.error('Failed to upload file:', err);
        conn.end();
        process.exit(1);
      }
      console.log(`Successfully uploaded ${localFile} to ${remoteFile}`);
      conn.end();
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
