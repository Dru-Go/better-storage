import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs-extra';
import { LocalStorageDriver } from './local';

describe('LocalStorageDriver', () => {
  const root = './test-storage';
  let driver: LocalStorageDriver;

  beforeEach(async () => {
    await fs.emptyDir(root);
    driver = new LocalStorageDriver(root, 'http://localhost/files');
  });

  it('should write and read a file', async () => {
    await driver.put('hello.txt', 'Hello World');
    const data = await driver.get('hello.txt');
    expect(data.toString()).toBe('Hello World');
  });

  it('should return correct metadata', async () => {
    await driver.put('info.json', '{"a":1}');
    const meta = await driver.getMetadata('info.json');
    expect(meta.size).toBeGreaterThan(0);
    expect(meta.mimeType).toBe('application/json');
  });

  it('should check for file existence', async () => {
    await driver.put('exists.txt', 'test');
    expect(await driver.exists('exists.txt')).toBe(true);
    expect(await driver.exists('missing.txt')).toBe(false);
  });
});
