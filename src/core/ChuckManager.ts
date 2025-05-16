import path from 'path';
import fs from 'fs-extra';
import { createWriteStream, createReadStream } from 'fs';
import { Readable } from 'stream';
import { UploadSession, UploadSessionMetadata, Visibility } from '../types/ChunkUploads';
import { log } from 'npmlog';

export class ChunkManager {
    private sessions: Map<string, UploadSession> = new Map();
    private basePath: string;

    constructor(uploadDir: string) {
        this.basePath = uploadDir;
    }

    // Public Simple API (wraps session API)
    async startUpload(uploadId: string, chunks: number, filename: string, visibility: Visibility): Promise<void> {
        const targetPath = path.join(this.basePath, `${uploadId}-${filename}`);
        return this.startSession(uploadId, chunks, filename, targetPath, visibility);
    }

    async appendChunk(uploadId: string, index: number, data: Buffer | Readable): Promise<void> {
        return this.receiveChunk(uploadId, index, data);
    }

    async completeUpload(uploadId: string): Promise<string> {
        return this.finalizeUpload(uploadId);
    }

    // Session-Based API
    async startSession(id: string, totalChunks: number, originalName: string, targetPath: string, visibility: Visibility) {
        const session: UploadSession = {
            id,
            originalName,
            totalChunks,
            receivedChunks: new Set(),
            targetPath,
            visibility
        };

        this.sessions.set(id, session);
        await this.saveMetadata(session);
        await fs.ensureDir(this.getSessionDir(id));
    }


    private async saveMetadata(session: UploadSession): Promise<void> {
        const metadata: UploadSessionMetadata = {
            ...session,
            receivedChunks: Array.from(session.receivedChunks)
        };
        const sessionDir = this.getSessionDir(session.id);
        await fs.ensureDir(sessionDir); // <- Fix here
        const metadataPath = path.join(this.getSessionDir(session.id), 'metadata.json');
        await fs.writeJSON(metadataPath, metadata);
    }

    async receiveChunk(id: string, chunkIndex: number, chunk: Buffer | Readable) {
        log("info", "Receiving Chunks", `[Upload ${id}] Progress: ${this.getProgress(id).toFixed(2)}%`);

        const session = this.sessions.get(id);
        if (!session) throw new Error(`Upload session '${id}' not found.`);

        const chunkPath = this.getChunkPath(id, chunkIndex);
        session.receivedChunks.add(chunkIndex);
        await this.saveMetadata(session);

        if (chunk instanceof Readable) {
            const writeStream = createWriteStream(chunkPath);
            await new Promise<void>((resolve, reject) => {
                chunk.pipe(writeStream);
                chunk.on('end', resolve);
                chunk.on('error', reject);
            });
        } else {
            await fs.writeFile(chunkPath, chunk);
        }
    }
    async loadSessionsFromDisk(): Promise<void> {
        const sessionDirs = await fs.readdir(this.basePath);
        for (const dir of sessionDirs) {
            const metadataPath = path.join(this.basePath, dir, 'metadata.json');
            if (await fs.pathExists(metadataPath)) {
                const metadata = await fs.readJSON(metadataPath) as UploadSessionMetadata;
                this.sessions.set(metadata.id, {
                    ...metadata,
                    receivedChunks: new Set(metadata.receivedChunks),
                });
            }
        }
    }

    getProgress(id: string): number {
        const session = this.sessions.get(id);
        if (!session) return 0;
        return (session.receivedChunks.size / session.totalChunks) * 100;
    }

    async finalizeUpload(id: string): Promise<string> {
        const session = this.sessions.get(id);
        if (!session) throw new Error(`Upload session '${id}' not found.`);

        // In public (simple) mode, we don't know totalChunks so we sort by files
        let chunkIndexes: number[] = [];
        const chunkDir = this.getSessionDir(id);

        if (session.totalChunks === Infinity) {
            const files = await fs.readdir(chunkDir);
            chunkIndexes = files
                .filter(f => f.startsWith('chunk-'))
                .map(f => parseInt(f.replace('chunk-', ''), 10))
                .sort((a, b) => a - b);
        } else {
            if (session.receivedChunks.size !== session.totalChunks) {
                throw new Error(`Upload session '${id}' is incomplete.`);
            }
            chunkIndexes = Array.from(session.receivedChunks).sort((a, b) => a - b);
        }

        const writeStream = createWriteStream(session.targetPath);

        for (const index of chunkIndexes) {
            const chunkPath = this.getChunkPath(id, index);
            const readStream = createReadStream(chunkPath);
            await new Promise<void>((resolve, reject) => {
                readStream.pipe(writeStream, { end: false });
                readStream.on('end', resolve);
                readStream.on('error', reject);
            });
        }

        writeStream.end();
        await new Promise((resolve, reject) => {
            writeStream.on('finish', resolve as any);
            writeStream.on('error', reject);
        });

        await fs.remove(this.getSessionDir(id));
        log("info", "Finishing Chunks", `[End Upload ${id}] Progress: 100%`);
        this.sessions.delete(id);

        return session.targetPath;
    }

    async abortSession(id: string) {
        this.sessions.delete(id);
        await fs.remove(this.getSessionDir(id));
    }

    private getSessionDir(id: string): string {
        return path.join(this.basePath, id);
    }

    private getChunkPath(id: string, chunkIndex: number): string {
        return path.join(this.getSessionDir(id), `chunk-${chunkIndex}`);
    }
}
