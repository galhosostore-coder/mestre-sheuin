export declare class ImageService {
    private imagesDir;
    constructor();
    private ensureDirectoryExists;
    generateOrGetImage(theme: string): Promise<{
        data: string;
        mimeType: string;
    }>;
}
export declare const imageService: ImageService;
//# sourceMappingURL=image.service.d.ts.map