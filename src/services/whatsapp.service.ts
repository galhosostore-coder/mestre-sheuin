import pkg from 'whatsapp-web.js';
const { Client, LocalAuth, MessageMedia } = pkg;
import type { Client as ClientType } from 'whatsapp-web.js';
import qrcode from 'qrcode-terminal';
import { memoryService } from './memory.service.js';
import { llmService } from './llm.service.js';
import { humanizationService } from './humanization.service.js';
import { audioService } from './audio.service.js';
import { addToConversationsQueue } from './queue.service.js';

export class WhatsappService {
  private client: ClientType;
  private messageBuffer: Map<string, {
    texts: string[];
    mediaParts: Array<{ data: string; mimeType: string, msgId: string }>;
    timeoutId: NodeJS.Timeout;
  }> = new Map();

  constructor() {
    this.client = new Client({
      authStrategy: new LocalAuth(),
      puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });
  }

  private setupEvents() {
    this.client.on('qr', (qr) => {
      qrcode.generate(qr, { small: true });
      console.log('[WhatsappService] QR Code gerado, escaneie com seu WhatsApp.');
    });

    this.client.on('ready', () => {
      console.log('[WhatsappService] Cliente WhatsApp está pronto!');
    });

    this.client.on('message', async (message) => {
      try {
        if (message.from === 'status@broadcast' || message.isStatus) return;
        
        const chat = await message.getChat();
        if (chat.isGroup) return;

        const userId = message.from;
        const text = message.body;

        let mediaPart: { data: string; mimeType: string, msgId: string } | undefined;
        if (message.hasMedia || message.type === 'ptt' || message.type === 'audio') {
          try {
            const media = await message.downloadMedia();
            if (media) {
              const originalMime = media.mimetype || 'unknown';
              let cleanMimeType = originalMime.split(';')[0];
              
              // Tentar forçar como audio/mp3 para evitar bug no gemini-lite com OGG
              if (cleanMimeType === 'audio/ogg' || originalMime.includes('codecs=opus')) {
                cleanMimeType = 'audio/mp3';
              }

              console.log(`[WhatsappService] Mídia recebida: OriginalMime=${originalMime}, CleanMimeForçado=${cleanMimeType}, Base64Length=${media.data?.length || 0}`);
              
              mediaPart = {
                data: media.data || '',
                mimeType: cleanMimeType || 'application/octet-stream',
                msgId: message.id._serialized
              };
            }
          } catch (error) {
            console.error('[WhatsappService] Erro ao baixar mídia:', error);
          }
        }

        let delayJob = 0;
        if (humanizationService.isSleepingTime()) {
          delayJob = humanizationService.getMsUntilWakeUp();
          console.log(`[WhatsappService] Mestre está dormindo. Mensagem de ${userId} agendada para daqui a ${Math.round(delayJob/1000/60)} minutos.`);
        }

        // Recupera ou cria o buffer do usuário
        let userBuffer = this.messageBuffer.get(userId);
        if (userBuffer) {
          clearTimeout(userBuffer.timeoutId);
        } else {
          userBuffer = { texts: [], mediaParts: [], timeoutId: setTimeout(() => {}, 0) };
          this.messageBuffer.set(userId, userBuffer);
        }

        if (text) {
          userBuffer.texts.push(text);
        }
        if (mediaPart) {
          userBuffer.mediaParts.push(mediaPart);
        }

        userBuffer.timeoutId = setTimeout(async () => {
          this.messageBuffer.delete(userId);
          
          const compiledText = userBuffer!.texts.join('\n\n');
          // Para simplificar, envia a primeira mídia se houver várias
          const compiledMedia = userBuffer!.mediaParts.length > 0 ? userBuffer!.mediaParts[0] : undefined;
          
          const jobData: any = { userId, text: compiledText };
          if (compiledMedia) {
            jobData.mediaPart = compiledMedia;
          }

          // Adiciona à fila de conversations (com humanização)
          await addToConversationsQueue(jobData, delayJob);
          console.log(`[WhatsappService] Mensagens compiladas de ${userId} enfileiradas. Total textos: ${userBuffer!.texts.length}, Total mídias: ${userBuffer!.mediaParts.length}`);
        }, 10000); // 10 segundos de debounce


      } catch (error) {
        console.error('[WhatsappService] Erro ao processar mensagem:', error);
      }
    });
  }

  public async start(): Promise<void> {
    this.setupEvents();
    await this.client.initialize();
  }

  public getClient(): ClientType {
    return this.client;
  }

  public async healthCheck(): Promise<{ status: string; error?: string }> {
    try {
      const client = this.getClient();

      // Verifica se o cliente está conectado através de propriedades disponíveis
      // pupPage existe quando o cliente está autenticado e a página está carregada
      if (client.pupPage) {
        return { status: 'connected' };
      }

      // Se não está conectado mas não houve erro, retorna desconectado
      return { status: 'disconnected', error: 'WhatsApp client not ready' };
    } catch (error: any) {
      return { status: 'error', error: error.message || 'Unknown error checking WhatsApp connection' };
    }
  }
}

export const whatsappService = new WhatsappService();
