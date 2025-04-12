import { describe, it, expect, beforeEach } from 'vitest';
import { Storage, StorageManager } from '../../src/core/StorageManager';
import { DatePathGenerator, UserPathGenerator } from '../../src/core/PathGenerator';
import path from 'path';
describe('StorageManager', () => {
    it('returns a valid driver from config', () => {
        const driver = Storage.disk('local');
        expect(driver).toBeDefined();
        expect(typeof driver.write).toBe('function');
    });

    it('throws for undefined disk', () => {
        expect(() => Storage.disk('notExist')).toThrow(/Disk 'notExist'/);
    });
});
