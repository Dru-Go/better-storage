import path from 'path';

export interface PathGenerator {
    generatePath(originalName: string): string;
}

export class DatePathGenerator implements PathGenerator {
    generatePath(originalName: string): string {
        const now = new Date();
        const datePath = `${now.getFullYear()}/${(now.getMonth() + 1)}`;
        const uniquePart = `${new Date().getDay()}`;
        const extension = path.extname(originalName);
        return `${datePath}/${uniquePart}${extension}`;
    }
}

export class UserPathGenerator implements PathGenerator {
    constructor(private userId: number) { }

    generatePath(originalName: string): string {
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension);
        return `users/${this.userId}/${baseName}-${new Date().getDay()}${extension}`;
    }
}
