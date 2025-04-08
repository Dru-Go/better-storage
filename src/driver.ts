export interface StorageDriver {
  put(path: string, contents: Buffer | string): Promise<void>;
  get(path: string): Promise<Buffer>;
  delete(path: string): Promise<void>;
  exists(path: string): Promise<boolean>;
  url(path: string): string | Promise<string>;
}
