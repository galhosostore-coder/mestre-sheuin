import * as dotenv from 'dotenv';
import { Redis } from 'ioredis';
import { createHash } from 'crypto';

dotenv.config();

export class AudioService {
  private voiceId: string;
  private modelId: string;
  private redis: Redis | null = null;
  private readonly DEFAULT_SPLIT_LENGTH = 250;
  private readonly CONVERSATION_PAUSE_MS = 800;
  private readonly SYSTEM_PAUSE_MS = 500;
  private readonly FETCH_TIMEOUT_MS = 30000;
  private readonly MAX_RETRIES = 3;
  private readonly BASE_DELAY_MS = 1000;

  constructor() {
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || '8TMmdpPgqHKvDOGYP2lN';
    this.modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v3';

    // Initialize Redis if connection info is available
    const redisUrl = process.env.REDIS_URL;
    if (redisUrl) {
      const redisOptions = {
        maxRetriesPerRequest: 3,
        password: process.env.REDIS_PASSWORD,
        db: parseInt(process.env.REDIS_DB || '0'),
      };

      // @ts-ignore - ioredis type definitions may vary
      this.redis = new Redis(redisUrl as any, redisOptions);

      this.redis.on('error', (err: Error) => {
        console.error('[AudioService] Redis error:', err.message);
      });
    }
  }

  /**
   * Health check do serviço
   */
  public async healthCheck(): Promise<{ status: string; redis: boolean; apiKey: boolean }> {
    const redisHealthy = this.redis 
      ? await this.redis.ping().then(() => true).catch(() => false)
      : false;
    
    const apiKey = !!process.env.ELEVENLABS_API_KEY;

    return {
      status: apiKey ? 'healthy' : 'missing_api_key',
      redis: redisHealthy,
      apiKey,
    };
  }

  /**
   * Validação de entrada
   */
  private validateInput(text: string): void {
    if (!text || !text.trim()) {
      throw new Error('Texto vazio não é permitido');
    }
    if (text.length > 5000) {
      throw new Error('Texto excede 5000 caracteres');
    }
  }

  /**
   * Gera áudio a partir do texto, com cache, retry e timeout
   */
  public async generateAudioFromText(text: string): Promise<string> {
    this.validateInput(text);

    const cacheKey = this.getCacheKey(text);
    
    // Try cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (err) {
        console.warn('[AudioService] Cache read error:', err);
      }
    }

    // Fetch from API with retry and timeout
    const base64Audio = await this.retryWithBackoff(
      () => this.fetchAudioWithTimeout(text),
      this.MAX_RETRIES,
      this.BASE_DELAY_MS
    );

    // Save to cache
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, 24 * 60 * 60, base64Audio); // 24 hours TTL
      } catch (err) {
        console.warn('[AudioService] Cache write error:', err);
      }
    }

    return base64Audio;
  }

  /**
   * Gera áudio em múltiplas partes (para textos longos)
   */
  public async generateAudioFromTextSplit(text: string): Promise<string[]> {
    this.validateInput(text);
    
    const parts = this.splitIntoParts(text, this.DEFAULT_SPLIT_LENGTH);
    const audios: string[] = [];

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const audio = await this.generateAudioFromText(part);
      audios.push(audio);

      // Pause between parts (except last)
      if (i < parts.length - 1) {
        const pauseMs = this.shouldAddConversationPause(parts[i], parts[i + 1])
          ? this.CONVERSATION_PAUSE_MS
          : this.SYSTEM_PAUSE_MS;
        
        await this.delay(pauseMs);
      }
    }

    return audios;
  }

  /**
   * Fetch com timeout usando AbortController
   */
  private async fetchAudioWithTimeout(text: string): Promise<string> {
    const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
    if (!elevenLabsKey) {
      throw new Error('ELEVENLABS_API_KEY is missing');
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${this.voiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: this.modelId,
          }),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs Error (${response.status}): ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64Audio = Buffer.from(arrayBuffer).toString('base64');
      
      // Log only metrics, not full content
      console.log(`[AudioService] Generated audio: ${arrayBuffer.byteLength} bytes`);
      
      return base64Audio;
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Timeout: requisição excedeu 30 segundos');
      }
      throw error;
    }
  }

  /**
   * Retry com backoff exponencial
   */
  private async retryWithBackoff<T>(
    asyncFn: () => Promise<T>,
    maxRetries: number,
    baseDelay: number
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await asyncFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) {
          break;
        }

        // Exponential backoff with jitter
        const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
        console.log(`[AudioService] Retry ${attempt + 1}/${maxRetries} after ${Math.round(delay)}ms`);
        await this.delay(delay);
      }
    }

    throw lastError;
  }

  /**
   * Divide texto em partes inteligentes
   */
  private splitIntoParts(text: string, maxLength: number): string[] {
    // First try by sentences
    const sentences = this.splitBySentences(text);
    const parts: string[] = [];
    let currentPart = '';

    for (const sentence of sentences) {
      if (sentence.length > maxLength) {
        // Sentence too long, split by clauses
        const clauses = this.splitByClauses(sentence, maxLength);
        for (const clause of clauses) {
          if ((currentPart + ' ' + clause).length > maxLength && currentPart) {
            parts.push(currentPart.trim());
            currentPart = clause;
          } else {
            currentPart = currentPart ? currentPart + ' ' + clause : clause;
          }
        }
      } else if ((currentPart + ' ' + sentence).length > maxLength) {
        parts.push(currentPart.trim());
        currentPart = sentence;
      } else {
        currentPart = currentPart ? currentPart + ' ' + sentence : sentence;
      }
    }

    if (currentPart.trim()) {
      parts.push(currentPart.trim());
    }

    // Ensure no part exceeds maxLength (fallback word split)
    return this.ensurePartsWithinLimit(parts, maxLength);
  }

  private splitBySentences(text: string): string[] {
    // Split by sentence terminators while preserving them
    const regex = /([^.!?]+[.!?]+(?:\s+|$))/g;
    const matches = text.match(regex);
    return matches || [text];
  }

  private splitByClauses(text: string, maxLength: number): string[] {
    // Try by commas and conjunctions first
    const clauseRegex = /([^,;]+[,;]|\s+e\s+|,\s+mas\s+|,\s+ou\s+)/gi;
    const clauses = text.match(clauseRegex) || [text];
    
    if (clauses.length > 1) {
      return clauses;
    }

    // Fallback: split by words
    const words = text.split(' ');
    const result: string[] = [];
    let current = '';

    for (const word of words) {
      if ((current + ' ' + word).length > maxLength && current) {
        result.push(current.trim());
        current = word;
      } else {
        current = current ? current + ' ' + word : word;
      }
    }

    if (current) {
      result.push(current.trim());
    }

    return result;
  }

  private ensurePartsWithinLimit(parts: string[], maxLength: number): string[] {
    const result: string[] = [];

    for (const part of parts) {
      if (part.length <= maxLength) {
        result.push(part);
      } else {
        // Force split by words
        const words = part.split(' ');
        let current = '';
        for (const word of words) {
          if ((current + ' ' + word).length > maxLength && current) {
            result.push(current.trim());
            current = word;
          } else {
            current = current ? current + ' ' + word : word;
          }
        }
        if (current) {
          result.push(current.trim());
        }
      }
    }

    return result;
  }

  private shouldAddConversationPause(current: string, next: string): boolean {
    // Add longer pause if current part ends with dialogue indicator
    const dialogueEnders = ['.', '!', '?', '"', "'"];
    const lastChar = current.trim().slice(-1);
    return dialogueEnders.includes(lastChar);
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private getCacheKey(text: string): string {
    const hash = createHash('md5').update(text).digest('hex');
    return `audio:tts:${hash}`;
  }

  /**
   * Cleanup on shutdown
   */
  public async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

export const audioService = new AudioService();
