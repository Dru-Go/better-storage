import { describe, it, expect } from 'vitest';
import { Storage } from '../../src/core/StorageManager';
import { SettingDiskError } from '../../src/errors/storage_error';
describe('StorageManager', () => {
    it('returns a valid driver from config', () => {
        const driver = Storage.disk('local');
        expect(driver).toBeDefined();
        expect(typeof driver.write).toBe('function');
    });

    it('throws for undefined disk', () => {
        expect(() => Storage.disk('notExist')).toThrow(SettingDiskError);
    });
    it('returns metadata for a stored file', async () => {
        const filename = 'test.txt';
        const content = 'Hello, world!';

        await Storage.disk().write(filename, content, "public");

        const metadata = await Storage.disk().getMetadata(filename);

        expect(metadata).toMatchObject({
            path: filename,
            size: content.length,
            mimeType: 'text/plain',
            visibility: 'public',
        });

        expect(typeof metadata.lastModified).toBe("object");
    });
});

