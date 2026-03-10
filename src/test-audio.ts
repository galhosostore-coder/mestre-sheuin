import * as dotenv from 'dotenv';
import { audioService } from './services/audio.service.js';

dotenv.config();

async function run() {
    try {
        console.log('Testing ElevenLabs TTS integration...');
        const base64Audio = await audioService.generateAudioFromText('Olá, eu sou o Gregory Grumble. Estou testando a nova integração!');
        
        console.log('Sucesso! Áudio gerado.');
        console.log(`Base64 (primeiros 100 caracteres): ${base64Audio.substring(0, 100)}...`);
        console.log(`Tamanho total: ${base64Audio.length} caracteres`);
    } catch (error) {
        console.error('Erro no teste:', error);
    }
}

run();
