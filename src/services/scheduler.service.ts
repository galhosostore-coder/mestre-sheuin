import cron from 'node-cron';
import { memoryService } from './memory.service.js';
import { addToSystemQueue } from './queue.service.js';

class SchedulerService {
    public init() {
        cron.schedule('0 * * * *', async () => {
            console.log('[SchedulerService] Executando cron horário de carrinhos abandonados...');
            try {
                await this.processAbandonedCarts();
                console.log('[SchedulerService] Cron de carrinhos abandonados concluído.');
            } catch (error) {
                console.error('[SchedulerService] Erro durante a execução do cron de abandono:', error);
            }
        }, {
            timezone: "America/Sao_Paulo"
        });

        cron.schedule('0 9 * * *', async () => {
            console.log('[SchedulerService] Executando cron diário de LTV pós-compra...');
            try {
                await this.processFollowUp(1, "Agradeça a compra que ele fez ontem sem parecer um vendedor. Diga que as ervas estão a caminho.");
                await this.processFollowUp(14, "Mande uma mensagem aleatória perguntando como a pessoa está e se as dores diminuíram. Apenas isso.");
                await this.processFollowUp(25, "Mande uma mensagem dizendo que o mês voou e que, para a árvore não secar, ele deve renovar o frasco. Ofereça o link de renovação.");
                console.log('[SchedulerService] Cron diário concluído com sucesso.');
            } catch (error) {
                console.error('[SchedulerService] Erro durante a execução do cron:', error);
            }
        }, {
            timezone: "America/Sao_Paulo"
        });
        console.log('[SchedulerService] Cron job agendado para rodar todos os dias às 09:00 (America/Sao_Paulo).');
    }

    private async processAbandonedCarts() {
        try {
            const carts = await memoryService.getAbandonedCarts();
            
            for (const cart of carts) {
                console.log(`[SchedulerService] Processando abandono de carrinho para ${cart.user_id}`);
                
                const promptText = `[SISTEMA - IMPORTANTE: O usuário gerou um pedido para o produto "${cart.product_name}" mas não pagou faz algumas horas. Pergunte com sabedoria e sem soar vendedor se aconteceu algo no caminho com o Pix/Boleto e se ele precisa de ajuda.]`;
                
                const delayMs = Math.floor(Math.random() * 30000); // Até 30s
                
                await addToSystemQueue({
                    userId: cart.user_id,
                    text: promptText,
                }, delayMs);

                await memoryService.markCartAsFollowedUp(cart.user_id, cart.product_name);
            }
        } catch (error) {
            console.error(`[SchedulerService] Erro ao processar carrinhos abandonados:`, error);
        }
    }

    private async processFollowUp(daysAgo: number, systemEventInstruction: string) {
        try {
            const sales = await memoryService.getSalesByDaysAgo(daysAgo);
            
            for (const sale of sales) {
                console.log(`[SchedulerService] Processando LTV de ${daysAgo} dias para ${sale.user_id}`);
                
                const promptText = `[SISTEMA - IMPORTANTE: Você precisa iniciar uma interação com este cliente! Não espere ele falar. Aja como o Mestre e cumpra esta diretriz agora mesmo: ${systemEventInstruction}]`;
                
                const delayMs = Math.floor(Math.random() * 60000); // Até 60s
                
                await addToSystemQueue({
                    userId: sale.user_id,
                    text: promptText,
                }, delayMs);
            }
        } catch (error) {
            console.error(`[SchedulerService] Erro ao processar LTV de ${daysAgo} dias:`, error);
        }
    }
}

export const schedulerService = new SchedulerService();
