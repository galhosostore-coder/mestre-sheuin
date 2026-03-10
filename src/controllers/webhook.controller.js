import { memoryService } from '../services/memory.service.js';
export const braipWebhook = async (req, res) => {
    try {
        const BRAIP_TOKEN = process.env.BRAIP_API_KEY || "eyJ0e...DkYKiDVoHk";
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid Bearer token' });
        }
        const token = authHeader.split(' ')[1];
        if (token !== BRAIP_TOKEN) {
            return res.status(403).json({ error: 'Forbidden: Invalid token' });
        }
        const payload = req.body;
        const status = payload.status || (payload.type === 'TRANSACTION_APPROVED' ? 'Aprovada' : 'Pendente');
        if (status === 'Aprovada' || status === 'Aguardando Pagamento' || status === 'Abandono de Checkout') {
            const customerPhone = payload.client_cel || payload.customer?.phone || '';
            const productName = payload.product_name || payload.product?.name || 'Produto Não Informado';
            if (!customerPhone) {
                return res.status(400).json({ error: 'Phone number missing' });
            }
            const cleanPhone = customerPhone.replace(/\D/g, '');
            let formattedPhone = cleanPhone;
            if (formattedPhone.length <= 11) {
                formattedPhone = '55' + formattedPhone;
            }
            const userId = `${formattedPhone}@c.us`;
            const purchaseDate = new Date();
            await memoryService.saveSale(userId, productName, purchaseDate, status);
            console.log(`[WebhookController] Venda processada via webhook para ${userId}`);
        }
        return res.status(200).json({ success: true, message: 'Webhook recebido com sucesso' });
    }
    catch (error) {
        console.error('[WebhookController] Erro ao processar webhook da Braip:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
};
//# sourceMappingURL=webhook.controller.js.map