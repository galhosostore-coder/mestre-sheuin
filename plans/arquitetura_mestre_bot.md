# Arquitetura do Mestre Bot (MVP - Baixo Custo)

## 1. Visão Geral
O "Mestre Bot" é um agente conversacional (Sábio Chinês) para WhatsApp, projetado para atuar como conselheiro e vendedor de produtos naturais encapsulados (afiliado). Ele prioriza extrema humanização (textos curtos e áudios, simulação de digitação, comportamentos naturais) e memória de longo prazo por usuário.

## 2. Pilha Tecnológica (Tech Stack)

### 2.1 API do WhatsApp
*   **Ferramenta:** Evolution API (Auto-hospedada).
*   **Motivo:** Extremamente econômica (open-source), permite conectar o número de WhatsApp via QR Code sem os custos por conversa da API Oficial (Cloud API). Suporta envio de áudio como se fosse gravado na hora.

### 2.2 Inteligência Artificial (LLM & Memória)
*   **LLM (Textos):** OpenAI (GPT-4o-mini) ou Anthropic (Claude 3.5 Haiku) / Google Gemini 1.5 Flash.
    *   **Motivo:** Modelos muito rápidos e de baixíssimo custo (MVP), com capacidade suficiente para manter a persona e executar técnicas de persuasão (copywriting/vendas).
*   **Gerenciamento de Fluxo/Agente:** LangChain / LangGraph (Node.js/TypeScript) ou Flowise/n8n (No-code/Low-code para MVP rápido). Sugere-se código customizado (Node.js) para maior controle sobre "digitação", "espera" e envio de áudios nativos.
*   **Memória (RAG / Persistente):**
    *   **Banco de Dados Vetorial:** Pinecone (Tier gratuito) ou Supabase (pgvector).
    *   **Banco de Dados Relacional/NoSQL:** MongoDB ou PostgreSQL (Supabase) para salvar o histórico exato de mensagens (sessões) e o perfil do usuário.
    *   **Estratégia:** Cada número de telefone (`remoteJid` no WhatsApp) será a chave única (Session ID). O bot buscará o contexto anterior sempre que o cliente mandar mensagem.

### 2.3 Geração de Áudio (Text-to-Speech - TTS)
*   **Ferramenta:** ElevenLabs (para extrema naturalidade/voz de "velho sábio") ou OpenAI TTS (mais barato, vozes padrão).
*   **Implementação:** Converter a resposta da IA em OGG com codec Opus e enviar via Evolution API com flag `ptt: true` (simula áudio gravado na hora e não apenas "encaminhado").

### 2.4 Hospedagem (Infraestrutura)
*   **Evolution API:** VPS barata (ex: Hetzner, Contabo, DigitalOcean - $5 a $7/mês).
*   **Aplicação/Backend Node.js:** Mesma VPS ou serviços serverless gratuitos/baratos como Render, Vercel ou Railway.
*   **Banco de Dados:** Supabase (PostgreSQL) ou MongoDB Atlas (ambos com generosos planos gratuitos).

## 3. Fluxo de Interação
1.  **Usuário envia mensagem** no WhatsApp.
2.  **Evolution API** recebe e envia um Webhook para o nosso **Backend (Node.js)**.
3.  **Backend** identifica o usuário (Número do celular).
4.  **Backend** busca a memória/histórico daquele usuário no Banco de Dados.
5.  **Backend** envia o contexto + mensagem nova para o **LLM**, instruindo: "Responda como o Mestre, de forma curta e humana, decidindo se será texto ou áudio".
6.  **Simulação Humana:** O Backend avisa a Evolution API para mostrar o status "Digitando..." ou "Gravando áudio..." por X segundos (calculado com base no tamanho da resposta).
7.  Se a IA decidir que é áudio: Envia texto para TTS (ElevenLabs), gera o arquivo, e envia via API. Se texto: envia o texto fracionado via API.
8.  **Backend** salva a nova interação no Banco de Dados para memória futura.

## 4. Técnicas de Humanização a Implementar
*   **Delays Proporcionais:** Calcular delay de "digitando" baseado no número de caracteres da resposta.
*   **Erros de Digitação:** (Opcional) Injetar programaticamente pequenos erros de digitação e auto-correções (* ou enviar mensagem corrigindo embaixo), instruído via prompt.
*   **Horário de Sono:** O bot não deve responder de madrugada (ou deve dizer "O mestre está meditando, falarei com você com o raiar do sol").
*   **Fracionamento:** Dividir mensagens longas em 2 ou 3 mensagens curtas enviadas em sequência.
