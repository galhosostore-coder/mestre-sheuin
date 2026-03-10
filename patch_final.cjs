const fs = require('fs');

const wFile = '/opt/backend/src/services/whatsapp.service.ts';
let wContent = fs.readFileSync(wFile, 'utf-8');

// Replace "const jobData: any = { userId, text };" with adding msgId
wContent = wContent.replace(
    'const jobData: any = { userId, text };',
    'const jobData: any = { userId, text, msgId: message.id._serialized };'
);
fs.writeFileSync(wFile, wContent);

const qFile = '/opt/backend/src/services/queue.service.ts';
let qContent = fs.readFileSync(qFile, 'utf-8');

// Add msgId to interface
qContent = qContent.replace(
    'export interface WhatsappMessageJobData {',
    `export interface WhatsappMessageJobData {
    msgId?: string;`
);

// Add the sendPlayed logic
const searchString = '// 3. Simula que leu a mensagem\n        await chat.sendSeen();';
const replaceString = `// 3. Simula que leu a mensagem
        await chat.sendSeen();

        // 3.1. Envia recibo de "Audio Reproduzido" (microfone azul) se for áudio
        if (job.data.msgId && mediaPart && (mediaPart.mimeType.includes('audio') || mediaPart.mimeType.includes('ogg'))) {
            await new Promise(resolve => setTimeout(resolve, 1500)); // Simula tempo entre ver a mensagem e apertar play
            try {
                await (client.pupPage as any).evaluate(async (msgId: string) => {
                    const w: any = window;
                    const msg = w.Store?.Msg?.get(msgId);
                    if (msg) {
                        // Tenta as diferentes formas que o WWebJS/WhatsApp usa para marcar áudio como reproduzido
                        if (w.Store.Cmd?.audioPlayed) {
                            await w.Store.Cmd.audioPlayed(msg);
                        } else if (w.Store.Cmd?.markMessagePlayed) {
                            await w.Store.Cmd.markMessagePlayed(msg);
                        } else if (w.Store.SendSeen?.markPlayed) {
                            await w.Store.SendSeen.markPlayed(msg);
                        } else if (w.Store.SendSeen?.sendPlayed) {
                            await w.Store.SendSeen.sendPlayed(msg);
                        } else {
                            // Se nenhum método direto estiver disponível, emite o Receipt manualmente (protocolo mais recente)
                            if (w.Store.Receipt && w.Store.Receipt.sendReceipt) {
                                await w.Store.Receipt.sendReceipt(msg.id.remote, msg.id.participant || msg.id.remote, [msg.id], 'played');
                            }
                        }
                    }
                }, job.data.msgId);
                console.log(\`[QueueService] Recibo de áudio reproduzido enviado para \${userId}\`);
            } catch (err) {
                console.error('[QueueService] Erro ao enviar recibo de áudio reproduzido:', err);
            }
        }`;

if (!qContent.includes('// 3.1. Envia recibo de "Audio Reproduzido"')) {
    qContent = qContent.replace(searchString, replaceString);
    // Cleanup previous patch
    qContent = qContent.replace(/\/\/ Dump WWebJS[\s\S]*?\/\/ 3\. Simula que leu a mensagem/g, '// 3. Simula que leu a mensagem');
    fs.writeFileSync(qFile, qContent);
}