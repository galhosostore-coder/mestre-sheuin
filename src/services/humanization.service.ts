export class HumanizationService {
  /**
   * Calcula um delay em milissegundos para simular digitação ou gravação de áudio.
   * @param text O texto que será enviado/falado.
   * @param type Tipo de mensagem (text ou audio)
   * @returns O delay calculado em milissegundos.
   */
  public calculateDelay(text: string, type: 'text' | 'audio' | 'image'): number {
    const length = text.length;
    // O Mestre Sábio digita devagar e com calma.
    // Usamos 80ms a 120ms por caractere para texto e imagem.
    // Para áudio, a fala é mais rápida, digamos 50ms a 80ms por caractere.
    
    const minMsPerChar = type === 'audio' ? 50 : 80;
    const maxMsPerChar = type === 'audio' ? 80 : 120;
    
    // Adiciona um tempo base de reação (pensamento) de 1s a 3s.
    const baseReactionTime = Math.floor(Math.random() * 2000) + 1000;
    
    const msPerChar = Math.floor(Math.random() * (maxMsPerChar - minMsPerChar + 1)) + minMsPerChar;
    
    let delay = baseReactionTime + (length * msPerChar);
    
    // Limita o delay máximo para não demorar absurdamente (ex: max 20 segundos)
    const MAX_DELAY = 20000;
    if (delay > MAX_DELAY) delay = MAX_DELAY;
    
    return delay;
  }

  /**
   * Obtém a data/hora atual no fuso horário de Brasília (UTC-3)
   */
  private getBrtDate(): Date {
    const now = new Date();
    // UTC é +0, BRT é -3. Então subtraímos 3 horas do epoch.
    // Usamos getTime() para pegar o timestamp em ms.
    // Isso garante independência do fuso horário da máquina.
    return new Date(now.getTime() - (3 * 3600000));
  }

  /**
   * Verifica se é horário de dormir (22:00 às 06:00 BRT).
   * O Mestre Sábio descansa nesse horário.
   */
  public isSleepingTime(): boolean {
    const brtDate = this.getBrtDate();
    const hour = brtDate.getUTCHours();
    return hour >= 22 || hour < 6;
  }

  /**
   * Retorna os milissegundos restantes até as 06:00 BRT para acordar.
   */
  public getMsUntilWakeUp(): number {
    const brtDate = this.getBrtDate();
    let wakeUpBrtDate = new Date(brtDate.getTime());
    wakeUpBrtDate.setUTCHours(6, 0, 0, 0);
    
    // Se passou das 22h, ele acorda às 06h do dia seguinte
    if (brtDate.getUTCHours() >= 22) {
      wakeUpBrtDate.setUTCDate(wakeUpBrtDate.getUTCDate() + 1);
    }
    
    const msDiff = wakeUpBrtDate.getTime() - brtDate.getTime();
    return msDiff > 0 ? msDiff : 0;
  }

  /**
   * Injeta pequenos erros de digitação para parecer humano (apenas para texto).
   */
  public injectTypos(text: string): string {
    // O Sábio não comete erros de digitação. Removido a pedido do usuário.
    return text;
  }
}

export const humanizationService = new HumanizationService();