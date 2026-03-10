import fs from 'fs';
const content = fs.readFileSync('/opt/backend/src/services/whatsapp.service.ts', 'utf-8');

// First remove the old patch if it exists (simplistic cleanup)
let cleanContent = content;
const evalBlockStart = cleanContent.indexOf("if (text && text.startsWith('!eval ')) {");
if (evalBlockStart !== -1) {
    const prevReturn = cleanContent.lastIndexOf("if (chat.isGroup) return;\n\n", evalBlockStart);
    if (prevReturn !== -1) {
        // the patch was inserted after if (chat.isGroup) return;
        cleanContent = cleanContent.substring(0, prevReturn + 26) + cleanContent.substring(cleanContent.indexOf("return;\n        }", evalBlockStart) + 18);
    }
}

// Now apply correctly after `const text = message.body;`
const newContent = cleanContent.replace(
  'const text = message.body;',
  `const text = message.body;

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