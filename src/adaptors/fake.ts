import { StorageDriver } from '../driver';

export class FakeDriver implements StorageDriver {
  private files: Map<string, Buffer> = new Map();

  async put(path: string, contents: Buffer | string) {
    this.files.set(path, Buffer.isBuffer(contents) ? contents : Buffer.from(contents));
  }

  async get(path: string) {
    return this.files.get(path) ?? Buffer.from('');
  }

  async delete(path: string) {
    this.files.delete(path);
  }

  async exists(path: string) {
    return this.files.has(path);
  }

  url(path: string) {
    return `fake://${path}`;
  }
}
