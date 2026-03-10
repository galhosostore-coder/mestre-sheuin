export declare class AudioService {
    /**
     * Gera um áudio TTS a partir do texto usando ElevenLabs e retorna em formato base64.
     * @param text O texto a ser falado
     * @returns Uma string em base64 do áudio
     */
    generateAudioFromText(text: string): Promise<string>;
}
export declare const audioService: AudioService;
//# sourceMappingURL=audio.service.d.ts.map