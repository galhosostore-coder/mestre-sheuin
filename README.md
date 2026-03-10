# Mestre Sheuin Bot

> Bot de WhatsApp com IA para vendas de produtos naturais

[![Node.js](https://img.shields.io/badge/Node.js-18+-339933?logo=node.js)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)](https://www.typescriptlang.org)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com)
[![License](https://img.shields.io/badge/License-ISC-lightgrey)](LICENSE)

---

## 📋 Sobre o Projeto

O **Mestre Sheuin Bot** é um assistente inteligente de WhatsApp desenvolvido para automatizar o atendimento e vendas de produtos naturais. O bot utiliza inteligência artificial avançada (Google Gemini e OpenAI) para:

- ✅ Atendimento automático via WhatsApp
- ✅ Geração de áudio com ElevenLabs (TTS)
- ✅ Memória conversacional com PostgreSQL + Qdrant (RAG)
- ✅ Processamento de filas com BullMQ
- ✅ Deploy automatizado em VPS com Docker

---

## 🚀 Funcionalidades

### Core Services

| Serviço | Descrição | Tecnologias |
|---------|-----------|-------------|
| **WhatsApp Service** | Integração com WhatsApp Web | `whatsapp-web.js` |
| **LLM Service** | IA generativa (Gemini/OpenAI) | `@google/genai`, `openai` |
| **Audio Service** | Text-to-Speech | `ElevenLabs API` |
| **Memory Service** | Memória persistente + RAG | `PostgreSQL`, `Qdrant` |
| **Queue Service** | Fila de tarefas assíncronas | `BullMQ`, `Redis` |
| **Scheduler Service** | Agendamento de mensagens | `node-cron` |

---

## 📦 Pré-requisitos

### Desenvolvimento Local

- **Node.js** >= 18.x
- **npm** ou **yarn**
- **TypeScript** (compilado automaticamente)
- **Docker** e **docker-compose** (para serviços externos)

### Serviços Externos (Opcionais)

Os testes usam **mocks**, mas para produção você precisará:

- PostgreSQL (ou usar Docker)
- Redis (cache e filas)
- Qdrant (banco vetorial)
- APIs de IA:
  - Google Gemini API Key
  - OpenAI/OpenRouter API Key (opcional)
  - ElevenLabs API Key (para áudio)
  - Braip API Key (para integração de pagamentos)

---

## ⚙️ Instalação e Setup

### 1. Clone o repositório

```bash
git clone https://github.com/SEU-USUARIO/mestre-bot.git
cd mestre-bot
```

### 2. Instale as dependências

```bash
npm install
```

### 3. Configure as variáveis de ambiente

Copie o arquivo de exemplo:

```bash
cp .env.example .env
```

Edite o `.env` com suas credenciais:

```env
# APIs de IA
GEMINI_API_KEY=sua_chave_gemini
OPENROUTER_API_KEY=sua_chave_openrouter
ELEVENLABS_API_KEY=sua_chave_elevenlabs
BRAIP_API_KEY=sua_chave_braip

# Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/mestre_bot
REDIS_URL=redis://localhost:6379
QDRANT_URL=http://localhost:6333

# WhatsApp Evolution API
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=sua_chave_evolution
WEBHOOK_SECRET=seu_segredo_webhook

# Aplicação
PORT=3000
INSTANCE_NAME=Bot
```

### 4. Compile o TypeScript

```bash
npm run build
```

### 5. Execute em desenvolvimento

```bash
npm run dev
```

O servidor estará disponível em `http://localhost:3000`

---

## 🧪 Testes

O projeto inclui testes automatizados para os serviços críticos:

### Memory Service (12 testes)

```bash
npm run build
node dist/test-memory.test.js
```

### Audio Service (6 testes)

```bash
node dist/test-audio-comprehensive.js
```

**Nota:** Os testes usam mocks e não requerem serviços externos rodando.

Para detalhes completos, consulte [TESTES.md](TESTES.md).

---

## 🐳 Deploy com Docker

### Build da imagem

```bash
docker build -t mestre-bot .
```

### Executar com docker-compose

```bash
# Infraestrutura (Postgres, Redis, Qdrant)
docker-compose -f docker-compose-infra.yml up -d

# Aplicação
docker-compose -f docker-compose-backend.yml up -d
```

### Verificar logs

```bash
docker-compose -f docker-compose-backend.yml logs -f
```

---

## 📡 Deploy Automatizado em VPS

Para deploy automático na VPS, utilize o script:

```bash
node deploy.js
```

O script automatiza:
1. Upload via SSH
2. Extração no servidor
3. Instalação de dependências
4. Build do projeto
5. Subida dos containers Docker

**Configuração necessária:** Edite as credenciais SSH no arquivo `deploy.js` antes de usar.

Para instruções detalhadas, consulte [DEPLOY.md](DEPLOY.md).

---

## 📁 Estrutura do Projeto

```
mestre-bot/
├── src/
│   ├── app.ts                    # Ponto de entrada da aplicação
│   ├── controllers/              # Controladores HTTP
│   ├── routes/                   # Definição de rotas
│   ├── services/                 # Lógica de negócio
│   │   ├── audio.service.ts      # Serviço de áudio (TTS)
│   │   ├── humanization.service.ts
│   │   ├── image.service.ts
│   │   ├── llm.service.ts        # Integração com LLMs
│   │   ├── memory.service.ts     # Memória + RAG
│   │   ├── queue.service.ts      # Fila de tarefas
│   │   ├── scheduler.service.ts  # Agendamento
│   │   └── whatsapp.service.ts   # Integração WhatsApp
│   └── test-*.ts                 # Arquivos de teste
├── dist/                         # Código JavaScript compilado
├── docker-compose-backend.yml    # Compose da aplicação
├── docker-compose-infra.yml      # Compose da infraestrutura
├── Dockerfile                    # Build da imagem
├── .env.example                  # Variáveis de ambiente de exemplo
├── .gitignore                    # Arquivos ignorados pelo Git
├── package.json                  # Dependências do projeto
├── tsconfig.json                 # Configuração TypeScript
├── DEPLOY.md                     # Guia de deploy
├── TESTES.md                     # Guia de testes
└── README.md                     # Este arquivo
```

---

## 🔒 Segurança

### Arquivos Sensíveis

**NUNCA** commite os seguintes arquivos:

- `.env` - Contém chaves de API e credenciais
- `backend.tar` - Backup com dados sensíveis
- Qualquer arquivo com senhas, tokens ou chaves privadas

Estes arquivos já estão configurados no `.gitignore`.

### Boas Práticas

- Use variáveis de ambiente para todas as credenciais
- Rotacione chaves de API periodicamente
- Use chaves fortes para `WEBHOOK_SECRET`
- Restrinja acesso à VPS e ao banco de dados

---

## 📝 Workflow de Desenvolvimento

1. **Crie uma branch** para sua feature:
   ```bash
   git checkout -b feature/nova-funcionalidade
   ```

2. **Faça suas alterações** no código

3. **Execute os testes** para garantir qualidade:
   ```bash
   npm run build
   node dist/test-memory.test.js
   node dist/test-audio-comprehensive.js
   ```

4. **Commit** suas mudanças:
   ```bash
   git add .
   git commit -m "feat: adiciona nova funcionalidade X"
   ```

5. **Push** para o repositório:
   ```bash
   git push origin feature/nova-funcionalidade
   ```

6. **Abra um Pull Request** no GitHub

---

## 📄 Licença

ISC - Veja o arquivo [LICENSE](LICENSE) para detalhes.

---

## 📞 Suporte

- **Documentação:** Consulte [DEPLOY.md](DEPLOY.md) e [TESTES.md](TESTES.md)
- **Issues:** Abra uma issue no GitHub com:
  - Descrição do problema
  - Passos para reproduzir
  - Logs de erro
  - Versão do Node.js e SO

---

## 🙌 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature
3. Execute os testes antes de enviar PR
4. Siga o estilo de código existente
5. Atualize a documentação quando necessário

---

**Desenvolvido com ❤️ para automatizar vendas com inteligência artificial**
