import fs, { createReadStream, createWriteStream } from 'fs-extra';
import path from 'path';
import mime from 'mime-types';
import { StorageDriver } from '../../core/StorageDriver';
import { FileMetadata } from './metadata';
import { Readable } from 'stream';
import { PathGenerator } from '../../core/PathGenerator';

type LocalDriverConfig = {
  root: string;
  baseUrl?: string,
  visibility?: 'public' | 'private';
};

export class LocalStorageDriver implements StorageDriver {
  private root: string;
  private baseUrl?: string
  private defaultVisibility: 'public' | 'private';

  constructor(config: LocalDriverConfig) {
    this.root = config.root;
    this.baseUrl = config.baseUrl;
    this.defaultVisibility = config.visibility ?? 'private';
  }



  async delete(filePath: string): Promise<void> {
    for (const visibility of ['public', 'private'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        await fs.unlink(targetPath);
        return;
      }
    }
  }

  async exists(filePath: string, visibility: 'public' | 'private' = 'public', pathGen?: PathGenerator): Promise<boolean> {
    const targetPath = this.resolvePath(filePath, visibility, pathGen);
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(filePath: string): Promise<FileMetadata> {
    for (const visibility of ['public', 'private'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        const stats = await fs.stat(targetPath);
        return {
          path: filePath,
          size: stats.size,
          mimeType: mime.lookup(filePath) || 'application/octet-stream',
          visibility: visibility,
          lastModified: stats.mtime
        };
      }
    }
    throw new Error(`File not found for metadata: ${filePath}`);
  }

  async setVisibility(filePath: string, visibility: 'public' | 'private'): Promise<void> {
    const current = await this.getMetadata(filePath);
    if (current.visibility === visibility) return; // no change

    const sourcePath = this.resolvePath(filePath, current.visibility);
    const targetPath = this.resolvePath(filePath, visibility);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rename(sourcePath, targetPath);
  }

  async getVisibility(filePath: string): Promise<'public' | 'private'> {
    const metadata = await this.getMetadata(filePath);
    return metadata.visibility;
  }
  url(p: string) {
    return this.baseUrl ? `${this.baseUrl}/${p}` : '';
  }

  async getSignedUrl(filePath: string, expiresInSeconds: number): Promise<string> {
    const visibility = await this.getVisibility(filePath);
    if (visibility === 'public') {
      // public files can be accessed directly
      return `/storage/public/${filePath}`;
    }

    // simulate signed url for private files
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const token = Buffer.from(`${filePath}:${expiresAt}`).toString('base64');
    return `/storage/private/${filePath}?signature=${token}&expires=${expiresAt}`;
  }

  public resolvePath(originalName: string, visibility: 'public' | 'private' = "public", generator?: PathGenerator): string {
    const logicalPath = this.resolveFilePath(originalName, generator);
    const targetVisibility = visibility ?? this.defaultVisibility;
    return path.join(this.root, targetVisibility, logicalPath);
  }

  public resolveFilePath(originalName: string, generator?: PathGenerator): string {
    if (generator) {
      return generator.generatePath(originalName);
    }
    return originalName
  }

  async read(filePath: string): Promise<Buffer> {
    for (const visibility of ['public', 'private'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        return fs.readFile(targetPath);
      }
    }
    throw new Error(`File not found: ${filePath}`);
  }
  async readStream(filePath: string): Promise<Readable> {
    for (const visibility of ['public', 'private'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        return createReadStream(targetPath);
      }
    }
    throw new Error(`File not found: ${filePath}`);
  }

  async write(filePath: string, content: Buffer | string, visibility: 'public' | 'private' = "public", pathGen?: PathGenerator): Promise<void> {
    const targetPath = this.resolvePath(filePath, visibility, pathGen);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content);
  }


  async writeStream(filePath: string, stream: Readable, visibility: 'public' | 'private' = 'public', pathGen?: PathGenerator): Promise<void> {
    const fullPath = this.resolvePath(filePath, visibility, pathGen);
    await fs.ensureDir(path.dirname(fullPath));  // Auto-create directories

    const tempPath = `${fullPath}.tmp`;

    await fs.ensureDir(path.dirname(fullPath));

    const writeStream = createWriteStream(tempPath);

    return new Promise<void>((resolve, reject) => {
      stream.pipe(writeStream);

      stream.on('error', async (err) => {
        writeStream.destroy();
        await fs.remove(tempPath); // Clean up temp file
        reject(err);
      });

      writeStream.on('error', async (err) => {
        await fs.remove(tempPath);
        reject(err);
      });

      writeStream.on('finish', async () => {
        await fs.move(tempPath, fullPath, { overwrite: true }); // Rename temp file
        await this.setVisibility(this.resolveFilePath(filePath), visibility);
        resolve();
      });
    });
  }
}
