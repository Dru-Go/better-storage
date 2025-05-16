import { FileMetadata } from "../drivers/local/metadata";
import { Readable } from 'stream';
import { PathGenerator } from "./PathGenerator";
type Visibility = 'public' | 'private' | 'test';

export interface StorageDriver {
  write(filePathOrGenerator: string | PathGenerator, content: Buffer | string, visibility?: Visibility): Promise<void>;
  read(filePath: string): Promise<Buffer>;
  delete(filePath: string): Promise<void>;
  exists(filePath: string, visibility?: Visibility): Promise<boolean>;
  getMetadata(filePath: string): Promise<FileMetadata>;
  setVisibility(filePath: string, visibility: Visibility): Promise<void>;
  getVisibility(filePath: string): Promise<Visibility>;

  getPublicUrl(filePath: string, visibility: Visibility): Promise<string>;

  getSignedUrl(filePath: string, expiresInSeconds: number): Promise<string>;
  readStream(filePath: string): Promise<Readable>;
  writeStream(filePath: string, stream: Readable, visibility?: Visibility): Promise<void>;
}
