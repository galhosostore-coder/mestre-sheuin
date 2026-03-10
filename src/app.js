import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { whatsappService } from './services/whatsapp.service.js';
import webhookRoutes from './routes/webhook.routes.js';
import { schedulerService } from './services/scheduler.service.js';
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());
// Rotas da API
app.use('/api/webhook', webhookRoutes);
// Inicia o Scheduler de LTV
schedulerService.init();
// Inicia o Servidor Express
app.listen(PORT, () => {
    console.log(`[Mestre Bot] Servidor Express rodando na porta ${PORT}`);
});
console.log('[Mestre Bot] Iniciando o cliente do WhatsApp...');
whatsappService.start().catch((err) => {
    console.error('[Mestre Bot] Erro ao inicializar o cliente WhatsApp:', err);
});
export const client = whatsappService.getClient();
//# sourceMappingURL=app.js.map