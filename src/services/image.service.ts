import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
});

export class ImageService {
  private imagesDir: string;

  constructor() {
    this.imagesDir = process.env.IMAGE_CACHE_DIR || '/data/images';
    this.ensureDirectoryExists();
  }

  private ensureDirectoryExists() {
    if (!fs.existsSync(this.imagesDir)) {
      fs.mkdirSync(this.imagesDir, { recursive: true });
    }
  }

  public async generateOrGetImage(theme: string): Promise<{ data: string, mimeType: string }> {
    try {
      const normalizedTheme = theme.toLowerCase().trim().replace(/[^a-z0-9]/g, '_');
      
      const existingFiles = fs.readdirSync(this.imagesDir);
      const themeFiles = existingFiles.filter(file => file.startsWith(`${normalizedTheme}_`) && file.endsWith('.png'));

      if (themeFiles.length > 0) {
        const randomFile = themeFiles[Math.floor(Math.random() * themeFiles.length)] as string;
        const filePath = path.join(this.imagesDir, randomFile);
        console.log(`[ImageService] Usando imagem em cache para o tema: ${theme} -> ${randomFile}`);
        const imageBuffer = fs.readFileSync(filePath);
        return { data: imageBuffer.toString('base64'), mimeType: 'image/png' };
      }

      console.log(`[ImageService] Gerando nova imagem para o tema: ${theme} com gemini-2.0-flash-exp...`);
      
      const promptMap: Record<string, string> = {
        'cha': 'Uma xícara de chá fumegante em uma mesa rústica de madeira, estilo oriental e calmo, luz suave.',
        'natureza': 'Uma paisagem muito bonita e relaxante com árvores verdes, cachoeira e luz do sol suave, estilo realista e pacífico.',
        'bambu': 'Uma floresta de bambus iluminada pela luz da manhã, folhas caindo lentamente, estilo zen e sereno.'
      };

      const finalPrompt: string = promptMap[normalizedTheme] || `Uma imagem realista, calma e serena representando o seguinte tema: ${theme}. Estilo pacífico e oriental, fotorrealista.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.0-flash-exp',
        contents: finalPrompt
      });

      if (response.candidates?.[0]?.content?.parts) {
        const parts = response.candidates[0].content.parts;
        const inlineDataPart = parts.find(p => p.inlineData);
        if (inlineDataPart && inlineDataPart.inlineData) {
           const mimeType = inlineDataPart.inlineData.mimeType || 'image/png';
           const base64Data = inlineDataPart.inlineData.data || '';

           const uniqueId = crypto.randomBytes(4).toString('hex');
           // Assumindo que geralmente o Gemini retorna image/png, mas adaptando caso necessário
           const extension = mimeType.split('/')[1] || 'png';
           const newFileName = `${normalizedTheme}_${uniqueId}.${extension}`;
           const newFilePath = path.join(this.imagesDir, newFileName);
           
           fs.writeFileSync(newFilePath, Buffer.from(base64Data, 'base64'));
           console.log(`[ImageService] Nova imagem salva: ${newFilePath}`);

           return { data: base64Data, mimeType };
        }
      }

      throw new Error('Falha ao gerar imagem com o modelo Gemini, nenhuma imagem retornada.');
    } catch (error) {
      console.error('[ImageService] Erro ao gerar/obter imagem:', error);
      throw error;
    }
  }
}

export const imageService = new ImageService();