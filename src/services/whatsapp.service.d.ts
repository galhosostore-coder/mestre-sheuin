import type { Client as ClientType } from 'whatsapp-web.js';
export declare class WhatsappService {
    private client;
    private messageBuffer;
    constructor();
    private setupEvents;
    start(): Promise<void>;
    getClient(): ClientType;
}
export declare const whatsappService: WhatsappService;
//# sourceMappingURL=whatsapp.service.d.ts.map