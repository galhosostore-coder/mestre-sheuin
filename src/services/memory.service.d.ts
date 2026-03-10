/**
 * State-of-the-Art Memory Service
 * 1. Curto Prazo (PostgreSQL): Histórico de chat exato para o contexto da conversa.
 * 2. Longo Prazo / Episódica (Qdrant + Gemini Embeddings): Fatos extraídos das mensagens e armazenados como vetores.
 */
declare class MemoryService {
    private pool;
    private qdrant;
    private ai;
    private readonly QDRANT_COLLECTION;
    private readonly EMBEDDING_MODEL;
    private readonly EXTRACTION_MODEL;
    private initialized;
    constructor();
    private init;
    /**
     * Adiciona uma mensagem ao histórico e, se for do usuário, extrai fatos assincronamente.
     */
    addMessage(userId: string, role: 'user' | 'assistant', message: string): Promise<void>;
    /**
     * Analisa a mensagem com LLM, extrai fatos (Knowledge/Facts) e salva no VectorDB.
     */
    private extractAndStoreFacts;
    /**
     * Recupera o contexto do usuário combinando:
     * 1. Fatos semânticos relevantes (Qdrant RAG) baseados na query/última msg
     * 2. Histórico recente de conversa (Postgres)
     */
    getUserContext(userId: string, currentMessage?: string): Promise<string>;
    /**
     * Salva os dados de uma venda oriunda de webhook (ex: Braip)
     */
    saveSale(userId: string, productName: string, purchaseDate: Date, status: string): Promise<void>;
    /**
     * Busca clientes que tiveram a venda 'Aprovada' há exatos X dias
     */
    getSalesByDaysAgo(days: number): Promise<any[]>;
    /**
     * Busca carrinhos abandonados: status = 'Aguardando Pagamento' (ou 'Abandono de Checkout'),
     * criados há mais de 2 horas e menos de 24 horas, e ainda não acompanhados.
     */
    getAbandonedCarts(): Promise<any[]>;
    /**
     * Marca um carrinho abandonado como já acompanhado (followed_up = true)
     */
    markCartAsFollowedUp(userId: string, productName: string): Promise<void>;
    /**
     * Pausa a IA para um usuário específico (Takeover Humano)
     */
    pauseUser(userId: string): Promise<void>;
    /**
     * Retoma a IA para um usuário específico
     */
    unpauseUser(userId: string): Promise<void>;
    /**
     * Verifica se a IA está pausada para um usuário
     */
    isUserPaused(userId: string): Promise<boolean>;
}
export declare const memoryService: MemoryService;
export {};
//# sourceMappingURL=memory.service.d.ts.map