import { describe, it, expect, beforeEach, beforeAll, afterEach, afterAll } from 'vitest';
import fs from 'fs-extra';
import { TEST_DOMAIN_PATH } from "../../../src/config";
import { LocalStorageDriver } from '../../../src/drivers/local/LocalStorageDriver';
import * as path from 'path';
import { Readable, Transform } from 'stream';
import { DatePathGenerator, UserPathGenerator } from '../../../src/core/PathGenerator';

describe('LocalStorageDriver', () => {
  const root = './test-storage';
  let driver: LocalStorageDriver;

  beforeAll(async () => {
    await fs.ensureDir(root);
  });

  beforeEach(async () => {
    await fs.emptyDir(root);
    driver = new LocalStorageDriver({ root: root, baseUrl: TEST_DOMAIN_PATH, visibility: "public" });
  });

  afterEach(async () => {
    await fs.emptyDir(root);
  });

  afterAll(async () => {
    await fs.remove(root);
  });

  it('should write and read a file', async () => {
    await driver.write('hello.txt', 'Hello World');
    const data = await driver.read('hello.txt');
    expect(data.toString()).toBe('Hello World');
  });

  it('should return correct metadata', async () => {
    await driver.write('info.json', '{"a":1}');
    const meta = await driver.getMetadata('info.json');
    expect(meta.size).toBeGreaterThan(0);
    expect(meta.mimeType).toBe('application/json');
  });

  it('should check for file existence', async () => {
    await driver.write('exists.txt', 'test');
    expect(await driver.exists('exists.txt')).toBe(true);
    expect(await driver.exists('missing.txt')).toBe(false);
  });
});


describe('LocalStorageDriver - getSignedUrl', () => {
  const testRoot = path.resolve('./test-storage/public');
  let driver: LocalStorageDriver;

  beforeAll(async () => {
    await fs.ensureDir(testRoot);
  });

  beforeEach(async () => {
    driver = new LocalStorageDriver({
      root: testRoot,
      visibility: 'private'
    });

    // Seed a fake test file
    await driver.write('example.txt', 'This is a test file.', 'private');
  });

  afterEach(async () => {
    await fs.emptyDir(testRoot);
  });

  afterAll(async () => {
    await fs.remove(testRoot);
  });

  it('should return a valid signed URL for private file', async () => {
    const signedUrl = await driver.getSignedUrl('example.txt', 600);

    expect(typeof signedUrl).toBe('string');
    expect(signedUrl).toContain('example.txt');
    expect(signedUrl).toMatch(/signature=.*&expires=\d+$/);
  });

  it('should return a direct URL for public file', async () => {
    await driver.setVisibility('example.txt', 'public');

    const publicUrl = await driver.getSignedUrl('example.txt', 600);

    expect(publicUrl).toBe(`/storage/public/example.txt`);
  });

  it('should embed expiration timestamp in URL for private files', async () => {
    const expiresIn = 1200; // 20 minutes
    const signedUrl = await driver.getSignedUrl('example.txt', expiresIn);

    const [, query] = signedUrl.split('?');
    const params = new URLSearchParams(query);
    const expires = parseInt(params.get('expires') || '0', 10);

    const now = Date.now();
    expect(expires).toBeGreaterThan(now);
    expect(expires).toBeLessThan(now + expiresIn * 1000 + 100); // Allow slight timing skew
  });
});


describe('Stream Handling Tests', () => {
  let driver: LocalStorageDriver;
  const testRoot = path.resolve('./test-storage/public');

  beforeEach(() => {
    driver = new LocalStorageDriver({ root: testRoot });
  });
  afterEach(async () => {
    await fs.emptyDir(testRoot);
  });

  afterAll(async () => {
    await fs.remove(testRoot);
  });

  it('should write a file using writeStream and verify its content', async () => {
    const testData = 'This is some streamed content!';
    const inputStream = Readable.from([testData]);

    await driver.writeStream('streamed/test-file.txt', inputStream);

    const storedContent = await driver.read('streamed/test-file.txt');
    expect(storedContent.toString()).toBe(testData);
  });

  it('should read a file using readStream and match its content', async () => {
    const expectedContent = 'Streaming test file content.';
    await driver.write('streamed/read-test.txt', expectedContent);

    const stream = await driver.readStream('streamed/read-test.txt');
    let result = '';

    await new Promise<void>((resolve, reject) => {
      // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
      stream.on('data', chunk => result += chunk.toString());
      stream.on('end', resolve);
      stream.on('error', reject);
    });

    expect(result).toBe(expectedContent);
  });

  it('should throw if trying to stream-read a non-existing file', async () => {
    const filePath = 'streamed/missing.txt'
    await expect(driver.readStream(filePath))
      .rejects
      .toThrow(`File not found: ${filePath}`);
  });

  it('should handle slow streams', async () => {
    const slowStream = new Readable({
      read() {
        setTimeout(() => {
          this.push('A very large chunk of data');
          this.push(null); // Signal end of stream!
        }, 2000);  // simulate 2 seconds delay
      }
    });

    await driver.writeStream('streamed/slow-file.txt', slowStream);
    const storedContent = await driver.read('streamed/slow-file.txt');
    expect(storedContent.toString()).toContain('A very large chunk of data');
  });

  it('should handle stream errors (unexpected end of stream)', async () => {
    const errorStream = new Readable({
      read() {
        this.emit('error', new Error('Stream Error: Unexpected End'));
      }
    });

    await expect(driver.writeStream('streamed/error-file.txt', errorStream))
      .rejects
      .toThrowError('Stream Error: Unexpected End');
  });

  it('should handle interrupted uploads gracefully', async () => {
    const interruptError = 'Upload Interrupted'
    const interruptedStream = new Readable({
      read() {
        this.push('Partial data');
        this.destroy(new Error(interruptError));
      }
    });

    await expect(driver.writeStream('streamed/interrupted-file.txt', interruptedStream))
      .rejects
      .toThrowError(interruptError);

    const exists = await driver.exists('streamed/interrupted-file.txt');
    expect(exists).toBe(false);
  });

  it('should handle large file uploads', async () => {
    const largeFileStream = new Readable({
      read() {
        this.push(Buffer.alloc(10_000_000)); // Simulate 10MB chunk
        this.push(null); // End of stream
      }
    });

    await expect(driver.writeStream('streamed/large-file.txt', largeFileStream))
      .resolves.not.toThrow();

    const storedContent = await driver.read('streamed/large-file.txt');
    expect(storedContent.length).toBeGreaterThan(0);
  });

  it('should handle streaming with multiple steps (transform stream)', async () => {
    const input = Readable.from(['hello world']);
    const transform = new Transform({
      transform(chunk, _encoding, callback) {
        this.push(chunk.toString().toUpperCase());
        callback();
      }
    });

    const outputStream = input.pipe(transform);
    await driver.writeStream('streamed/transformed-file.txt', outputStream);

    const storedContent = await driver.read('streamed/transformed-file.txt');
    expect(storedContent.toString()).toBe('HELLO WORLD');
  });
});


describe('LocalStorageDriver with Path Generators', () => {
  let storage: LocalStorageDriver;
  const ROOT = path.resolve('./test-storage/public');

  beforeAll(async () => {
    await fs.ensureDir(ROOT);
  });

  beforeEach(() => {
    storage = new LocalStorageDriver({ root: ROOT });
  });

  afterEach(async () => {
    await fs.emptyDir(ROOT);
  });

  afterAll(async () => {
    await fs.remove(ROOT);
  });


  it('should store file using DatePathGenerator', async () => {
    const generator = new DatePathGenerator();
    const content = 'Date-based content';
    const logicalPath = generator.generatePath('image.png');
    await storage.write("image.png", content, "public", generator);
    const expectedPath = storage.resolvePath(logicalPath, "public");
    expect(await fs.pathExists(expectedPath)).toBe(true);
  });

  it('should store file using UserPathGenerator', async () => {
    const generator = new UserPathGenerator(7);
    const originalName = 'avatar.png';
    const content = 'User based file';
    await storage.write(originalName, content, "public", generator);
    const logicalPath = generator.generatePath(originalName);
    const expectedPath = storage.resolvePath(logicalPath, "public");
    expect(await fs.pathExists(expectedPath)).toBe(true);
  });
});