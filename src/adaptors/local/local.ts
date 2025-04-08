import fs from 'fs-extra';
import path from 'path';
import { StorageDriver } from '../../driver';
import { getLocalMetadata } from './metadata';

export class LocalStorageDriver implements StorageDriver {
  constructor(
    private root: string,
    private baseUrl?: string,
  ) { }

  async put(p: string, contents: Buffer | string) {
    const fullPath = path.join(this.root, p);
    await fs.outputFile(fullPath, contents);
  }

  async get(p: string) {
    const fullPath = path.join(this.root, p);
    return fs.readFile(fullPath);
  }

  async getMetadata(p: string) {
    return getLocalMetadata(this.root, p);
  }

  async delete(p: string) {
    const fullPath = path.join(this.root, p);
    await fs.remove(fullPath);
  }

  async exists(p: string) {
    const fullPath = path.join(this.root, p);
    return fs.pathExists(fullPath);
  }

  url(p: string) {
    return this.baseUrl ? `${this.baseUrl}/${p}` : '';
  }
}
