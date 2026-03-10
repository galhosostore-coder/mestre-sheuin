# 🧪 Test Runner Automatizado - Mestre Bot

Script robusto para execução automatizada de testes na VPS ou ambiente de desenvolvimento.

## 📋 Índice

- [Visão Geral](#visão-geral)
- [Funcionalidades](#funcionalidades)
- [Pré-requisitos](#pré-requisitos)
- [Instalação](#instalação)
- [Uso](#uso)
- [Exit Codes](#exit-codes)
- [Estrutura de Output](#estrutura-de-output)
- [Troubleshooting](#troubleshooting)
- [Arquivos Gerados](#arquivos-gerados)

---

## Visão Geral

O `run-tests.js` é um script Node.js que orquestra a execução completa dos testes do projeto Mestre Bot, garantindo que todos os serviços estejam funcionando corretamente antes de deploy.

### O que faz

1. ✅ Verifica pré-requisitos (Node.js, npm)
2. ✅ Valida existência dos arquivos de teste
3. ✅ Compila o projeto TypeScript
4. ✅ Executa Memory Service (12 testes)
5. ✅ Executa Audio Service (6 testes)
6. ✅ Gera relatório detalhado com timestamp
7. ✅ Mostra resumo final com estatísticas
8. ✅ Sugere próximos passos baseado no resultado

---

## Funcionalidades

### 🔍 Verificação de Pré-requisitos

- Detecta automaticamente Node.js (v18+)
- Detecta automaticamente npm
- Exibe versões encontradas no terminal

### 🏗️ Compilação Inteligente

- Limpa diretório `dist/` automaticamente (compatível com Windows)
- Compila TypeScript usando `npx tsc`
- Captura e exibe output em tempo real
- **Para imediatamente** se compilação falhar

### 🧪 Execução Sequencial

Os testes são executados em ordem específica:

1. **Memory Service** (`dist/test-memory.test.js`)
   - 12 testes cobrindo PostgreSQL, Qdrant, Gemini e lógica de negócio
   - Uso de mocks para isolamento

2. **Audio Service** (`dist/test-audio-comprehensive.js`)
   - 6 testes cobrindo geração de áudio, cache, validação e healthcheck
   - Uso de mocks para isolamento

### 📊 Coleta de Resultados

- Captura `stdout` e `stderr` de cada teste
- Conta automaticamente testes passando/falhando
- Extrai métricas do output (latência, cache hits, etc.)

### 📄 Geração de Log

- Arquivo com timestamp: `test-results-YYYY-MM-DDTHH-MM-SS.log`
- Inclui **todos** os comandos executados
- Inclui **todo** output dos testes
- Inclui **timestamp** de cada linha
- Salvo automaticamente ao final da execução

### 🎨 Cores no Terminal

- ✅ Verde: Sucesso
- ❌ Vermelho: Falhas
- 🔍 Azul: Informações
- ⚠️ Amarelo: Avisos
- ⏭️ Dim: Passos pendentes
- 🚀 Bright: Headers

### 💡 Sugestões Inteligentes

**Se todos testes passarem:**
- ✅ Commit das alterações
- ✅ Push para repositório remoto
- ⏭️ Configurar CI/CD
- ⏭️ Aumentar cobertura de testes
- ⏭️ Documentar novas funcionalidades

**Se algum teste falhar:**
- ❌ Analisar logs de erro
- ❌ Verificar arquivo de log gerado
- ❌ Executar testes individualmente
- ❌ Verificar variáveis de ambiente
- ❌ Corrigir e reexecutar

---

## Pré-requisitos

### Obrigatórios

- Node.js 18 ou superior
- npm 8 ou superior

### Opcionais (para testes reais)

Os testes usam **mocks** por padrão, então não precisam de serviços externos. Para testes com serviços reais:

```env
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/mestre_bot
QDRANT_URL=http://localhost:6333
GEMINI_API_KEY=sua_chave_gemini
ELEVENLABS_API_KEY=sua_chave_elevenlabs
REDIS_URL=redis://localhost:6379
```

---

## Instalação

1. **Coloque o script na raiz do projeto:**

```bash
# O script já está em run-tests.js
# Certifique-se de que está na raiz (mesmo nível do package.json)
```

2. **Torne executável (Linux/Mac):**

```bash
chmod +x run-tests.js
```

3. **Verifique que os arquivos de teste existem:**

```bash
ls src/test-memory.test.ts
ls src/test-audio-comprehensive.ts
```

---

## Uso

### Execução Básica

```bash
node run-tests.js
```

### Comando Curto (Linux/Mac)

```bash
./run-tests.js
```

### Output Esperado

```
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀
🚀 INICIANDO TESTES COMPLETOS DO MESTRE BOT
🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀🚀

🔍 Verificando pré-requisitos...
✅ Node.js encontrado: v22.15.1
✅ npm encontrado: 10.9.2

📁 Verificando arquivos de teste...
✅ src/test-memory.test.ts encontrado
✅ src/test-audio-comprehensive.ts encontrado

🔨 Compilando TypeScript...
[1/3] Executando compilação...
  [Clean] Diretório dist removido
✅ Compilação bem-sucedida

[2/3] Executando Memory Service (12 testes)
  🧪 INICIANDO TESTES DO MEMORY SERVICE
  ============================================================
  📋 Teste 1: Conexão PostgreSQL
     [Mock Postgres] Query: CREATE TABLE IF NOT EXISTS...
  ✅ Teste 1: Conexão PostgreSQL
  ...
  ✅ Memory Service concluído com sucesso

[3/3] Executando Audio Service (6 testes)
  🧪 INICIANDO TESTES DO AUDIO SERVICE
  ============================================================
  📋 Teste 1: Geração simples de áudio
     [Cache SET] Chave: audio:tts:d3444a1926... TTL: 24h
  ✅ Teste 1: Geração simples de áudio
  ...
  ✅ Audio Service concluído com sucesso

==================================================
📊 RESULTADO FINAL
==================================================
✅ 18/18 testes passaram (100%)

🎉 Projeto pronto para produção!
==================================================

💡 PRÓXIMOS PASSOS SUGERIDOS:
  1. ✅ Commit das alterações
  2. ✅ Push para repositório remoto
  3. ⏭️  Configurar CI/CD para rodar testes automaticamente
  4. ⏭️  Considerar aumentar cobertura de testes
  5. ⏭️  Documentar novas funcionalidades

📄 Log salvo em: test-results-2026-03-10T12-53-12.log
⏱️  Tempo total: 16.27s
```

---

## Exit Codes

| Código | Significado | Quando ocorre |
|--------|-------------|---------------|
| `0` | ✅ Sucesso | Todos testes passaram |
| `1` | ❌ Erro | - Node.js/npm não encontrado<br>- Arquivos de teste ausentes<br>- Compilação falhou<br>- Algum teste falhou<br>- Erro inesperado |

**Uso em CI/CD:**

```bash
node run-tests.js
if [ $? -eq 0 ]; then
  echo "✅ Testes passaram - pode fazer deploy"
else
  echo "❌ Testes falharam - corrigir antes de deploy"
  exit 1
fi
```

---

## Estrutura de Output

### Progresso em Tempo Real

Cada linha do output dos testes é exibida instantaneamente, permitindo monitoramento em tempo real.

### Contadores

- `[1/3]`, `[2/3]`, `[3/3]` - Etapas do processo
- `✅ 12/12 testes passaram` - Por serviço
- `✅ 18/18 testes passaram (100%)` - Total final

### Logs Detalhados

Os testes themselves emitem logs como:
- `[Mock Postgres] Query: ...`
- `[Cache SET] Chave: ...`
- `[Cache HIT] Chave: ...`
- `Latência: 520ms`

---

## Troubleshooting

### Erro: "Node.js não encontrado"

**Solução:** Instale Node.js 18+ de https://nodejs.org/

### Erro: "Arquivo src/test-memory.test.ts não encontrado"

**Solução:** Verifique se os arquivos de teste estão na pasta `src/`:
```bash
ls src/test-memory.test.ts
ls src/test-audio-comprehensive.ts
```

### Erro: "Falha na compilação"

**Solução:** 
1. Verifique se há erros TypeScript nos arquivos fonte:
```bash
npx tsc --noEmit
```
2. Limpe e recompile manualmente:
```bash
rm -rf dist  # No Windows: rmdir /s dist
npx tsc
```

### Erro: "Arquivo dist/test-memory.test.js não encontrado"

**Solução:** A compilação falhou. Veja o log de erro acima e corrija os erros TypeScript.

### Testes passando mas exit code 1

**Causa:** O script captura o exit code dos testes. Se os testes individuais retornarem código não-zero, o script também retorna.

**Solução:** Verifique o output - algum teste específico falhou.

### Log não é gerado

**Causa:** Permissões de escrita na pasta atual.

**Solução:** Verifique se o diretório é gravável:
```bash
touch test.log && rm test.log
```

---

## Arquivos Gerados

### Log de Testes

```
test-results-2026-03-10T12-53-12.log
```

**Conteúdo:**
- Timestamp de cada linha
- Todo output do terminal
- Inclui erros e warnings
- Formato: `[ISO_TIMESTAMP] mensagem`

**Uso:**
```bash
# Ver log completo
cat test-results-*.log

# Buscar erros
grep -i error test-results-*.log

# Ver apenas resumo
tail -20 test-results-*.log
```

### Diretório `dist/`

Reconstruído a cada execução. Contém:
- `test-memory.test.js` - Testes do Memory Service
- `test-audio-comprehensive.js` - Testes do Audio Service
- Outros arquivos compilados do projeto

---

## Customização

### Alterar Comandos de Build

Edite linha 181 em `run-tests.js`:
```javascript
const buildProcess = exec('npx tsc', ...);
// Para usar npm run build (cuidado com prebuild no Windows):
// const buildProcess = exec('npm run build', ...);
```

### Alterar Timeout de Testes

Os testes individuais podem ter timeouts configurados em seus arquivos fonte. Edite:
- `src/test-memory.test.ts` - timeouts de mock
- `src/test-audio-comprehensive.ts` - latência simulada (linha 42)

### Desabilitar Limpeza Automática

Comente linha 178-181 em `run-tests.js`:
```javascript
// if (existsSync('dist')) {
//   rmSync('dist', { recursive: true, force: true });
// }
```

---

## Integração com CI/CD

### GitHub Actions

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: node run-tests.js
```

### GitLab CI

```yaml
test:
  script:
    - npm ci
    - node run-tests.js
  artifacts:
    paths:
      - test-results-*.log
    when: always
```

### Jenkins

```groovy
stage('Test') {
  steps {
    sh 'npm ci'
    sh 'node run-tests.js'
  }
  post {
    always {
      archiveArtifacts artifacts: 'test-results-*.log'
    }
  }
}
```

---

## Comparação com Testes Manuais

| Aspecto | Manual | run-tests.js |
|---------|--------|--------------|
| Compilação | `npm run build` | ✅ Automática |
| Ordem de testes | Lembrar manualmente | ✅ Sequencial garantida |
| Logging |分散 | ✅ Consolidado com timestamp |
| Exit code | Verificar manualmente | ✅ Automático (0/1) |
| Tempo total | Anotar manualmente | ✅ Calculado automaticamente |
| Sugestões | Nenhuma | ✅ Baseadas no resultado |
| Log file | Criar manualmente | ✅ Gerado automaticamente |

---

## Boas Práticas

1. **Sempre execute antes de commit:**
```bash
node run-tests.js
git add .
git commit -m "feat: nova funcionalidade com testes passando"
```

2. **Use o log para debug:**
```bash
# Se falhar, examine o log
cat test-results-*.log | less
```

3. **Não commitar arquivos `dist/`:**
```gitignore
/dist/
```

4. **Mantenha testes atualizados:**
- Adicione novos testes em `src/test-*.ts`
- Atualize `expectedTests` no array `tests` em `run-tests.js`

5. **Teste em ambiente limpo:**
```bash
# Limpe tudo e teste do zero
rm -rf dist node_modules
npm ci
node run-tests.js
```

---

## Suporte

Em caso de problemas:

1. Verifique o arquivo de log gerado
2. Consulte `TESTES.md` para detalhes sobre testes individuais
3. Verifique `package.json` para scripts disponíveis
4. Abra uma issue com:
   - Versão do Node.js (`node --version`)
   - Sistema operacional
   - Output completo do erro
   - Passos para reproduzir

---

**Última atualização:** 2025-03-10  
**Versão do script:** 1.0.0  
**Autor:** Test Engineer - Mestre Bot Team
