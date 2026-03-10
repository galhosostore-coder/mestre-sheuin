#!/usr/bin/env node

/**
 * Script de Execução de Testes Automatizados - Mestre Bot
 *
 * Este script orquestra a execução completa dos testes:
 * 1. Verifica pré-requisitos
 * 2. Compila o projeto TypeScript
 * 3. Executa Memory Service (12 testes)
 * 4. Executa Audio Service (6 testes)
 * 5. Gera relatório com timestamp
 *
 * Uso: node run-tests.js
 */

import { exec, spawn } from 'child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { cwd } from 'process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = join(cwd(), __filename);

// Cores ANSI para terminal
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
};

// Configuração dos testes
const tests = [
  {
    name: 'Memory Service',
    file: 'dist/test-memory.test.js',
    srcFile: 'src/test-memory.test.ts',
    expectedTests: 12,
  },
  {
    name: 'Audio Service',
    file: 'dist/test-audio-comprehensive.js',
    srcFile: 'src/test-audio-comprehensive.ts',
    expectedTests: 6,
  },
];

// Estado global
let logLines = [];
let totalPassed = 0;
let totalFailed = 0;
let logFile = '';

/**
 * Adiciona linha ao log e exibe no console
 */
function log(message, color = colors.reset) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}`;
  const coloredMessage = `${color}${message}${colors.reset}`;
  
  logLines.push(logMessage);
  console.log(coloredMessage);
}

/**
 * Salva log em arquivo com timestamp
 */
function saveLog() {
  const timestamp = new Date();
  const timestampStr = timestamp.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  logFile = `test-results-${timestampStr}.log`;
  
  const logContent = logLines.join('\n') + '\n';
  
  try {
    writeFileSync(logFile, logContent);
    log(`\n📄 Log salvo em: ${logFile}`, colors.cyan);
  } catch (error) {
    log(`⚠️  Erro ao salvar log: ${error.message}`, colors.yellow);
  }
}

/**
 * Verifica se um comando está disponível
 */
function checkCommand(command) {
  return new Promise((resolve) => {
    exec(`which ${command}`, (error) => {
      resolve(!error);
    });
  });
}

/**
 * Verifica se Node.js está instalado
 */
async function checkNode() {
  log('\n🔍 Verificando pré-requisitos...', colors.cyan);
  
  const nodeVersion = await getNodeVersion();
  if (!nodeVersion) {
    log('❌ Node.js não encontrado! Instale Node.js 18+ para continuar.', colors.red);
    return false;
  }
  
  log(`✅ Node.js encontrado: ${nodeVersion}`, colors.green);
  
  // Verifica npm
  const npmVersion = await getNpmVersion();
  if (!npmVersion) {
    log('❌ npm não encontrado!', colors.red);
    return false;
  }
  
  log(`✅ npm encontrado: ${npmVersion}`, colors.green);
  
  return true;
}

/**
 * Obtém versão do Node.js
 */
function getNodeVersion() {
  return new Promise((resolve) => {
    exec('node --version', (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
}

/**
 * Obtém versão do npm
 */
function getNpmVersion() {
  return new Promise((resolve) => {
    exec('npm --version', (error, stdout) => {
      resolve(error ? null : stdout.trim());
    });
  });
}

/**
 * Verifica se arquivos de teste existem
 */
function checkTestFiles() {
  log('\n📁 Verificando arquivos de teste...', colors.cyan);
  
  let allExist = true;
  
  for (const test of tests) {
    if (existsSync(test.srcFile)) {
      log(`✅ ${test.srcFile} encontrado`, colors.green);
    } else {
      log(`❌ ${test.srcFile} não encontrado!`, colors.red);
      allExist = false;
    }
  }
  
  return allExist;
}

/**
 * Compila o projeto TypeScript
 */
async function buildProject() {
  log('\n🔨 Compilando TypeScript...', colors.cyan);
  log('[' + colors.dim + '1/3' + colors.reset + '] Executando compilação...');
  
  // Limpa diretório dist manualmente (compatível com Windows)
  try {
    if (existsSync('dist')) {
      rmSync('dist', { recursive: true, force: true });
      log('  [Clean] Diretório dist removido', colors.dim);
    }
  } catch (error) {
    log(`  [Clean] Aviso: ${error.message}`, colors.yellow);
  }
  
  return new Promise((resolve, reject) => {
    const buildProcess = exec('npx tsc', (error, stdout, stderr) => {
      // Log em tempo real
      if (stdout) {
        stdout.split('\n').forEach(line => {
          if (line.trim()) {
            log(`  ${line}`, colors.dim);
          }
        });
      }
      
      if (stderr) {
        stderr.split('\n').forEach(line => {
          if (line.trim()) {
            log(`  ${line}`, colors.yellow);
          }
        });
      }
      
      if (error) {
        log('\n❌ Falha na compilação!', colors.red);
        reject(error);
      } else {
        log('\n✅ Compilação bem-sucedida', colors.green);
        resolve();
      }
    });
    
    // Captura output em tempo real
    buildProcess.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, colors.dim);
        }
      });
    });
    
    buildProcess.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n');
      lines.forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, colors.yellow);
        }
      });
    });
  });
}

/**
 * Executa um teste individual
 */
async function runTest(test, index) {
  const step = index + 2; // Compilação é passo 1
  const totalSteps = tests.length + 1;
  
  log(`\n[${colors.dim}${step}/${totalSteps}${colors.reset}] Executando ${test.name} (${test.expectedTests} testes)`, colors.cyan);
  
  // Verifica se arquivo compilado existe
  if (!existsSync(test.file)) {
    log(`❌ Arquivo ${test.file} não encontrado! Execute a compilação primeiro.`, colors.red);
    return { passed: 0, failed: test.expectedTests };
  }
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let testPassed = 0;
    let testFailed = 0;
    
    const testProcess = spawn('node', [test.file], {
      shell: true,
      stdio: 'pipe',
    });
    
    // Captura stdout
    testProcess.stdout?.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      
      // Exibe em tempo real
      text.split('\n').forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, colors.reset);
        }
      });
      
      // Conta testes passando (baseado no output)
      if (line => line.includes('✅')) {
        testPassed++;
      }
    });
    
    // Captura stderr
    testProcess.stderr?.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      
      text.split('\n').forEach(line => {
        if (line.trim()) {
          log(`  ${line}`, colors.yellow);
        }
      });
    });
    
    testProcess.on('close', (code) => {
      if (code === 0) {
        log(`✅ ${test.name} concluído com sucesso`, colors.green);
        resolve({ passed: testPassed || test.expectedTests, failed: 0 });
      } else {
        log(`❌ ${test.name} falhou (exit code ${code})`, colors.red);
        
        // Tenta extrair número de testes falhos do output
        const failedMatch = stderr.match(/Passaram:\s*(\d+).*Falharam:\s*(\d+)/s);
        if (failedMatch) {
          const passed = parseInt(failedMatch[1]);
          const failed = parseInt(failedMatch[2]);
          resolve({ passed, failed });
        } else {
          resolve({ passed: 0, failed: test.expectedTests });
        }
      }
    });
    
    testProcess.on('error', (error) => {
      log(`❌ Erro ao executar ${test.name}: ${error.message}`, colors.red);
      resolve({ passed: 0, failed: test.expectedTests });
    });
  });
}

/**
 * Mostra resumo final
 */
function showSummary() {
  const total = totalPassed + totalFailed;
  const percentage = total > 0 ? Math.round((totalPassed / total) * 100) : 0;
  
  log('\n' + '='.repeat(50), colors.bright);
  log('📊 RESULTADO FINAL', colors.bright);
  log('='.repeat(50), colors.bright);
  
  if (totalFailed === 0) {
    log(`✅ ${totalPassed}/${total} testes passaram (${percentage}%)`, colors.green);
    log('\n🎉 Projeto pronto para produção!', colors.green);
  } else {
    log(`⚠️  ${totalPassed}/${total} testes passaram (${percentage}%)`, colors.yellow);
    log(`❌ ${totalFailed} teste(s) falharam`, colors.red);
  }
  
  log('='.repeat(50) + '\n', colors.bright);
}

/**
 * Sugere próximos passos baseado no resultado
 */
function suggestNextSteps() {
  log('💡 PRÓXIMOS PASSOS SUGERIDOS:', colors.cyan);
  
  if (totalFailed === 0) {
    log('  1. ✅ Commit das alterações', colors.green);
    log('  2. ✅ Push para repositório remoto', colors.green);
    log('  3. ⏭️  Configurar CI/CD para rodar testes automaticamente', colors.dim);
    log('  4. ⏭️  Considerar aumentar cobertura de testes', colors.dim);
    log('  5. ⏭️  Documentar novas funcionalidades', colors.dim);
  } else {
    log('  1. ❌ Analisar logs de erro detalhados', colors.red);
    log('  2. ❌ Verificar arquivo de log: ' + logFile, colors.yellow);
    log('  3. ❌ Executar testes individualmente para isolar problemas', colors.yellow);
    log('  4. ❌ Verificar variáveis de ambiente (.env)', colors.yellow);
    log('  5. ❌ Corrigir falhas e reexecutar este script', colors.red);
  }
  
  log('');
}

/**
 * Função principal
 */
async function main() {
  const startTime = Date.now();
  
  // Header
  log('\n' + '🚀'.repeat(25), colors.bright);
  log('🚀 INICIANDO TESTES COMPLETOS DO MESTRE BOT', colors.bright);
  log('🚀'.repeat(25) + '\n', colors.bright);
  
  try {
    // 1. Verificar pré-requisitos
    if (!(await checkNode())) {
      process.exit(1);
    }
    
    // 2. Verificar arquivos de teste
    if (!checkTestFiles()) {
      log('\n❌ Alguns arquivos de teste não encontrados. Corrija antes de continuar.', colors.red);
      process.exit(1);
    }
    
    // 3. Compilar projeto
    try {
      await buildProject();
    } catch (error) {
      saveLog();
      process.exit(1);
    }
    
    // 4. Executar testes na ordem
    for (let i = 0; i < tests.length; i++) {
      const result = await runTest(tests[i], i);
      totalPassed += result.passed;
      totalFailed += result.failed;
    }
    
    // 5. Mostrar resumo
    showSummary();
    
    // 6. Sugerir próximos passos
    suggestNextSteps();
    
    // 7. Salvar log
    saveLog();
    
    // 8. Calcular tempo total
    const duration = Date.now() - startTime;
    log(`⏱️  Tempo total: ${(duration / 1000).toFixed(2)}s\n`, colors.dim);
    
    // Exit code
    process.exit(totalFailed > 0 ? 1 : 0);
    
  } catch (error) {
    log(`\n💥 Erro inesperado: ${error.message}`, colors.red);
    log(error.stack, colors.dim);
    saveLog();
    process.exit(1);
  }
}

// Executar
main();
