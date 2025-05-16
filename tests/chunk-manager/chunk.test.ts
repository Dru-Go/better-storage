import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { ChunkManager } from '../../src/core/ChuckManager';
import { UploadSessionMetadata } from '../../src/types/ChunkUploads';

const tmpDir = path.resolve(__dirname, './tmp_uploads');

describe('ChunkManager', () => {
    let manager: ChunkManager;

    beforeEach(async () => {
        await fs.remove(tmpDir);
        await fs.ensureDir(tmpDir);
        manager = new ChunkManager(tmpDir);
    });

    afterEach(async () => {
        await fs.remove(tmpDir);
    });

    describe('Simple API (startUpload, appendChunk, completeUpload)', () => {
        const missing_key = "missing"
        it('should assemble chunks into a final file', async () => {
            await manager.startUpload('upload123', 6, 'file.txt', "public");
            await manager.appendChunk('upload123', 0, Buffer.from(' Hello'));
            await manager.appendChunk('upload123', 1, Buffer.from('World'));
            await manager.appendChunk('upload123', 2, Buffer.from(' Hello'));
            await manager.appendChunk('upload123', 3, Buffer.from('World'));
            await manager.appendChunk('upload123', 4, Buffer.from(' Hello'));
            await manager.appendChunk('upload123', 5, Buffer.from('World'));

            const outputPath = await manager.completeUpload('upload123');
            const contents = await fs.readFile(outputPath, 'utf8');
            expect(contents).toBe(' HelloWorld HelloWorld HelloWorld');
        });


        it('should throw if completeUpload is called without startUpload', async () => {
            await expect(manager.completeUpload(missing_key)).rejects.toThrow(`Upload session '${missing_key}' not found.`);
        });
    });

    describe('Session API (startSession, receiveChunk, finalizeUpload)', () => {
        it('should finalize upload when all chunks are received', async () => {
            const target = path.join(tmpDir, 'final.txt');
            await manager.startSession('sess1', 2, 'file.txt', target, 'public');

            await manager.receiveChunk('sess1', 0, Buffer.from('ChunkA'));
            await manager.receiveChunk('sess1', 1, Buffer.from('ChunkB'));

            const resultPath = await manager.finalizeUpload('sess1');
            const result = await fs.readFile(resultPath, 'utf8');
            expect(result).toBe('ChunkAChunkB');
        });

        it('should track progress of received chunks', async () => {
            await manager.startSession('sess2', 4, 'file.txt', 'target.txt', 'private');
            expect(manager.getProgress('sess2')).toBe(0);
            await manager.receiveChunk('sess2', 0, Buffer.from('X'));
            expect(manager.getProgress('sess2')).toBe(25);
            await manager.receiveChunk('sess2', 3, Buffer.from('Y'));
            expect(manager.getProgress('sess2')).toBe(50);
        });

        it('should throw error for incomplete session finalization', async () => {
            const target = path.join(tmpDir, 'final.txt');
            await manager.startSession('sess3', 2, 'incomplete.txt', target, 'private');
            await manager.receiveChunk('sess3', 0, Buffer.from('partial'));

            await expect(manager.finalizeUpload('sess3')).rejects.toThrow('incomplete');
        });

        it('should clean up session on abort', async () => {
            await manager.startSession('sess4', 1, 'abort.txt', 'target.txt', 'public');
            await fs.writeFile(path.join(tmpDir, 'sess4', 'chunk-0'), 'data');
            await manager.abortSession('sess4');

            expect(await fs.pathExists(path.join(tmpDir, 'sess4'))).toBe(false);
        });
    });
});



describe('ChunkManager – loadSessionsFromDisk', () => {
    const uploadDir = path.resolve(__dirname, '../tmp/chunks');
    const sessionId = 'session123';
    const metadataFile = path.join(uploadDir, sessionId, 'metadata.json');
    beforeEach(async () => {
        await fs.remove(uploadDir); // Clean slate
        await fs.ensureDir(path.join(uploadDir, sessionId));

        const metadata: UploadSessionMetadata = {
            id: sessionId,
            originalName: 'myfile.txt',
            totalChunks: 3,
            receivedChunks: [0, 1],
            targetPath: path.join(uploadDir, 'final/myfile.txt'),
            visibility: 'public',
        };

        await fs.writeJSON(metadataFile, metadata);
    });
    afterEach(async () => {
        await fs.remove(uploadDir);
    });

    it('should load sessions from metadata.json during construction', async () => {
        const manager = new ChunkManager(uploadDir);

        // Give it time to load sessions (if it's async in constructor)
        await manager.loadSessionsFromDisk(); // if not called automatically

        const progress = manager.getProgress(sessionId);
        expect(progress).toBeCloseTo((2 / 3) * 100);
    });
});
