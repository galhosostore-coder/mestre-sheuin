# Deploy Automatizado - Mestre Bot

Script automatizado para deploy na VPS 144.91.69.65.

## Pré-requisitos

1. Node.js instalado localmente (v18+)
2. Pacote `node-ssh` já instalado (`npm install` no projeto)
3. Arquivo `backend.tar` gerado com o projeto
4. Arquivo `.env.example` configurado

## Uso

```bash
# Executar deploy completo
node deploy.js
```

## O que o script faz

1. ✅ Verifica arquivos locais necessários (backend.tar, .env.example)
2. ✅ Conecta via SSH à VPS (144.91.69.65, usuário: root)
3. ✅ Upload do arquivo backend.tar via SCP
4. ✅ Extrai arquivos no diretório /root/mestre-bot
5. ✅ Copia .env.example para .env
6. ✅ Instala dependências npm (npm install)
7. ✅ Compila TypeScript (npm run build)
8. ✅ Sobe containers Docker:
   - docker-compose-infra.yml (infraestrutura)
   - docker-compose-backend.yml (aplicação)
9. ✅ Exibe logs dos containers
10. ✅ Verifica status final da implantação

## Configuração

### Credenciais SSH (no script)
- Host: 144.91.69.65
- Usuário: root
- Senha: 1823ORav
- Porta: 22

### Variáveis de Ambiente
Após o deploy, edite o arquivo `.env` na VPS com as configurações reais:

```env
GEMINI_API_KEY=sua_chave_gemini
OPENROUTER_API_KEY=sua_chave_openrouter
ELEVENLABS_API_KEY=sua_chave_elevenlabs
BRAIP_API_KEY=sua_chave_braip
DATABASE_URL=postgresql://usuario:senha@host:porta/banco
REDIS_URL=redis://host:porta
QDRANT_URL=http://host:porta
EVOLUTION_API_URL=http://evolution-api:8080
EVOLUTION_API_KEY=sua_chave_evolution
WEBHOOK_SECRET=seu_segredo_webhook
PORT=3000
INSTANCE_NAME=Bot
```

## Tratamento de Erros

O script para imediatamente se qualquer passo crítico falhar:
- Conexão SSH
- Upload de arquivos
- Extração
- Instalação de dependências
- Build do projeto
- Subida dos containers

Comandos não-críticos (como infraestrutura já existente) continuam a execução.

## Logs

O script exibe logs coloridos no console:
- ✅ Verde: Sucesso
- ❌ Vermelho: Erro crítico
- ⚠ Amarelo: Aviso/não-crítico
- 🔵 Cyan: Informação/progresso

Após a conclusão, são exibidos:
- Containers em execução
- Últimas 50 linhas de logs
- Verificação de porta (3000)

## Solução de Problemas

### Erro de conexão SSH
- Verifique se a VPS está online
- Confirme as credenciais (usuário/senha)
- Verifique se a porta 22 está aberta

### Erro no upload
- Confirme que o arquivo backend.tar existe
- Verifique espaço em disco na VPS

### Erro no npm install
- Verifique versão do Node.js (>= 18)
- Verifique conectividade de internet na VPS

### Containers não sobem
- Verifique logs: `docker-compose -f docker-compose-backend.yml logs`
- Verifique se Docker está instalado: `docker --version`
- Verifique se docker-compose está instalado: `docker-compose --version`

### Aplicação não acessível
- Verifique se a porta 3000 está mapeada no docker-compose
- Verifique firewall: `ufw status` (ou iptables)
- Teste localmente na VPS: `curl http://localhost:3000`

## Estrutura de Arquivos Remota

```
/root/
├── backend.tar          # Upload automático
└── mestre-bot/          # Projeto extraído
    ├── .env             # Criado a partir de .env.example
    ├── .env.example     # Copiado do upload
    ├── docker-compose-backend.yml
    ├── docker-compose-infra.yml
    ├── package.json
    ├── src/
    └── dist/            # Gerado após build
```

## Comandos Úteis Pós-Deploy

```bash
# Ver logs em tempo real
ssh root@144.91.69.65 "cd /root/mestre-bot && docker-compose -f docker-compose-backend.yml logs -f"

# Reiniciar containers
ssh root@144.91.69.65 "cd /root/mestre-bot && docker-compose -f docker-compose-backend.yml restart"

# Parar containers
ssh root@144.91.69.65 "cd /root/mestre-bot && docker-compose -f docker-compose-backend.yml down"

# Ver status
ssh root@144.91.69.65 "cd /root/mestre-bot && docker-compose -f docker-compose-backend.yml ps"

# Ver recursos
ssh root@144.91.69.65 "docker stats"

# Acessar container
ssh root@144.91.69.65 "cd /root/mestre-bot && docker-compose -f docker-compose-backend.yml exec app bash"
```

## Notas

- O script usa cores ANSI para melhor visualização
- Todos os comandos são executados no diretório /root/mestre-bot
- O arquivo .env é criado mas deve ser editado manualmente com valores reais
- A porta padrão é 3000 (configurável no .env)
