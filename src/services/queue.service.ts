import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';
import { memoryService } from './memory.service.js';
import { llmService } from './llm.service.js';
import { humanizationService } from './humanization.service.js';
import { audioService } from './audio.service.js';
import { imageService } from './image.service.js';
import { whatsappService } from './whatsapp.service.js';
import pkg from 'whatsapp-web.js';
const { MessageMedia } = pkg;

// Configuração de conexão com o Redis
const redisOptions = {
    maxRetriesPerRequest: null,
};

// Obtém a URL do Redis das variáveis de ambiente (obrigatória)
const redisUrl = process.env.REDIS_URL;
if (!redisUrl) {
  throw new Error('[QueueService] REDIS_URL não definida. Defina a variável de ambiente para produção.');
}

// @ts-ignore
const connection = new IORedis(redisUrl, redisOptions);

export interface WhatsappMessageJobData {
    userId: string;
    text: string;
    mediaPart?: {
        data: string;
        mimeType: string;
        msgId?: string;
    };
    teaTime?: boolean;
}

// ============================================
// FILA DE CONVERSAS (COM HUMANIZAÇÃO)
// ============================================
// Para mensagens de usuários - aplica delays de humanização
export const conversationsQueue = new Queue('whatsapp-conversations', { connection });

// Worker para fila de conversas (com humanização)
export const conversationsWorker = new Worker('whatsapp-conversations', async (job: Job<WhatsappMessageJobData>) => {
    const { userId, text, mediaPart } = job.data;
    const client = whatsappService.getClient();

    try {
        console.log(`[QueueService] Processando mensagem de ${userId} (Fila: conversations)`);

        // Verificação do Sono (Rotina Biológica)
        if (humanizationService.isSleepingTime()) {
            const delayMs = humanizationService.getMsUntilWakeUp();
            console.log(`[QueueService] Mestre está dormindo. Adiando mensagem de ${userId} em ${delayMs}ms (até as 06:00 BRT).`);
            
            // Re-enfileira a mensagem para ser processada pela manhã
            await conversationsQueue.add('process-message', job.data, {
                delay: delayMs,
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 1000,
                },
            });
            return; // Interrompe o processamento atual
        }

        // 1. Busca contexto
        const userContext = await memoryService.getUserContext(userId);

        // 2. Salva a mensagem recebida na memória
        const logMsg = text || (mediaPart ? '[Mídia Recebida]' : '');
        if (logMsg) {
            await memoryService.addMessage(userId, 'user', logMsg);
        }

        // Obtém o chat a partir do ID do usuário
        const chat = await client.getChatById(userId);

        // 3. Simula que leu a mensagem
        await chat.sendSeen();

        // 3.1. Envia recibo de "Audio Reproduzido" (microfone azul) se for áudio
        if (mediaPart && mediaPart.msgId && (mediaPart.mimeType.includes('audio') || mediaPart.mimeType.includes('ogg'))) {
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
                            // Protocolo de Receipt mais moderno
                            if (w.Store.Receipt && w.Store.Receipt.sendReceipt) {
                                await w.Store.Receipt.sendReceipt(msg.id.remote, msg.id.participant || msg.id.remote, [msg.id], 'played');
                            }
                        }
                    }
                }, mediaPart.msgId);
                console.log(`[QueueService] Recibo de áudio reproduzido enviado para ${userId}`);
            } catch (err) {
                console.error('[QueueService] Erro ao enviar recibo de áudio reproduzido:', err);
            }
        }

        // 3.5. Pausa para o Chá (5% de chance)
        if (!job.data.teaTime && Math.random() < 0.05) {
            console.log(`[QueueService] Pausa para o chá ativada para ${userId}`);
            // Calcula delay entre 10 e 15 minutos
            const teaDelayMs = Math.floor(Math.random() * (15 - 10 + 1) + 10) * 60 * 1000;
            
            // Re-enfileira a mensagem com delay e flag teaTime
            await conversationsQueue.add('process-message', { ...job.data, teaTime: true }, {
                delay: teaDelayMs,
                attempts: 3,
                backoff: { type: 'exponential', delay: 1000 }
            });
            return; // Encerra processamento atual, Mestre foi tomar chá
        }

        // Se voltou do chá, adiciona no texto para o LLM saber
        let promptText = text;
        if (job.data.teaTime) {
            promptText += "\n\n[Sistema: O Mestre visualizou a mensagem mas demorou alguns minutos para responder porque foi preparar um chá. Peça desculpas sutilmente pela demora inicial antes de continuar.]";
        }

        // 4. Chama o LLM para decidir a resposta
        const llmResponse = await llmService.generateResponse(promptText, userContext, mediaPart);

        // 5. Humanização: calcula o delay
        const delay = humanizationService.calculateDelay(llmResponse.text, llmResponse.type);

        // 6. Simula digitação ou gravação com Interrupção Cognitiva
        if (llmResponse.type === 'audio') {
            await chat.sendStateTyping();
            const typingSimDelay = Math.floor(Math.random() * 3000) + 2000; // 2 a 5 segundos de digitação falsa
            await new Promise(resolve => setTimeout(resolve, typingSimDelay));
            await chat.clearState();
            
            await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa breve
            
            await chat.sendStateRecording();
            const remainingDelay = Math.max(0, delay - typingSimDelay - 1000);
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
        } else {
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        await chat.clearState();

        // 8. Envia a resposta
        const finalText = humanizationService.injectTypos(llmResponse.text);

        if (llmResponse.type === 'audio') {
            try {
                let sentences: string[] = [finalText];
                if (finalText.length > 250) {
                    const parts = finalText.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [finalText];
                    
                    const filteredParts = parts.map(s => s.trim()).filter(s => s.length > 0);
                    const grouped: string[] = [];
                    let temp = "";
                    for (const s of filteredParts) {
                        temp += (temp ? " " : "") + s;
                        if (temp.length >= 40) {
                            grouped.push(temp);
                            temp = "";
                        }
                    }
                    if (temp) grouped.push(temp);
                    sentences = grouped.length > 0 ? grouped : [finalText];
                }

                for (let i = 0; i < sentences.length; i++) {
                    const sentence = sentences[i];
                    if (!sentence) continue;
                    
                    console.log(`[QueueService] Gerando áudio parte ${i+1}/${sentences.length} para ${userId}`);
                    await chat.sendStateRecording();
                    
                    const recordingDelay = Math.max(2000, sentence.length * 40);
                    await new Promise(resolve => setTimeout(resolve, recordingDelay));
                    
                    const base64Audio = await audioService.generateAudioFromText(sentence);
                    const media = new MessageMedia('audio/mp3', base64Audio, 'audio.mp3');
                    await client.sendMessage(userId, media, { sendAudioAsVoice: true });
                    
                    if (i < sentences.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 2000));
                    }
                }
                await memoryService.addMessage(userId, 'assistant', `[Áudio enviado em partes] ${finalText}`);
            } catch (audioError) {
                console.error('[QueueService] Erro ao enviar áudio, enviando texto como fallback:', audioError);
                await client.sendMessage(userId, finalText);
                await memoryService.addMessage(userId, 'assistant', finalText);
            }
        } else if (llmResponse.type === 'image' && llmResponse.imageTheme) {
            try {
                const result = await imageService.generateOrGetImage(llmResponse.imageTheme);
                const extension = result.mimeType.split('/')[1] || 'png';
                const media = new MessageMedia(result.mimeType, result.data, `imagem.${extension}`);
                await client.sendMessage(userId, media, { caption: finalText });
                await memoryService.addMessage(userId, 'assistant', `[Imagem enviada: ${llmResponse.imageTheme}] ${finalText}`);
            } catch (imageError) {
                console.error('[QueueService] Erro ao enviar imagem, enviando texto como fallback:', imageError);
                await client.sendMessage(userId, finalText);
                await memoryService.addMessage(userId, 'assistant', finalText);
            }
        } else {
            await client.sendMessage(userId, finalText);
            await memoryService.addMessage(userId, 'assistant', finalText);
        }

        console.log(`[QueueService] Mensagem processada com sucesso para ${userId}`);
    } catch (error) {
        console.error(`[QueueService] Erro ao processar job ${job.id} para ${userId}:`, error);
        throw error;
    }
}, {
    connection,
    // Processa no máximo 3 mensagens simultaneamente para evitar banimento do WhatsApp
    concurrency: 3,
});

conversationsWorker.on('completed', job => {
    console.log(`[QueueService] Job ${job.id} concluído (conversations)`);
});

conversationsWorker.on('failed', (job, err) => {
    console.error(`[QueueService] Job ${job?.id} falhou (conversations):`, err);
});

// ============================================
// FILA DE SISTEMA (SEM HUMANIZAÇÃO)
// ============================================
// Para webhooks, agendamentos e eventos do sistema - SEM delays
export const systemQueue = new Queue('whatsapp-system', { connection });

// Worker para fila de sistema (sem humanização)
export const systemWorker = new Worker('whatsapp-system', async (job: Job<WhatsappMessageJobData>) => {
    const { userId, text, mediaPart } = job.data;
    const client = whatsappService.getClient();

    try {
        console.log(`[QueueService] Processando mensagem de ${userId} (Fila: system)`);

        // 1. Busca contexto
        const userContext = await memoryService.getUserContext(userId);

        // 2. Salva a mensagem recebida na memória
        const logMsg = text || (mediaPart ? '[Mídia Recebida]' : '');
        if (logMsg) {
            await memoryService.addMessage(userId, 'user', logMsg);
        }

        // Obtém o chat a partir do ID do usuário
        const chat = await client.getChatById(userId);

        // 3. Simula que leu a mensagem
        await chat.sendSeen();

        // 3.1. Envia recibo de "Audio Reproduzido" se for áudio
        if (mediaPart && mediaPart.msgId && (mediaPart.mimeType.includes('audio') || mediaPart.mimeType.includes('ogg'))) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            try {
                await (client.pupPage as any).evaluate(async (msgId: string) => {
                    const w: any = window;
                    const msg = w.Store?.Msg?.get(msgId);
                    if (msg) {
                        if (w.Store.Cmd?.audioPlayed) {
                            await w.Store.Cmd.audioPlayed(msg);
                        } else if (w.Store.Cmd?.markMessagePlayed) {
                            await w.Store.Cmd.markMessagePlayed(msg);
                        } else if (w.Store.SendSeen?.markPlayed) {
                            await w.Store.SendSeen.markPlayed(msg);
                        } else if (w.Store.SendSeen?.sendPlayed) {
                            await w.Store.SendSeen.sendPlayed(msg);
                        } else {
                            if (w.Store.Receipt && w.Store.Receipt.sendReceipt) {
                                await w.Store.Receipt.sendReceipt(msg.id.remote, msg.id.participant || msg.id.remote, [msg.id], 'played');
                            }
                        }
                    }
                }, mediaPart.msgId);
                console.log(`[QueueService] Recibo de áudio reproduzido enviado para ${userId}`);
            } catch (err) {
                console.error('[QueueService] Erro ao enviar recibo de áudio reproduzido:', err);
            }
        }

        // NOTA: Nenhuma verificação de sono ou pausa para chá na fila de sistema
        // Mensagens do sistema devem ser processadas imediatamente

        // 4. Chama o LLM para decidir a resposta
        const llmResponse = await llmService.generateResponse(text, userContext, mediaPart);

        // 5. Humanização: calcula o delay (mas para sistema, usamos delay mínimo)
        // Para system, usamos um delay fixo menor para simular resposta rápida
        const delay = llmResponse.type === 'audio' ? 2000 : 1000; // 2s para áudio, 1s para texto

        // 6. Simula digitação ou gravação (delay reduzido)
        if (llmResponse.type === 'audio') {
            await chat.sendStateTyping();
            const typingSimDelay = Math.floor(Math.random() * 1000) + 500; // 0.5 a 1.5s
            await new Promise(resolve => setTimeout(resolve, typingSimDelay));
            await chat.clearState();
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Pausa breve
            
            await chat.sendStateRecording();
            const remainingDelay = Math.max(0, delay - typingSimDelay - 500);
            await new Promise(resolve => setTimeout(resolve, remainingDelay));
        } else {
            await chat.sendStateTyping();
            await new Promise(resolve => setTimeout(resolve, delay));
        }
        await chat.clearState();

        // 8. Envia a resposta
        const finalText = humanizationService.injectTypos(llmResponse.text);

        if (llmResponse.type === 'audio') {
            try {
                let sentences: string[] = [finalText];
                if (finalText.length > 250) {
                    const parts = finalText.match(/[^.!?]+[.!?]+(?:\s+|$)/g) || [finalText];
                    
                    const filteredParts = parts.map(s => s.trim()).filter(s => s.length > 0);
                    const grouped: string[] = [];
                    let temp = "";
                    for (const s of filteredParts) {
                        temp += (temp ? " " : "") + s;
                        if (temp.length >= 40) {
                            grouped.push(temp);
                            temp = "";
                        }
                    }
                    if (temp) grouped.push(temp);
                    sentences = grouped.length > 0 ? grouped : [finalText];
                }

                for (let i = 0; i < sentences.length; i++) {
                    const sentence = sentences[i];
                    if (!sentence) continue;
                    
                    console.log(`[QueueService] Gerando áudio parte ${i+1}/${sentences.length} para ${userId}`);
                    await chat.sendStateRecording();
                    
                    const recordingDelay = Math.max(1000, sentence.length * 20); // Mais rápido para system
                    await new Promise(resolve => setTimeout(resolve, recordingDelay));
                    
                    const base64Audio = await audioService.generateAudioFromText(sentence);
                    const media = new MessageMedia('audio/mp3', base64Audio, 'audio.mp3');
                    await client.sendMessage(userId, media, { sendAudioAsVoice: true });
                    
                    if (i < sentences.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Menor intervalo
                    }
                }
                await memoryService.addMessage(userId, 'assistant', `[Áudio enviado em partes] ${finalText}`);
            } catch (audioError) {
                console.error('[QueueService] Erro ao enviar áudio, enviando texto como fallback:', audioError);
                await client.sendMessage(userId, finalText);
                await memoryService.addMessage(userId, 'assistant', finalText);
            }
        } else if (llmResponse.type === 'image' && llmResponse.imageTheme) {
            try {
                const result = await imageService.generateOrGetImage(llmResponse.imageTheme);
                const extension = result.mimeType.split('/')[1] || 'png';
                const media = new MessageMedia(result.mimeType, result.data, `imagem.${extension}`);
                await client.sendMessage(userId, media, { caption: finalText });
                await memoryService.addMessage(userId, 'assistant', `[Imagem enviada: ${llmResponse.imageTheme}] ${finalText}`);
            } catch (imageError) {
                console.error('[QueueService] Erro ao enviar imagem, enviando texto como fallback:', imageError);
                await client.sendMessage(userId, finalText);
                await memoryService.addMessage(userId, 'assistant', finalText);
            }
        } else {
            await client.sendMessage(userId, finalText);
            await memoryService.addMessage(userId, 'assistant', finalText);
        }

        console.log(`[QueueService] Mensagem processada com sucesso para ${userId} (system)`);
    } catch (error) {
        console.error(`[QueueService] Erro ao processar job ${job.id} para ${userId}:`, error);
        throw error;
    }
}, {
    connection,
    // Maior concorrência para system, pois não há risco de anti-spam
    concurrency: 10,
});

systemWorker.on('completed', job => {
    console.log(`[QueueService] Job ${job.id} concluído (system)`);
});

systemWorker.on('failed', (job, err) => {
    console.error(`[QueueService] Job ${job?.id} falhou (system):`, err);
});

// ============================================
// FUNÇÕES DE ACESSO PÚBLICO
// ============================================

// Função para adicionar mensagens à fila de conversations (com humanização)
export async function addToConversationsQueue(data: WhatsappMessageJobData, delayMs: number = 0) {
    await conversationsQueue.add('process-message', data, {
        attempts: 3,
        delay: delayMs,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    });
}

// Função para adicionar mensagens à fila de system (sem humanização)
export async function addToSystemQueue(data: WhatsappMessageJobData, delayMs: number = 0) {
    await systemQueue.add('process-message', data, {
        attempts: 3,
        delay: delayMs,
        backoff: {
            type: 'exponential',
            delay: 1000,
        },
    });
}

// Mantém compatibilidade - redireciona para conversationsQueue
export async function addMessageToQueue(data: WhatsappMessageJobData, delayMs: number = 0) {
  await addToConversationsQueue(data, delayMs);
}

/**
 * Health check para verificar conexão com Redis
 */
export async function healthCheckRedis(): Promise<{ status: string; error?: string }> {
  try {
    // Envia comando PING para verificar se o Redis está respondendo
    const response = await connection.ping();
    if (response === 'PONG') {
      return { status: 'connected' };
    }
    return { status: 'disconnected', error: 'Redis did not respond with PONG' };
  } catch (error: any) {
    return { status: 'error', error: error.message || 'Redis connection failed' };
  }
}
