import { Readable } from "stream";
import { StorageDriver } from "../../core/StorageDriver";
import { FileMetadata } from "../local/metadata";

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

  getMetadata(filePath: string): Promise<FileMetadata> {
    throw new Error("Method not implemented.");
  }
  setVisibility(filePath: string, visibility: "public" | "private"): Promise<void> {
    throw new Error("Method not implemented.");
  }
  getVisibility(filePath: string): Promise<"public" | "private"> {
    throw new Error("Method not implemented.");
  }
  getSignedUrl(filePath: string, expiresInSeconds: number): Promise<string> {
    throw new Error("Method not implemented.");
  }
  readStream(filePath: string): Promise<Readable> {
    throw new Error("Method not implemented.");
  }
  writeStream(filePath: string, stream: Readable, visibility?: "public" | "private"): Promise<void> {
    throw new Error("Method not implemented.");
  }

}
