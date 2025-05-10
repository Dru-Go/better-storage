import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs-extra';
import path from 'path';
import { Storage } from '../../../src/core/StorageManager';
import { LocalStorageDriver } from '../../../src/drivers/local/LocalStorageDriver';
import { log } from 'npmlog';

const rootDir = path.resolve(__dirname, '../../storage');
const publicDir = path.join(rootDir, 'public');
const privateDir = path.join(rootDir, 'private');
const symlinkPath = path.join(rootDir, 'symlinks');

describe('Public Symlink Behavior', () => {

    beforeAll(async () => {
        // Set up fake directory

        await fs.ensureDir(rootDir);
        await fs.ensureDir(publicDir);
        await fs.ensureDir(privateDir);

        const local = new LocalStorageDriver({
            root: rootDir,
            visibility: 'test'
        });


        // Create symlink
        local.ensurePublicSymlink(rootDir, publicDir, symlinkPath);

        // Register the storage disk
        Storage.register('test', local);
        Storage.setDefault('test');
    });


    it('should create the symlink', async () => {
        const stats = await fs.lstat(symlinkPath);
        expect(stats.isSymbolicLink()).toBe(true);
    });

    it('should write a public file and access via symlink path', async () => {
        const filename = 'avatar.png';
        const content = Buffer.from('test image content');

        await Storage.disk().write(filename, content, 'public');

        const physicalPath = path.join(publicDir, filename);
        const webPath = path.join(symlinkPath, filename);

        expect(await fs.pathExists(physicalPath)).toBe(true);
        expect(await fs.pathExists(webPath)).toBe(true);

        const fileContents = await fs.readFile(webPath);
        expect(fileContents.toString()).toBe('test image content');
    });

    it('should not expose private files via symlink', async () => {
        const filename = 'secret.txt';
        const content = 'super secret data';

        await Storage.disk().write(filename, content, 'private');

        const privatePhysicalPath = path.join(rootDir, 'private', filename);
        const publicWebPath = path.join(symlinkPath, filename);

        expect(await fs.pathExists(privatePhysicalPath)).toBe(true);
        expect(await fs.pathExists(publicWebPath)).toBe(false);
    });


});
