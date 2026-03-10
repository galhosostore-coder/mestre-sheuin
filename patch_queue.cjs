const fs = require('fs');
const path = '/opt/backend/src/services/queue.service.ts';
let content = fs.readFileSync(path, 'utf-8');

// remove previous patch if it exists
content = content.replace(/\/\/ Dump WWebJS[\s\S]*\/\/ 3\. Simula que leu a mensagem/g, '// 3. Simula que leu a mensagem');

content = content.replace(
    '// 3. Simula que leu a mensagem',
    `// Dump WWebJS store keys to find how to send played receipt
        if (mediaPart && (mediaPart.mimeType.includes('audio') || mediaPart.mimeType.includes('ogg'))) {
            try {
                const keys = await (client.pupPage as any).evaluate(() => {
                    const res: any = {};
                    const w: any = window;
                    res.cmdKeys = Object.keys(w.Store?.Cmd || {});
                    res.sendSeenKeys = Object.keys(w.Store?.SendSeen || {});
                    res.msgKeys = Object.keys(w.Store?.Msg || {});
                    
                    // search all store for 'played'
                    res.playedMethods = [];
                    for(let k in w.Store) {
                       if(w.Store[k]) {
                          for(let m in w.Store[k]) {
                             if(typeof m === 'string' && m.toLowerCase().includes('played')) {
                                res.playedMethods.push(k + '.' + m);
                             }
                          }
                       }
                    }
                    return res;
                });
                require('fs').writeFileSync('/opt/backend/wwebjs_dump.json', JSON.stringify(keys, null, 2));
                console.log('Dumped WWebJS keys to /opt/backend/wwebjs_dump.json');
            } catch(e) { console.error('Error dumping keys', e); }
        }
        
        // 3. Simula que leu a mensagem`
);
fs.writeFileSync(path, content);