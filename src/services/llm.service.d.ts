export interface LLMResponse {
    text: string;
    type: 'text' | 'audio' | 'image';
    imageTheme?: string;
}
export interface MediaPart {
    data: string;
    mimeType: string;
}
declare class LLMService {
    generateResponse(message: string, userContext: any, media?: MediaPart): Promise<LLMResponse>;
}
export declare const llmService: LLMService;
export {};
//# sourceMappingURL=llm.service.d.ts.map