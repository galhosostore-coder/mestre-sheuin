#!/usr/bin/env node

import { Client } from 'node-ssh';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Configuração para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Carregar variáveis de ambiente
dotenv.config();

// Configurações da VPS
const VPS_CONFIG = {
  host: '144.91.69.65',
  username: 'root',
  password: process.env.SSH_PASSWORD || '',
  port: 22
};

// Caminhos remotos
const REMOTE_PATHS = {
  home: '/root',
  projectDir: '/root/mestre-bot',
  tarFile: '/root/backend.tar',
  envFile: '/root/mestre-bot/.env'
};

// Arquivos locais
const LOCAL_FILES = {
  tar: path.join(__dirname, 'backend.tar'),
  envExample: path.join(__dirname, '.env.example')
};

// Instância SSH
const ssh = new Client();

// Cores para output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, message) {
  console.log(`\n${colors.cyan}${colors.bright}=== ${step} ===${colors.reset}`);
  console.log(`${colors.cyan}${message}${colors.reset}`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

async function checkLocalFiles() {
  logStep('1. VERIFICAÇÃO DE ARQUIVOS LOCAIS', 'Verificando arquivos necessários...');

  const missingFiles = [];

  if (!fs.existsSync(LOCAL_FILES.tar)) {
    missingFiles.push('backend.tar');
  }

  if (!fs.existsSync(LOCAL_FILES.envExample)) {
    missingFiles.push('.env.example');
  }

  if (missingFiles.length > 0) {
    logError(`Arquivos locais não encontrados: ${missingFiles.join(', ')}`);
    return false;
  }

  const tarStats = fs.statSync(LOCAL_FILES.tar);
  logSuccess(`Arquivos locais verificados (backend.tar: ${(tarStats.size / 1024 / 1024).toFixed(2)} MB)`);
  return true;
}

async function connectSSH() {
  logStep('2. CONEXÃO SSH', `Conectando a ${VPS_CONFIG.host}...`);

  try {
    await ssh.connect({
      host: VPS_CONFIG.host,
      username: VPS_CONFIG.username,
      password: VPS_CONFIG.password,
      port: VPS_CONFIG.port
    });
    logSuccess('Conexão SSH estabelecida com sucesso');
    return true;
  } catch (error) {
    logError(`Falha na conexão SSH: ${error.message}`);
    return false;
  }
}

async function uploadFiles() {
  logStep('3. UPLOAD DE ARQUIVOS', 'Enviando backend.tar para a VPS...');

  try {
    const startTime = Date.now();
    
    await ssh.putFile(
      LOCAL_FILES.tar,
      REMOTE_PATHS.tarFile
    );

    const elapsed = (Date.now() - startTime) / 1000;
    const tarStats = fs.statSync(LOCAL_FILES.tar);
    const speed = (tarStats.size / 1024 / 1024) / elapsed;
    
    logSuccess(`Upload concluído em ${elapsed.toFixed(2)}s (${speed.toFixed(2)} MB/s)`);
    return true;
  } catch (error) {
    logError(`Falha no upload: ${error.message}`);
    return false;
  }
}

async function executeRemoteCommand(command, description, critical = true) {
  logStep(description.split(' - ')[0] || description, description);
  
  try {
    const result = await ssh.execCommand(command, {
      cwd: REMOTE_PATHS.projectDir,
      stream: 'stdout'
    });

    if (result.stdout) {
      console.log(result.stdout);
    }

    if (result.stderr) {
      console.log(`${colors.yellow}${result.stderr}${colors.reset}`);
    }

    if (result.exitCode !== 0) {
      if (critical) {
        logError(`Comando falhou com código ${result.exitCode}`);
        return { success: false, exitCode: result.exitCode };
      } else {
        logWarning(`Comando retornou código ${result.exitCode} (não crítico)`);
        return { success: true, exitCode: result.exitCode };
      }
    }

    logSuccess('Comando executado com sucesso');
    return { success: true, exitCode: result.exitCode };
  } catch (error) {
    logError(`Erro ao executar comando: ${error.message}`);
    return { success: false, error };
  }
}

async function prepareRemoteEnvironment() {
  logStep('4. PREPARAÇÃO DO AMBIENTE REMOTO', 'Configurando diretórios e extraindo arquivos...');

  // Criar diretório do projeto
  const mkdirResult = await executeRemoteCommand(
    `mkdir -p ${REMOTE_PATHS.projectDir}`,
    '4.1 - Criar diretório do projeto'
  );

  if (!mkdirResult.success) return false;

  // Extrair arquivo tar
  const extractResult = await executeRemoteCommand(
    `tar -xzf ${REMOTE_PATHS.tarFile} -C ${REMOTE_PATHS.projectDir}`,
    '4.2 - Extrair backend.tar'
  );

  if (!extractResult.success) return false;

  // Verificar se a extração criou os arquivos
  const checkResult = await executeRemoteCommand(
    `ls -la ${REMOTE_PATHS.projectDir}`,
    '4.3 - Verificar arquivos extraídos'
  );

  if (!checkResult.success) return false;

  return true;
}

async function setupEnvironment() {
  logStep('5. CONFIGURAÇÃO DO .ENV', 'Configurando variáveis de ambiente...');

  try {
    // Verificar se .env.example existe
    const checkEnv = await ssh.execCommand(
      `test -f ${REMOTE_PATHS.projectDir}/.env.example && echo "exists" || echo "missing"`,
      { cwd: REMOTE_PATHS.projectDir }
    );

    if (!checkEnv.stdout.includes('exists')) {
      logError('.env.example não encontrado no diretório remoto');
      return false;
    }

    // Copiar .env.example para .env
    const copyResult = await executeRemoteCommand(
      `cp ${REMOTE_PATHS.projectDir}/.env.example ${REMOTE_PATHS.projectDir}/.env`,
      '5.1 - Copiar .env.example para .env'
    );

    if (!copyResult.success) return false;

    logSuccess('Arquivo .env configurado');
    logWarning('Lembre-se de editar o .env com as configurações reais da VPS');
    
    return true;
  } catch (error) {
    logError(`Erro na configuração do .env: ${error.message}`);
    return false;
  }
}

async function installDependencies() {
  logStep('6. INSTALAÇÃO DE DEPENDÊNCIAS', 'Instalando pacotes npm...');

  const installResult = await executeRemoteCommand(
    'npm install',
    '6.1 - npm install',
    true
  );

  if (!installResult.success) return false;

  // Verificar se node_modules foi criado
  const checkResult = await executeRemoteCommand(
    'test -d node_modules && echo "installed" || echo "failed"',
    '6.2 - Verificar instalação'
  );

  if (!checkResult.stdout.includes('installed')) {
    logError('node_modules não foi criado corretamente');
    return false;
  }

  return true;
}

async function buildProject() {
  logStep('7. BUILD DO PROJETO', 'Compilando TypeScript...');

  const buildResult = await executeRemoteCommand(
    'npm run build',
    '7.1 - npm run build',
    true
  );

  if (!buildResult.success) return false;

  // Verificar se dist foi criado
  const checkResult = await executeRemoteCommand(
    'test -d dist && echo "built" || echo "failed"',
    '7.2 - Verificar build'
  );

  if (!checkResult.stdout.includes('built')) {
    logError('Diretório dist não foi criado');
    return false;
  }

  return true;
}

async function startDockerContainers() {
  logStep('8. INICIALIZAÇÃO DOCKER', 'Subindo containers...');

  // Verificar se docker-compose existe
  const checkInfra = await ssh.execCommand(
    'test -f docker-compose-infra.yml && echo "exists" || echo "missing"',
    { cwd: REMOTE_PATHS.projectDir }
  );

  if (checkInfra.stdout.includes('exists')) {
    const infraResult = await executeRemoteCommand(
      'docker-compose -f docker-compose-infra.yml up -d',
      '8.1 - Subir infraestrutura (docker-compose-infra.yml)',
      false // Não crítico, pode já estar rodando
    );
    
    if (!infraResult.success) {
      logWarning('Infraestrutura pode já estar em execução');
    }
  } else {
    logWarning('docker-compose-infra.yml não encontrado');
  }

  // Aguardar um momento para infraestrutura iniciar
  log('Aguardando 10 segundos para infraestrutura inicializar...', 'yellow');
  await new Promise(resolve => setTimeout(resolve, 10000));

  // Subir backend
  const checkBackend = await ssh.execCommand(
    'test -f docker-compose-backend.yml && echo "exists" || echo "missing"',
    { cwd: REMOTE_PATHS.projectDir }
  );

  if (checkBackend.stdout.includes('exists')) {
    const backendResult = await executeRemoteCommand(
      'docker-compose -f docker-compose-backend.yml up -d',
      '8.2 - Subir backend (docker-compose-backend.yml)',
      true
    );

    if (!backendResult.success) return false;
  } else {
    logWarning('docker-compose-backend.yml não encontrado');
  }

  return true;
}

async function showLogs() {
  logStep('9. LOGS DOS CONTAINERS', 'Exibindo logs dos containers...');

  try {
    // Verificar containers em execução
    const psResult = await ssh.execCommand(
      'docker ps --format "table {{.Names}}\\t{{.Status}}\\t{{.Ports}}"',
      { cwd: REMOTE_PATHS.projectDir }
    );

    if (psResult.stdout) {
      console.log(`${colors.cyan}Containers em execução:${colors.reset}`);
      console.log(psResult.stdout);
    }

    // Mostrar logs dos últimos 50 linhas
    const logsResult = await ssh.execCommand(
      'docker-compose -f docker-compose-backend.yml logs --tail=50',
      { cwd: REMOTE_PATHS.projectDir }
    );

    if (logsResult.stdout) {
      console.log(`\n${colors.cyan}Últimas 50 linhas dos logs:${colors.reset}`);
      console.log(logsResult.stdout);
    }

    return true;
  } catch (error) {
    logError(`Erro ao exibir logs: ${error.message}`);
    return false;
  }
}

async function verifyDeployment() {
  logStep('10. VERIFICAÇÃO FINAL', 'Verificando status do deploy...');

  try {
    // Verificar se containers estão rodando
    const checkResult = await ssh.execCommand(
      'docker-compose -f docker-compose-backend.yml ps',
      { cwd: REMOTE_PATHS.projectDir }
    );

    if (checkResult.stdout) {
      console.log(checkResult.stdout);
    }

    // Verificar se porta está acessível
    const portResult = await ssh.execCommand(
      'netstat -tuln | grep :3000 || echo "Porta 3000 não está ouvindo"',
      { cwd: REMOTE_PATHS.projectDir }
    );

    if (portResult.stdout && portResult.stdout.includes('3000')) {
      logSuccess('Aplicação está rodando na porta 3000');
    } else {
      logWarning('Porta 3000 não detectada (pode estar em outra porta)');
    }

    return true;
  } catch (error) {
    logError(`Erro na verificação: ${error.message}`);
    return false;
  }
}

async function cleanup() {
  try {
    await ssh.dispose();
  } catch (error) {
    // Ignorar erros de cleanup
  }
}

async function runDeploy() {
  log('\n' + '='.repeat(60), 'bright');
  log('  DEPLOY AUTOMATIZADO - MESTRE BOT', 'green');
  log('  VPS: 144.91.69.65', 'cyan');
  log('='.repeat(60) + '\n', 'bright');

  try {
    // 1. Verificar arquivos locais
    if (!await checkLocalFiles()) {
      await cleanup();
      process.exit(1);
    }

    // 2. Conectar SSH
    if (!await connectSSH()) {
      await cleanup();
      process.exit(1);
    }

    // 3. Upload de arquivos
    if (!await uploadFiles()) {
      await cleanup();
      process.exit(1);
    }

    // 4. Preparar ambiente remoto
    if (!await prepareRemoteEnvironment()) {
      await cleanup();
      process.exit(1);
    }

    // 5. Configurar .env
    if (!await setupEnvironment()) {
      await cleanup();
      process.exit(1);
    }

    // 6. Instalar dependências
    if (!await installDependencies()) {
      await cleanup();
      process.exit(1);
    }

    // 7. Build do projeto
    if (!await buildProject()) {
      await cleanup();
      process.exit(1);
    }

    // 8. Iniciar containers Docker
    if (!await startDockerContainers()) {
      await cleanup();
      process.exit(1);
    }

    // 9. Mostrar logs
    await showLogs();

    // 10. Verificação final
    await verifyDeployment();

    log('\n' + '='.repeat(60), 'green');
    log('  DEPLOY CONCLUÍDO COM SUCESSO!', 'green');
    log('='.repeat(60) + '\n', 'green');

    log('Próximos passos:', 'cyan');
    log('1. Verifique se o .env está configurado corretamente na VPS', 'reset');
    log('2. Acesse http://144.91.69.65:3000 (ou a porta configurada)', 'reset');
    log('3. Monitore os logs: docker-compose -f docker-compose-backend.yml logs -f', 'reset');
    log('');

  } catch (error) {
    logError(`Erro inesperado: ${error.message}`);
    console.error(error);
  } finally {
    await cleanup();
  }
}

// Executar deploy
runDeploy().catch(error => {
  logError(`Falha crítica: ${error.message}`);
  process.exit(1);
});
