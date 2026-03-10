const https = require('https');
const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;

https.get(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const models = JSON.parse(data).models;
    if (models) {
      models.forEach(m => {
         if (m.name.includes('pro')) console.log(m.name);
      });
      console.log('--- FLASH MODELS ---');
      models.forEach(m => {
         if (m.name.includes('flash')) console.log(m.name);
      });
    } else {
      console.log('No models or error:', data);
    }
  });
}).on('error', err => console.log('Error:', err.message));
