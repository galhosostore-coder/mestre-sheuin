import { Queue, Worker } from 'bullmq';
export interface WhatsappMessageJobData {
    userId: string;
    text: string;
    mediaPart?: {
        data: string;
        mimeType: string;
        msgId?: string;
    };
    teaTime?: boolean;
}
export declare const whatsappQueue: Queue<any, any, string, any, any, string>;
export declare function addMessageToQueue(data: WhatsappMessageJobData, delayMs?: number): Promise<void>;
export declare const whatsappWorker: Worker<WhatsappMessageJobData, any, string>;
//# sourceMappingURL=queue.service.d.ts.map