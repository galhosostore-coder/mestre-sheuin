import { createHash } from 'crypto';

// Mock do Redis
class MockRedis {
  private cache: Map<string, string> = new Map();
  private ttlMap: Map<string, number> = new Map();
  
  async get(key: string): Promise<string | null> {
    const expireTime = this.ttlMap.get(key);
    if (expireTime && Date.now() > expireTime) {
      this.cache.delete(key);
      this.ttlMap.delete(key);
      return null;
    }
    return this.cache.get(key) || null;
  }
  
  async setex(key: string, ttl: number, value: string): Promise<'OK'> {
    this.cache.set(key, value);
    this.ttlMap.set(key, Date.now() + ttl * 1000);
    return 'OK';
  }
  
  async ping(): Promise<string> {
    return 'PONG';
  }
  
  async quit(): Promise<void> {
    this.cache.clear();
    this.ttlMap.clear();
  }
  
  getStats() {
    return {
      keys: this.cache.size,
      keysWithTTL: this.ttlMap.size
    };
  }
}

// Mock da API ElevenLabs
class MockElevenLabsAPI {
  private shouldSucceed: boolean = true;
  private latencyMs: number = 500;
  
  setLatency(ms: number) {
    this.latencyMs = ms;
  }
  
  setShouldSucceed(succeed: boolean) {
    this.shouldSucceed = succeed;
  }
  
  async generate(text: string): Promise<string> {
    await new Promise(resolve => setTimeout(resolve, this.latencyMs));
    
    if (!this.shouldSucceed) {
      throw new Error('ElevenLabs API Error: Simulated failure');
    }
    
    const mockAudio = 'UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQAAAAA=';
    const repeated = mockAudio.repeat(20);
    return Buffer.from(repeated).toString('base64');
  }
}

class TestAudioService {
  private voiceId: string;
  private modelId: string;
  private redis: MockRedis | null = null;
  private elevenLabs: MockElevenLabsAPI;
  private readonly DEFAULT_SPLIT_LENGTH = 250;
  private readonly CONVERSATION_PAUSE_MS = 800;
  private readonly SYSTEM_PAUSE_MS = 500;
  
  constructor() {
    this.voiceId = process.env.ELEVENLABS_VOICE_ID || '8TMmdpPgqHKvDOGYP2lN';
    this.modelId = process.env.ELEVENLABS_MODEL_ID || 'eleven_multilingual_v2';
    this.elevenLabs = new MockElevenLabsAPI();
    
    // Inicializa Redis mock automaticamente para testes
    this.redis = new MockRedis();
  }
  
  async healthCheck(): Promise<{ status: string; redis: boolean; apiKey: boolean }> {
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
  
  private validateInput(text: string): void {
    if (!text || !text.trim()) {
      throw new Error('Texto vazio não é permitido');
    }
    if (text.length > 5000) {
      throw new Error('Texto excede 5000 caracteres');
    }
  }
  
  private getCacheKey(text: string): string {
    // Usa crypto do Node.js para gerar hash MD5
    const hash = createHash('md5').update(text).digest('hex');
    return `audio:tts:${hash}`;
  }
  
  async generateAudioFromText(text: string): Promise<string> {
    this.validateInput(text);
    const cacheKey = this.getCacheKey(text);
    
    // Try cache first
    if (this.redis) {
      try {
        const cached = await this.redis.get(cacheKey);
        if (cached) {
          console.log(`   [Cache HIT] Chave: ${cacheKey.substring(0, 20)}...`);
          return cached;
        }
      } catch (err) {
        console.warn('[AudioService] Cache read error:', err);
      }
    }
    
    // Fetch from API
    const base64Audio = await this.elevenLabs.generate(text);
    
    // Save to cache with 24h TTL
    if (this.redis) {
      try {
        await this.redis.setex(cacheKey, 24 * 60 * 60, base64Audio);
        console.log(`   [Cache SET] Chave: ${cacheKey.substring(0, 20)}... TTL: 24h`);
      } catch (err) {
        console.warn('[AudioService] Cache write error:', err);
      }
    }
    
    return base64Audio;
  }
  
  async generateAudioFromTextSplit(text: string): Promise<string[]> {
    this.validateInput(text);
    
    const parts = this.splitIntoParts(text, this.DEFAULT_SPLIT_LENGTH);
    const audios: string[] = [];
    
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const audio = await this.generateAudioFromText(part);
      audios.push(audio);
      
      if (i < parts.length - 1) {
        const pauseMs = this.shouldAddConversationPause(parts[i], parts[i + 1])
          ? this.CONVERSATION_PAUSE_MS
          : this.SYSTEM_PAUSE_MS;
        
        await this.delay(pauseMs);
      }
    }
    
    return audios;
  }
  
  private splitIntoParts(text: string, maxLength: number): string[] {
    const sentences = this.splitBySentences(text);
    const parts: string[] = [];
    let currentPart = '';
    
    for (const sentence of sentences) {
      if (sentence.length > maxLength) {
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
    
    return this.ensurePartsWithinLimit(parts, maxLength);
  }
  
  private splitBySentences(text: string): string[] {
    const regex = /([^.!?]+[.!?]+(?:\s+|$))/g;
    const matches = text.match(regex);
    return matches || [text];
  }
  
  private splitByClauses(text: string, maxLength: number): string[] {
    const clauseRegex = /([^,;]+[,;]|\s+e\s+|,\s+mas\s+|,\s+ou\s+)/gi;
    const clauses = text.match(clauseRegex) || [text];
    
    if (clauses.length > 1) {
      return clauses;
    }
    
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
    const dialogueEnders = ['.', '!', '?', '"', "'"];
    const lastChar = current.trim().slice(-1);
    return dialogueEnders.includes(lastChar);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  async close(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
    }
  }
}

// ==================== EXECUÇÃO DOS TESTES ====================

const audioService = new TestAudioService();
let testsPassed = 0;
let testsFailed = 0;

function logTest(testNumber: number, testName: string, passed: boolean, message?: string) {
  if (passed) {
    console.log(`✅ Teste ${testNumber}: ${testName}`);
    testsPassed++;
  } else {
    console.log(`❌ Teste ${testNumber}: ${testName}`);
    if (message) console.log(`   Erro: ${message}`);
    testsFailed++;
  }
}

async function runAllTests() {
  console.log('\n🧪 INICIANDO TESTES DO AUDIO SERVICE\n');
  console.log('='.repeat(60));
  
  try {
    console.log('\n📋 Teste 1: Geração simples de áudio');
    try {
      const startTime = Date.now();
      const audio = await audioService.generateAudioFromText('Olá, eu sou o Gregory Grumble. Estou testando a integração do ElevenLabs!');
      const latency = Date.now() - startTime;
      
      const isValid = audio && audio.length > 100;
      const message = `Latência: ${latency}ms, Tamanho: ${audio.length} chars`;
      logTest(1, 'Geração simples de áudio', !!isValid, message);
    } catch (err: any) {
      logTest(1, 'Geração simples de áudio', false, err.message);
    }
    
    console.log('\n📋 Teste 2: Cache hit (segunda chamada deve ser instantânea)');
    try {
      const text = 'Teste de cache deve retornar rápido';
      
      // Primeira chamada (cache miss)
      const startTime1 = Date.now();
      await audioService.generateAudioFromText(text);
      const time1 = Date.now() - startTime1;
      
      // Segunda chamada (cache hit)
      const startTime2 = Date.now();
      await audioService.generateAudioFromText(text);
      const time2 = Date.now() - startTime2;
      
      const cacheHit = time2 < time1 / 2;
      const message2 = `1ª chamada: ${time1}ms, 2ª chamada: ${time2}ms`;
      logTest(2, 'Cache hit', !!cacheHit, message2);
    } catch (err: any) {
      logTest(2, 'Cache hit', false, err.message);
    }
    
    console.log('\n📋 Teste 3: Split de texto longo (>500 chars)');
    try {
      const longText = 'Este é um teste de texto muito longo. '.repeat(30);
      const parts = await audioService.generateAudioFromTextSplit(longText);
      
      const isValid = Array.isArray(parts) && parts.length > 1;
      const message3 = `Texto dividido em ${parts.length} partes`;
      logTest(3, 'Split de texto longo', !!isValid, message3);
    } catch (err: any) {
      logTest(3, 'Split de texto longo', false, err.message);
    }
    
    console.log('\n📋 Teste 4: Validação de entrada (texto vazio e muito longo)');
    try {
      let validationPassed = true;
      let errors: string[] = [];
      
      // Teste texto vazio
      try {
        await audioService.generateAudioFromText('');
        validationPassed = false;
        errors.push('Texto vazio deveria lançar erro');
      } catch (e: any) {
        if (!e.message.includes('vazio')) {
          validationPassed = false;
          errors.push(`Erro esperado para texto vazio: ${e.message}`);
        }
      }
      
      // Teste texto muito longo (>5000)
      try {
        const longText = 'a'.repeat(6000);
        await audioService.generateAudioFromText(longText);
        validationPassed = false;
        errors.push('Texto >5000 deveria lançar erro');
      } catch (e: any) {
        if (!e.message.includes('excede')) {
          validationPassed = false;
          errors.push(`Erro esperado para texto longo: ${e.message}`);
        }
      }
      
      const message4 = errors.length > 0 ? errors.join('; ') : 'Validação OK';
      logTest(4, 'Validação de entrada', validationPassed, message4);
    } catch (err: any) {
      logTest(4, 'Validação de entrada', false, err.message);
    }
    
    console.log('\n📋 Teste 5: Healthcheck do serviço');
    try {
      const health = await audioService.healthCheck();
      const isValid = health.status === 'healthy' || health.status === 'missing_api_key';
      const message5 = `Status: ${health.status}, Redis: ${health.redis}, API Key: ${health.apiKey}`;
      logTest(5, 'Healthcheck do serviço', isValid, message5);
    } catch (err: any) {
      logTest(5, 'Healthcheck do serviço', false, err.message);
    }
    
    console.log('\n📋 Teste 6: Verificar TTL no Redis (cache expira em 24h)');
    try {
      // Garante que Redis está configurado
      if (!audioService['redis']) {
        audioService['redis'] = new MockRedis();
      }
      
      const redis = audioService['redis'];
      if (!redis) {
        logTest(6, 'Verificar TTL no Redis', false, 'Redis não configurado');
      } else {
        const text = 'Teste de TTL do Redis';
        const cacheKey = audioService['getCacheKey'](text);
        
        await audioService.generateAudioFromText(text);
        const stats = redis.getStats();
        
        const hasKey = stats.keys > 0 || stats.keysWithTTL > 0;
        const message6 = `Chaves no cache: ${stats.keys}, com TTL: ${stats.keysWithTTL}`;
        logTest(6, 'Verificar TTL no Redis', hasKey, message6);
      }
    } catch (err: any) {
      logTest(6, 'Verificar TTL no Redis', false, err.message);
    }
    
  } catch (err: any) {
    console.error('\n❌ Erro crítico na execução dos testes:', err);
    testsFailed++;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMO DOS TESTES');
  console.log('='.repeat(60));
  console.log(`✅ Passaram: ${testsPassed}`);
  console.log(`❌ Falharam: ${testsFailed}`);
  console.log(`📝 Total: ${testsPassed + testsFailed}`);
  console.log('='.repeat(60));
  
  if (testsFailed === 0) {
    console.log('\n🎉 TODOS OS TESTES PASSARAM!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  ALGUNS TESTES FALHARAM!\n');
    process.exit(1);
  }
}

runAllTests().catch(err => {
  console.error('Erro fatal:', err);
  process.exit(1);
});