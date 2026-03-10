export declare class HumanizationService {
    /**
     * Calcula um delay em milissegundos para simular digitação ou gravação de áudio.
     * @param text O texto que será enviado/falado.
     * @param type Tipo de mensagem (text ou audio)
     * @returns O delay calculado em milissegundos.
     */
    calculateDelay(text: string, type: 'text' | 'audio' | 'image'): number;
    /**
     * Obtém a data/hora atual no fuso horário de Brasília (UTC-3)
     */
    private getBrtDate;
    /**
     * Verifica se é horário de dormir (22:00 às 06:00 BRT).
     * O Mestre Sábio descansa nesse horário.
     */
    isSleepingTime(): boolean;
    /**
     * Retorna os milissegundos restantes até as 06:00 BRT para acordar.
     */
    getMsUntilWakeUp(): number;
    /**
     * Injeta pequenos erros de digitação para parecer humano (apenas para texto).
     */
    injectTypos(text: string): string;
}
export declare const humanizationService: HumanizationService;
//# sourceMappingURL=humanization.service.d.ts.map