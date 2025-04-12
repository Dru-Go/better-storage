import { FileMetadata } from "../drivers/local/metadata";
import { Readable } from 'stream';
import { PathGenerator } from "./PathGenerator";

export interface StorageDriver {
  write(filePathOrGenerator: string | PathGenerator, content: Buffer | string, visibility?: 'public' | 'private'): Promise<void>;
  read(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string, visibility?: 'public' | 'private'): Promise<boolean>;
  getMetadata(filePath: string): Promise<FileMetadata>;
  setVisibility(filePath: string, visibility: 'public' | 'private'): Promise<void>;
  getVisibility(filePath: string): Promise<'public' | 'private'>;

  getSignedUrl(filePath: string, expiresInSeconds: number): Promise<string>;
  readStream(filePath: string): Promise<Readable>;
  writeStream(filePath: string, stream: Readable, visibility?: 'public' | 'private'): Promise<void>;
}
