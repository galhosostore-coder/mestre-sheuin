import { memoryService } from './services/memory.service.js';

async function testMemory() {
  console.log('=== Teste do Memory Service (State of the Art) ===');
  
  const userId = '123456789';

  console.log('1. Adicionando mensagem com fatos relevantes...');
  // Aguarda um momento para a inicialização assíncrona do construtor
  await new Promise(resolve => setTimeout(resolve, 2000));

  await memoryService.addMessage(userId, 'user', 'Olá, meu nome é Carlos. Eu sou médico e tenho 40 anos. Gosto de correr nos finais de semana e tenho dores no joelho.');
  
  // A extração é em background, então esperamos um pouco
  console.log('Esperando extração em background...');
  await new Promise(resolve => setTimeout(resolve, 10000));

  console.log('2. Adicionando resposta do assistente...');
  await memoryService.addMessage(userId, 'assistant', 'Olá Carlos, é um prazer conhecê-mo. Compreendo as dores no joelho.');

  console.log('3. Buscando contexto RAG para uma nova interação...');
  const context = await memoryService.getUserContext(userId, 'O que você me recomenda para as dores que te falei?');
  
  console.log('\n=== Contexto Injetado no LLM ===');
  console.log(context);
  console.log('==================================');
  
  process.exit(0);
}

testMemory().catch(console.error);
