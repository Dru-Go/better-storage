import path from 'path';
import fs from 'fs-extra';
import { createWriteStream, createReadStream } from 'fs';
import { Readable } from 'stream';
import { UploadSession, UploadSessionMetadata, Visibility } from '../types/ChunkUploads';
import { log } from 'npmlog';
import { IncompleteUploadError, UploadSessionNotFoundError } from '../errors/storage_error';

export class ChunkManager {
    private sessions: Map<string, UploadSession> = new Map();
    private basePath: string;

    constructor(uploadDir: string) {
        this.basePath = uploadDir;
    }

    /**
     * Starts a new upload session by creating necessary metadata and directories.
     * This is a simplified API that wraps the session-based API.
     * 
     * @param uploadId - Unique identifier for the upload session.
     * @param chunks - Total number of chunks expected.
     * @param filename - Original filename of the upload.
     * @param visibility - Visibility setting for the upload.
     * @returns A promise that resolves when the session is started.
     */
    async startUpload(uploadId: string, chunks: number, filename: string, visibility: Visibility): Promise<void> {
        const targetPath = path.join(this.basePath, `${uploadId}-${filename}`);
        return this.startSession(uploadId, chunks, filename, targetPath, visibility);
    }

    /**
    * Appends a chunk of data to an existing upload session.
    * 
    * @param uploadId - The upload session identifier.
    * @param index - The chunk index to append.
    * @param data - The chunk data, either as a Buffer or a Readable stream.
    * @returns A promise that resolves when the chunk has been received and saved.
    */
    async appendChunk(uploadId: string, index: number, data: Buffer | Readable): Promise<void> {
        return this.receiveChunk(uploadId, index, data);
    }


    /**
     * Completes an upload session by assembling all chunks into the final file.
     * 
     * @param uploadId - The upload session identifier.
     * @returns A promise that resolves with the path to the assembled file.
     */
    async completeUpload(uploadId: string): Promise<string> {
        return this.finalizeUpload(uploadId);
    }

    /**
     * Starts a new upload session with detailed parameters.
     * Creates metadata and ensures the session directory exists.
     * 
     * @param id - Unique identifier for the upload session.
     * @param totalChunks - Total number of chunks expected.
     * @param originalName - Original filename of the upload.
     * @param targetPath - Filesystem path where the final file will be stored.
     * @param visibility - Visibility setting for the upload.
     * @returns A promise that resolves when the session is started.
     */
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
        if (!session) throw new UploadSessionNotFoundError(id);

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

    /**
     * Loads all previously saved upload sessions from disk into memory.
     * Useful for recovering sessions after a restart.
     * 
     * @returns A promise that resolves when all sessions are loaded.
     */
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

    /**
     * Gets the upload progress as a percentage for a given session ID.
     * 
     * @param id - The upload session identifier.
     * @returns The progress percentage (0 to 100).
     */
    getProgress(id: string): number {
        const session = this.sessions.get(id);
        if (!session) return 0;
        return (session.receivedChunks.size / session.totalChunks) * 100;
    }

    /**
    * Finalizes an upload by concatenating all chunks into the final file.
    * Cleans up temporary chunk files and session metadata afterwards.
    * 
    * @param id - The upload session identifier.
    * @returns A promise that resolves with the path to the final assembled file.
    * @throws If the session is not found or incomplete.
    */
    async finalizeUpload(id: string): Promise<string> {
        const session = this.sessions.get(id);
        if (!session) throw new UploadSessionNotFoundError(id)

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
                throw new IncompleteUploadError(id, session.totalChunks, session.receivedChunks.size)
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

    /**
     * Aborts an upload session by deleting its metadata and chunk files.
     * 
     * @param id - The upload session identifier.
     * @returns A promise that resolves when the session is aborted and cleaned up.
     */
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
