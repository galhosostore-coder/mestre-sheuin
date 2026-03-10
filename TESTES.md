# 📋 GUIA COMPLETO DE TESTES - Mestre Bot

Este documento fornece instruções detalhadas para executar os testes automatizados dos serviços **Memory** e **Audio**.

---

## 📦 Pré-requisitos

### 1. Variáveis de Ambiente

Certifique-se de que o arquivo `.env` está configurado com pelo menos as seguintes variáveis:

```env
# Banco de dados PostgreSQL
DATABASE_URL=postgresql://user:password@localhost:5432/mestre_bot

# Qdrant Vector Database
QDRANT_URL=http://localhost:6333

# Google Gemini AI
GEMINI_API_KEY=sua_chave_gemini_aqui

# ElevenLabs TTS (opcional para testes de áudio)
ELEVENLABS_API_KEY=sua_chave_elevenlabs_aqui
ELEVENLABS_VOICE_ID=8TMmdpPgqHKvDOGYP2lN
ELEVENLABS_MODEL_ID=eleven_multilingual_v3

# Redis (opcional para testes de cache)
REDIS_URL=redis://localhost:6379
```

**Nota:** Para os testes do Memory Service, os mocks simulam as conexões, então as variáveis não são estritamente necessárias. Para testes de áudio com API real, a `ELEVENLABS_API_KEY` é necessária.

### 2. Serviços em Execução (Opcional)

Os testes do Memory Service usam **mocks**, então não precisam de PostgreSQL, Qdrant ou Redis rodando.

Se quiser testar com serviços reais, inicie:

```bash
# PostgreSQL (Docker)
docker run -d -p 5432:5432 -e POSTGRES_PASSWORD=password -e POSTGRES_DB=mestre_bot postgres:15

# Qdrant (Docker)
docker run -d -p 6333:6333 qdrant/qdrant

# Redis (Docker)
docker run -d -p 6379:6379 redis:alpine
```

### 3. Build do Projeto

Antes de executar os testes, compile o TypeScript:

```bash
npm run build
```

Isso gera os arquivos JavaScript na pasta `dist/`.

---

## 🧪 Executando os Testes

### Testes do Memory Service (12 testes)

```bash
node dist/test-memory.test.js
```

**O que testa:**
1. ✅ Conexão PostgreSQL (mock)
2. ✅ Conexão Qdrant (mock)
3. ✅ Adicionar mensagem ao chat_history
4. ✅ Extração de fatos (simula LLM Gemini)
5. ✅ Busca semântica (RAG)
6. ✅ Limite de histórico (LIMIT 15)
7. ✅ Fallback Qdrant offline
8. ✅ Healthcheck completo
9. ✅ Salvar venda
10. ✅ Buscar carrinhos abandonados
11. ✅ Pausar/despausar usuário
12. ✅ Verificar tamanho da tabela (memory leak)

**Output esperado:**
```
🧪 INICIANDO TESTES DO MEMORY SERVICE

============================================================

📋 Teste 1: Conexão PostgreSQL
   [Mock Postgres] Query: CREATE TABLE IF NOT EXISTS...
✅ Teste 1: Conexão PostgreSQL

📋 Teste 2: Conexão Qdrant
   [Mock Qdrant] Coleção user_facts criada
✅ Teste 2: Conexão Qdrant

... (demais testes)

============================================================
📊 RESUMO DOS TESTES
============================================================
✅ Passaram: 12
❌ Falharam: 0
📝 Total: 12
============================================================

🎉 TODOS OS TESTES PASSARAM!
```

### Testes do Audio Service (6 testes)

```bash
node dist/test-audio-comprehensive.js
```

**O que testa:**
1. ✅ Geração simples de áudio (com medição de latência)
2. ✅ Cache hit (verifica se segunda chamada é mais rápida)
3. ✅ Split de texto longo (>500 chars)
4. ✅ Validação de entrada (texto vazio e >5000 chars)
5. ✅ Healthcheck do serviço
6. ✅ Verificar TTL no Redis (cache 24h)

**Output esperado:**
```
🧪 INICIANDO TESTES DO AUDIO SERVICE

============================================================

📋 Teste 1: Geração simples de áudio
   [Cache SET] Chave: audio:tts:8f43434...
✅ Teste 1: Geração simples de áudio, Latência: 520ms, Tamanho: 1368 chars

📋 Teste 2: Cache hit (segunda chamada deve ser instantânea)
   [Cache HIT] Chave: audio:tts:8f43434...
✅ Teste 2: Cache hit, 1ª chamada: 520ms, 2ª chamada: 2ms

... (demais testes)

============================================================
📊 RESUMO DOS TESTES
============================================================
✅ Passaram: 6
❌ Falharam: 0
📝 Total: 6
============================================================

🎉 TODOS OS TESTES PASSARAM!
```

---

## 📊 Interpretando os Resultados

### ✅ Testes Passando

- **Verde (✅)**: Todos os testes passaram. O serviço está funcionando conforme esperado.
- **Exit code 0**: Processo encerrado com sucesso.

### ❌ Testes Falhando

- **Vermelho (❌)**: Um ou mais testes falharam.
- **Exit code 1**: Processo encerrado com erro.
- A mensagem de erro específica é exibida após o ❌.

**Exemplo de falha:**
```
❌ Teste 4: Extração de fatos (simular LLM)
   Erro: Timeout: requisição excedeu 30 segundos
```

### Diagnóstico de Falhas Comuns

| Erro | Possível Causa | Solução |
|------|----------------|---------|
| `ELEVENLABS_API_KEY is missing` | Variável não definida | Adicione a chave no `.env` |
| `PostgreSQL connection failed` | Banco não rodando | Inicie PostgreSQL ou use mocks (já é padrão) |
| `Qdrant connection failed` | Qdrant não rodando | Inicie Qdrant ou use mocks (já é padrão) |
| `Timeout: requisição excedeu 30 segundos` | API do ElevenLabs lenta/timeout | Verifique sua conexão ou chave API |
| `Texto vazio não é permitido` | Validação falhou | Verifique se o texto não está vazio |

---

## 🔧 Troubleshooting

### Problema: Erro de compilação TypeScript

```bash
# Limpe e recompile
npm run clean
npm run build
```

### Problema: Arquivos .js não encontrados em dist/

```bash
# Verifique se o build foi bem-sucedido
ls dist/test-memory.test.js
ls dist/test-audio-comprehensive.js

# Se não existirem, execute:
npm run build
```

### Problema: Mocks não estão funcionando

Os testes foram projetados para rodar **totalmente com mocks**, independentemente de serviços externos. Se houver erros de conexão, verifique:

1. O arquivo `test-memory.test.ts` usa classes `MockPgPool` e `MockQdrantClient` internas.
2. O arquivo `test-audio-comprehensive.ts` usa `MockRedis` e `MockElevenLabsAPI` internas.
3. Nenhuma dependência externa é necessária além do Node.js padrão.

### Problema: Portas já em uso

Se estiver rodando serviços reais em Docker:

```bash
# Verifique containers em execução
docker ps

# Pare se necessário
docker stop <container_id>
```

### Probleto: Testes demoram muito

Os testes de áudio incluem latência simulada de 500ms. Tempo total esperado: **~3-5 segundos**.

Para testes mais rápidos, reduza a latência no mock (linha 27 de `test-audio-comprehensive.ts`):

```typescript
private latencyMs: number = 100; // Reduza de 500 para 100ms
```

---

## 📈 Estrutura dos Arquivos de Teste

```
src/
├── test-memory.test.ts        # 12 testes do Memory Service (mocks)
├── test-audio-comprehensive.ts # 6 testes do Audio Service (mocks)
└── services/
    ├── memory.service.ts      # Serviço de memória (Postgres + Qdrant + Gemini)
    └── audio.service.ts       # Serviço de áudio (ElevenLabs + Redis)

dist/
├── test-memory.test.js        # Compilado para JS
└── test-audio-comprehensive.js # Compilado para JS
```

---

## 🎯 Testes de Integração (Opcional)

Para testar com serviços **REAIS** (não mocks):

1. Configure todas as variáveis de ambiente no `.env`
2. Inicie PostgreSQL, Qdrant e Redis
3. Execute:

```bash
# Teste Memory com banco real
node dist/test-memory.js  # (arquivo original, não o test-memory.test.js)

# Teste Audio com API real
node dist/test-audio.js   # (arquivo original, não o test-audio-comprehensive.js)
```

**Aviso:** Esses testes originais (`test-memory.ts` e `test-audio.ts`) usam serviços reais e podem:
- Consumir créditos da API Gemini/OpenAI
- Gerar custos na API ElevenLabs
- Criar dados no seu banco de produção

Use apenas em ambiente de desenvolvimento/ staging.

---

## 📝 Notas Técnicas

### Memory Service

- **Mock PostgreSQL**: Implementa `query()` que simula CREATE, INSERT, SELECT, UPDATE
- **Mock Qdrant**: Implementa `getCollections()`, `createCollection()`, `upsert()`, `search()`
- **Mock Gemini**: `generateContent()` retorna JSON com fatos simulados; `embedContent()` retorna vetor aleatório de 768 dimensões
- **Isolamento**: Cada teste usa `userId` único para não interferir

### Audio Service

- **Mock Redis**: Implementa `get()`, `setex()`, `ping()` com TTL real
- **Mock ElevenLabs**: `generate()` simula latência e retorna base64 válido
- **Cache**: Usa MD5 do texto como chave; TTL de 24h (86400 segundos)
- **Split**: Divide textos >250 chars por frases e cláusulas

---

## 🚀 Próximos Passos

Após executar os testes com sucesso:

1. ✅ Commit dos arquivos de teste
2. ✅ Configurar CI/CD para rodar automaticamente
3. ✅ Adicionar mais testes de edge cases conforme necessário
4. ✅ Monitorar cobertura de testes (considerar usar Istanbul/nyc)

---

## 📞 Suporte

Em caso de problemas não listados aqui:

1. Verifique os logs de erro detalhados
2. Consulte a documentação dos serviços em `src/services/`
3. Abra uma issue no repositório com:
   - Versão do Node.js (`node --version`)
   - Sistema operacional
   - Output completo do erro
   - Passos para reproduzir

---

**Última atualização:** 2025-03-10
**Versão:** 1.0.0
**Autor:** Test Engineer - Mestre Bot Team