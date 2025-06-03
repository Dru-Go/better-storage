import path from 'path';

export interface PathGenerator {
    /**
     * Generates a file path based on the original filename.
     * 
     * @param originalName - The original name of the file.
     * @returns A string representing the generated path.
     */
    generatePath(originalName: string): string;
}

export class DatePathGenerator implements PathGenerator {
    /**
     * Generates a path based on the current date and the original file extension.
     * Format: "YYYY/M/{dayOfWeek}{extension}"
     * 
     * @param originalName - The original filename.
     * @returns A string representing the generated date-based path.
     */
    generatePath(originalName: string): string {
        const now = new Date();
        const datePath = `${now.getFullYear()}/${(now.getMonth() + 1)}`;
        const uniquePart = `${new Date().getDay()}`;
        const extension = path.extname(originalName);
        return `${datePath}/${uniquePart}${extension}`;
    }
}

export class UserPathGenerator implements PathGenerator {
    /**
     * Creates an instance of UserPathGenerator.
     * 
     * @param userId - The user ID used to generate user-specific paths.
     */
    constructor(private userId: number) { }

    /**
     * Generates a path based on the user ID, original filename, and current day of the week.
     * Format: "users/{userId}/{baseName}-{dayOfWeek}{extension}"
     * 
     * @param originalName - The original filename.
     * @returns A string representing the generated user-based path.
     */
    generatePath(originalName: string): string {
        const extension = path.extname(originalName);
        const baseName = path.basename(originalName, extension);
        return `users/${this.userId}/${baseName}-${new Date().getDay()}${extension}`;
    }
}
