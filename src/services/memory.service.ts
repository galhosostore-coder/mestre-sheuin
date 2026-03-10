import { Pool } from 'pg';
import { QdrantClient } from '@qdrant/js-client-rest';
import { GoogleGenAI } from '@google/genai';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

dotenv.config();

/**
 * State-of-the-Art Memory Service
 * 1. Curto Prazo (PostgreSQL): Histórico de chat exato para o contexto da conversa.
 * 2. Longo Prazo / Episódica (Qdrant + Gemini Embeddings): Fatos extraídos das mensagens e armazenados como vetores.
 */

class MemoryService {
  private pool: Pool;
  private qdrant: QdrantClient;
  private ai: GoogleGenAI;
  
  private readonly QDRANT_COLLECTION = 'user_facts';
  private readonly EMBEDDING_MODEL = 'text-embedding-004';
  private readonly EXTRACTION_MODEL = 'gemini-1.5-flash';
  private initialized = false;

  constructor() {
    // Configuração do PostgreSQL (Curto Prazo)
    // Usa variável de ambiente obrigatória. Fallback apenas para desenvolvimento local.
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error('[MemoryService] DATABASE_URL não definida. Defina a variável de ambiente para produção.');
    }
    this.pool = new Pool({
      connectionString: databaseUrl
    });

    // Configuração do Qdrant (Longo Prazo / Semântica)
    const qdrantUrl = process.env.QDRANT_URL;
    if (!qdrantUrl) {
      throw new Error('[MemoryService] QDRANT_URL não definida. Defina a variável de ambiente para produção.');
    }
    this.qdrant = new QdrantClient({ url: qdrantUrl });

    // Configuração do Gemini (Extração de Fatos e Embeddings)
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
    
    this.init().catch(err => console.error('[MemoryService] Erro na inicialização:', err));
  }

  private async init() {
    if (this.initialized) return;

    try {
      // 1. Inicializar Tabela Postgres
      await this.pool.query(`
        CREATE TABLE IF NOT EXISTS chat_history (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          role VARCHAR(50) NOT NULL,
          content TEXT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        CREATE INDEX IF NOT EXISTS idx_chat_history_user_id ON chat_history(user_id);

        CREATE TABLE IF NOT EXISTS user_sales (
          id SERIAL PRIMARY KEY,
          user_id VARCHAR(255) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          purchase_date TIMESTAMP NOT NULL,
          status VARCHAR(50) NOT NULL,
          followed_up BOOLEAN DEFAULT FALSE
        );
        ALTER TABLE user_sales ADD COLUMN IF NOT EXISTS followed_up BOOLEAN DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS idx_user_sales_user_id ON user_sales(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_sales_purchase_date ON user_sales(purchase_date);

        CREATE TABLE IF NOT EXISTS user_pauses (
          user_id VARCHAR(255) PRIMARY KEY,
          is_paused BOOLEAN DEFAULT FALSE,
          paused_until TIMESTAMP
        );
      `);
      console.log('[MemoryService] PostgreSQL: Tabelas verificadas (chat_history, user_sales, user_pauses).');

      // 2. Inicializar Coleção Qdrant
      try {
        const collections = await this.qdrant.getCollections();
        const exists = collections.collections.some(c => c.name === this.QDRANT_COLLECTION);
        
        if (!exists) {
          await this.qdrant.createCollection(this.QDRANT_COLLECTION, {
            vectors: {
              size: 768, // text-embedding-004 size
              distance: 'Cosine'
            }
          });
          console.log(`[MemoryService] Qdrant: Coleção ${this.QDRANT_COLLECTION} criada.`);
        } else {
          console.log(`[MemoryService] Qdrant: Coleção ${this.QDRANT_COLLECTION} já existe.`);
        }
      } catch (qErr) {
        console.warn('[MemoryService] Aviso ao conectar/criar coleção no Qdrant (pode estar offline localmente):', qErr);
      }

      this.initialized = true;
    } catch (error) {
      console.error('[MemoryService] Falha crítica na inicialização:', error);
    }
  }

  /**
   * Adiciona uma mensagem ao histórico e, se for do usuário, extrai fatos assincronamente.
   */
  async addMessage(userId: string, role: 'user' | 'assistant', message: string): Promise<void> {
    try {
      // 1. Salva no banco de curto prazo (Postgres)
      await this.pool.query(
        'INSERT INTO chat_history (user_id, role, content) VALUES ($1, $2, $3)',
        [userId, role, message]
      );
      console.log(`[MemoryService] Mensagem de ${role} salva no Postgres para ${userId}.`);

      // 2. Extrai memória episódica (Longo Prazo) se for o usuário
      if (role === 'user') {
        // Dispara extração em background para não bloquear a resposta do bot
        this.extractAndStoreFacts(userId, message).catch(err => 
          console.error('[MemoryService] Erro na extração de fatos em background:', err)
        );
      }
    } catch (error) {
      console.error(`[MemoryService] Erro ao adicionar mensagem para ${userId}:`, error);
    }
  }

  /**
   * Analisa a mensagem com LLM, extrai fatos (Knowledge/Facts) e salva no VectorDB.
   */
  private async extractAndStoreFacts(userId: string, message: string) {
    // Prompt para o Gemini extrair fatos
    const prompt = `Analise a mensagem do usuário a seguir e extraia APENAS fatos permanentes ou importantes sobre o usuário (gostos, nome, família, profissão, preferências, restrições).
    Retorne uma lista JSON de strings simples. Retorne apenas o array JSON e mais nada. Se não houver nada importante a ser lembrado a longo prazo, retorne [].
    Mensagem do usuário: "${message}"`;

    try {
      const response = await this.ai.models.generateContent({
        model: this.EXTRACTION_MODEL,
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          temperature: 0.1
        }
      });

      const text = response.text || "[]";
      let facts: string[] = [];
      try {
        facts = JSON.parse(text);
      } catch (parseErr) {
        console.error('[MemoryService] Erro ao fazer parse dos fatos JSON:', text);
        return;
      }

      if (!Array.isArray(facts) || facts.length === 0) return;

      console.log(`[MemoryService] Fatos extraídos para ${userId}:`, facts);

      // Gerar embeddings para os fatos extraídos
      for (const fact of facts) {
        const embeddingRes = await this.ai.models.embedContent({
          model: this.EMBEDDING_MODEL,
          contents: fact
        });

        const vector = embeddingRes.embeddings?.[0]?.values;
        if (!vector) continue;

        // Salvar no Qdrant
        await this.qdrant.upsert(this.QDRANT_COLLECTION, {
          wait: true,
          points: [
            {
              id: uuidv4(),
              vector: vector,
              payload: {
                user_id: userId,
                fact: fact,
                created_at: new Date().toISOString()
              }
            }
          ]
        });
        console.log(`[MemoryService] Fato salvo no Qdrant: "${fact}"`);
      }

    } catch (error) {
      console.error('[MemoryService] Erro durante a extração/salvamento no Qdrant:', error);
    }
  }

  /**
   * Recupera o contexto do usuário combinando:
   * 1. Fatos semânticos relevantes (Qdrant RAG) baseados na query/última msg
   * 2. Histórico recente de conversa (Postgres)
   */
  async getUserContext(userId: string, currentMessage?: string): Promise<string> {
    let contextParts: string[] = [];

    try {
      // 1. Busca Fatos no VectorDB (Memória Longo Prazo / RAG)
      if (currentMessage) {
        try {
          // Gerar embedding da mensagem atual para busca semântica
          const embeddingRes = await this.ai.models.embedContent({
            model: this.EMBEDDING_MODEL,
            contents: currentMessage
          });
          const queryVector = embeddingRes.embeddings?.[0]?.values;

          if (queryVector) {
            const searchResults = await this.qdrant.search(this.QDRANT_COLLECTION, {
              vector: queryVector,
              limit: 5,
              filter: {
                must: [{ key: 'user_id', match: { value: userId } }]
              }
            });

            if (searchResults && searchResults.length > 0) {
              const facts = searchResults.map(s => `- ${s.payload?.fact}`);
              contextParts.push(`**Fatos Relevantes Lembrados:**\n${facts.join('\n')}`);
            }
          }
        } catch (qErr: any) {
          console.warn('[MemoryService] Não foi possível buscar no Qdrant (VectorDB):', qErr.message);
        }
      }

      // 2. Busca Histórico Recente (Memória Curto Prazo)
      try {
        const historyRes = await this.pool.query(
          'SELECT role, content FROM chat_history WHERE user_id = $1 ORDER BY id DESC LIMIT 15',
          [userId]
        );

        if (historyRes.rows.length > 0) {
          // Inverter a ordem para ficar cronológica (mais antiga -> mais nova)
          const historyLines = historyRes.rows.reverse().map(row => {
            const speaker = row.role === 'user' ? 'Usuário' : 'Você (Assistente)';
            return `${speaker}: ${row.content}`;
          });
          contextParts.push(`**Conversa Recente:**\n${historyLines.join('\n')}`);
        }
      } catch (dbErr: any) {
         console.warn('[MemoryService] Não foi possível buscar no Postgres (Histórico):', dbErr.message);
      }

      if (contextParts.length === 0) {
        return "Nenhum contexto histórico ou preferências encontrados para este usuário.";
      }

      return contextParts.join('\n\n');
    } catch (error) {
      console.error(`[MemoryService] Erro ao buscar contexto para ${userId}:`, error);
      return "Não foi possível carregar a memória do usuário no momento.";
    }
  }

  /**
   * Salva os dados de uma venda oriunda de webhook (ex: Braip)
   */
  async saveSale(userId: string, productName: string, purchaseDate: Date, status: string): Promise<void> {
    try {
      // Tenta atualizar se já existe uma venda desse produto para esse usuário
      // (Útil para quando muda de Aguardando Pagamento para Aprovada)
      const updateRes = await this.pool.query(
        `UPDATE user_sales 
         SET status = $1, purchase_date = $2 
         WHERE user_id = $3 AND product_name = $4`,
        [status, purchaseDate, userId, productName]
      );

      if (updateRes.rowCount === 0) {
        // Se não atualizou nada, insere
        await this.pool.query(
          'INSERT INTO user_sales (user_id, product_name, purchase_date, status) VALUES ($1, $2, $3, $4)',
          [userId, productName, purchaseDate, status]
        );
      }
      console.log(`[MemoryService] Venda salva/atualizada para ${userId}: ${productName} (${status})`);
    } catch (error) {
      console.error(`[MemoryService] Erro ao salvar venda para ${userId}:`, error);
    }
  }

  /**
   * Busca clientes que tiveram a venda 'Aprovada' há exatos X dias
   */
  async getSalesByDaysAgo(days: number): Promise<any[]> {
    try {
      const res = await this.pool.query(
        `SELECT user_id, product_name, purchase_date, status 
         FROM user_sales 
         WHERE status = 'Aprovada' 
         AND DATE(purchase_date) = CURRENT_DATE - $1::integer`,
        [days]
      );
      return res.rows;
    } catch (error) {
      console.error(`[MemoryService] Erro ao buscar vendas de ${days} dias atrás:`, error);
      return [];
    }
  }

  /**
   * Busca carrinhos abandonados: status = 'Aguardando Pagamento' (ou 'Abandono de Checkout'), 
   * criados há mais de 2 horas e menos de 24 horas, e ainda não acompanhados.
   */
  async getAbandonedCarts(): Promise<any[]> {
    try {
      const res = await this.pool.query(
        `SELECT user_id, product_name, purchase_date, status 
         FROM user_sales 
         WHERE status IN ('Aguardando Pagamento', 'Abandono de Checkout')
         AND followed_up = FALSE
         AND purchase_date <= CURRENT_TIMESTAMP - INTERVAL '2 hours'
         AND purchase_date >= CURRENT_TIMESTAMP - INTERVAL '24 hours'`
      );
      return res.rows;
    } catch (error) {
      console.error(`[MemoryService] Erro ao buscar carrinhos abandonados:`, error);
      return [];
    }
  }

  /**
   * Marca um carrinho abandonado como já acompanhado (followed_up = true)
   */
  async markCartAsFollowedUp(userId: string, productName: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE user_sales SET followed_up = TRUE WHERE user_id = $1 AND product_name = $2`,
        [userId, productName]
      );
      console.log(`[MemoryService] Carrinho marcado como acompanhado para ${userId}: ${productName}`);
    } catch (error) {
      console.error(`[MemoryService] Erro ao marcar carrinho como acompanhado para ${userId}:`, error);
    }
  }

  /**
   * Pausa a IA para um usuário específico (Takeover Humano)
   */
  async pauseUser(userId: string): Promise<void> {
    try {
      const pausedUntil = new Date(Date.now() + 2 * 60 * 60 * 1000); // 2 horas
      await this.pool.query(
        `INSERT INTO user_pauses (user_id, is_paused, paused_until) 
         VALUES ($1, true, $2)
         ON CONFLICT (user_id) DO UPDATE SET is_paused = true, paused_until = $2`,
        [userId, pausedUntil]
      );
      console.log(`[MemoryService] Usuário ${userId} pausado por 2 horas.`);
    } catch (error) {
      console.error(`[MemoryService] Erro ao pausar usuário ${userId}:`, error);
    }
  }

  /**
   * Retoma a IA para um usuário específico
   */
  async unpauseUser(userId: string): Promise<void> {
    try {
      await this.pool.query(
        `UPDATE user_pauses SET is_paused = false, paused_until = NULL WHERE user_id = $1`,
        [userId]
      );
      console.log(`[MemoryService] Usuário ${userId} despausado.`);
    } catch (error) {
      console.error(`[MemoryService] Erro ao despausar usuário ${userId}:`, error);
    }
  }

   /**
    * Verifica se a IA está pausada para um usuário
    */
   async isUserPaused(userId: string): Promise<boolean> {
     try {
       const res = await this.pool.query(
         `SELECT is_paused, paused_until FROM user_pauses WHERE user_id = $1`,
         [userId]
       );
       if (res.rows.length > 0) {
         const row = res.rows[0];
         if (row.is_paused) {
           if (row.paused_until && new Date(row.paused_until) > new Date()) {
             return true;
           } else if (row.paused_until && new Date(row.paused_until) <= new Date()) {
             // Expirou
             await this.unpauseUser(userId);
             return false;
           }
           return true; // Se não tiver paused_until, assume pausado
         }
       }
       return false;
     } catch (error) {
       console.error(`[MemoryService] Erro ao checar pausa do usuário ${userId}:`, error);
       return false;
     }
   }

   /**
    * Health check para verificar conexão com PostgreSQL e Qdrant
    */
   async healthCheck(): Promise<{ 
     postgres: { status: string; error?: string }; 
     qdrant: { status: string; error?: string } 
   }> {
     const result = {
       postgres: { status: 'disconnected' } as { status: string; error?: string },
       qdrant: { status: 'disconnected' } as { status: string; error?: string }
     };

     // Verificar PostgreSQL
     try {
       await this.pool.query('SELECT 1');
       result.postgres.status = 'connected';
     } catch (error: any) {
       result.postgres.status = 'error';
       result.postgres.error = error.message || 'PostgreSQL connection failed';
     }

     // Verificar Qdrant
     try {
       // Tenta obter as coleções como um health check simples
       await this.qdrant.getCollections();
       result.qdrant.status = 'connected';
     } catch (error: any) {
       result.qdrant.status = 'error';
       result.qdrant.error = error.message || 'Qdrant connection failed';
     }

     return result;
   }
 }

export const memoryService = new MemoryService();
