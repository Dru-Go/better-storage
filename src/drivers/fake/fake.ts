import { Readable } from "stream";
import { StorageDriver } from "../../core/StorageDriver";
import { FileMetadata } from "../local/metadata";
type Visibility = 'public' | 'private' | 'test';

export class FakeDriver implements StorageDriver {


  private files: Map<string, Buffer> = new Map();

  async write(path: string, contents: Buffer | string) {
    this.files.set(path, Buffer.isBuffer(contents) ? contents : Buffer.from(contents));
  }

  async read(path: string) {
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

  getMetadata(_filePath: string): Promise<FileMetadata> {
    throw new Error("Method not implemented.");
  }
  setVisibility(_filePath: string, _visibility: Visibility): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getVisibility(_filePath: string): Promise<Visibility> {
    throw new Error("Method not implemented.");
  }
  getSignedUrl(_filePath: string, _expiresInSeconds: number): Promise<string> {
    throw new Error("Method not implemented.");
  }
  readStream(_filePath: string): Promise<Readable> {
    throw new Error("Method not implemented.");
  }
  writeStream(_filePath: string, _stream: Readable, _visibility?: Visibility): Promise<void> {
    throw new Error("Method not implemented.");
  }

  getPublicUrl(_filePath: string, _visibility: Visibility): Promise<string> {
    throw new Error("Method not implemented.");
  }

}
