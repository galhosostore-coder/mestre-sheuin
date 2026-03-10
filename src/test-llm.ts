import { llmService } from './services/llm.service.js';

async function runTest() {
  console.log('Testing text-only message...');
  const textResponse = await llmService.generateResponse('Olá, preciso de ajuda com minha ansiedade.', { name: 'João' });
  console.log('Text Response:', textResponse);

  console.log('Testing media message...');
  // Simula uma imagem de 1x1 pixel base64
  const fakeImage = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  const mediaResponse = await llmService.generateResponse('Veja esta imagem e me ajude.', { name: 'João' }, { data: fakeImage, mimeType: 'image/png' });
  console.log('Media Response:', mediaResponse);
}

runTest().catch(console.error);
