import fs, { createReadStream, createWriteStream } from 'fs-extra';
import path from 'path';
import mime from 'mime-types';
import { StorageDriver } from '../../core/StorageDriver';
import { FileMetadata } from './metadata';
import { Readable } from 'stream';
import { PathGenerator } from '../../core/PathGenerator';
import { log } from 'npmlog';

type Visibility = 'public' | 'private' | 'test';
type LocalDriverConfig = {
  root: string;
  baseUrl?: string,
  visibility?: Visibility;
};

export class LocalStorageDriver implements StorageDriver {
  private root: string;
  private baseUrl?: string
  private defaultVisibility: Visibility;

  constructor(config: LocalDriverConfig) {
    this.root = config.root;
    this.baseUrl = config.baseUrl;
    this.defaultVisibility = config.visibility ?? 'public';
  }



  async delete(filePath: string): Promise<void> {
    for (const visibility of ['public', 'private', 'test'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        await fs.unlink(targetPath);
        return;
      }
    }
  }

  async exists(filePath: string, visibility: Visibility = 'public', pathGen?: PathGenerator): Promise<boolean> {
    const targetPath = this.resolvePath(filePath, visibility, pathGen);
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  async getMetadata(filePath: string): Promise<FileMetadata> {
    for (const visibility of ['public', 'private', 'test'] as const) {
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

  async setVisibility(filePath: string, visibility: Visibility): Promise<void> {
    const current = await this.getMetadata(filePath);
    if (current.visibility === visibility) return; // no change

    const sourcePath = this.resolvePath(filePath, current.visibility);
    const targetPath = this.resolvePath(filePath, visibility);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rename(sourcePath, targetPath);
  }

  async getVisibility(filePath: string): Promise<Visibility> {
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

  public resolvePath(originalName: string, visibility: Visibility = "public", generator?: PathGenerator): string {
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
    for (const visibility of ['public', 'private', 'test'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        return fs.readFile(targetPath);
      }
    }
    throw new Error(`File not found: ${filePath}`);
  }
  async readStream(filePath: string): Promise<Readable> {
    for (const visibility of ['public', 'private', "test"] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        return createReadStream(targetPath);
      }
    }
    throw new Error(`File not found: ${filePath}`);
  }

  async write(filePath: string, content: Buffer | string, visibility = this.defaultVisibility, pathGen?: PathGenerator): Promise<void> {
    if (visibility === 'public') {
      this.ensurePublicSymlink();
    }
    const targetPath = this.resolvePath(filePath, visibility, pathGen);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content);
  }


  async writeStream(filePath: string, stream: Readable, visibility = this.defaultVisibility, pathGen?: PathGenerator): Promise<void> {
    if (visibility === 'public') {
      this.ensurePublicSymlink();
    }
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

  async getPublicUrl(filePath: string, baseUrl: string, visibility: Visibility = 'public'): Promise<string> {
    const finalVisibility = visibility ?? this.defaultVisibility;

    if (finalVisibility !== 'public') {
      return "";  // Or throw new Error('File is not public')
    }

    // Mimic Laravel: /public/storage/file.ext -> your base URL + path
    return `${baseUrl}/${filePath.replace(/\\/g, '/')}`;
  }

  public async ensurePublicSymlink(publicDirectory?: string, storagePublic?: string, symLinkPath?: string) {
    const publicDir = publicDirectory || path.resolve(__dirname, '../../../public');
    const storageAppPublic = storagePublic || path.resolve(__dirname, '../../../public/storage/');
    const symlinkPath = symLinkPath || path.join(publicDir, 'symlinks');
    await fs.ensureDir(publicDir);
    await fs.ensureDir(storageAppPublic);
    fs.ensureSymlink(storageAppPublic, symlinkPath);
    try {
      if (!fs.existsSync(storageAppPublic)) {
        log("error", "setupPublicSymlink", `❌ Target folder "${__dirname}" "${storageAppPublic}" does not exist.`);
        return;
      }

      if (fs.existsSync(symlinkPath)) {
        const stats = fs.lstatSync(symlinkPath);
        if (stats.isSymbolicLink()) {
          log("warn", "setupPublicSymlink", `✅ Symlink already exists, ${symlinkPath}`);
          return;
        } else {
          log("error", "setupPublicSymlink", `❌ A file or folder already exists at "${symlinkPath}", but it’s not a symlink.`);
          return;
        }
      }

      fs.symlinkSync(storageAppPublic, symlinkPath, 'junction');  // 'junction' for Windows compatibility
      log("info", "setupPublicSymlink", `✅ Symlink created: ${symlinkPath} → ${storageAppPublic}`);
    } catch (error) {
      log("error", "setupPublicSymlink", '❌ Failed to create symlink:', error);
    }
  }
}
