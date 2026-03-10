import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { whatsappService } from './services/whatsapp.service.js';
import { memoryService } from './services/memory.service.js';
import { healthCheckRedis } from './services/queue.service.js';
import webhookRoutes from './routes/webhook.routes.js';
import { schedulerService } from './services/scheduler.service.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Rotas da API
app.use('/api/webhook', webhookRoutes);

// Healthcheck endpoints
app.get('/health', (req, res) => {
  // Liveness probe: apenas verifica se o app está rodando
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/ready', async (req, res) => {
  // Readiness probe: verifica se todos os serviços críticos estão conectados
  try {
    const [whatsappStatus, memoryStatus, redisStatus] = await Promise.allSettled([
      whatsappService.healthCheck(),
      memoryService.healthCheck(),
      healthCheckRedis()
    ]);

    const services: any = {
      whatsapp: 'unknown',
      postgres: 'unknown',
      qdrant: 'unknown',
      redis: 'unknown'
    };

    // Verificar WhatsApp
    if (whatsappStatus.status === 'fulfilled') {
      services.whatsapp = whatsappStatus.value.status;
    } else {
      services.whatsapp = 'error';
    }

    // Verificar PostgreSQL e Qdrant (do memoryService)
    if (memoryStatus.status === 'fulfilled') {
      services.postgres = memoryStatus.value.postgres.status;
      services.qdrant = memoryStatus.value.qdrant.status;
    } else {
      services.postgres = 'error';
      services.qdrant = 'error';
    }

    // Verificar Redis
    if (redisStatus.status === 'fulfilled') {
      services.redis = redisStatus.value.status;
    } else {
      services.redis = 'error';
    }

    // Determinar status geral
    const allConnected = 
      services.whatsapp === 'connected' &&
      services.postgres === 'connected' &&
      services.qdrant === 'connected' &&
      services.redis === 'connected';

    const response = {
      status: allConnected ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      services
    };

    if (allConnected) {
      res.status(200).json(response);
    } else {
      res.status(503).json(response);
    }
  } catch (error: any) {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message || 'Health check failed',
      services: {
        whatsapp: 'unknown',
        postgres: 'unknown',
        qdrant: 'unknown',
        redis: 'unknown'
      }
    });
  }
});

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
