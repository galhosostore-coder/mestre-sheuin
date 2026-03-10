import { Router } from 'express';
import { braipWebhook } from '../controllers/webhook.controller.js';
const router = Router();
router.post('/braip', braipWebhook);
export default router;
//# sourceMappingURL=webhook.routes.js.map