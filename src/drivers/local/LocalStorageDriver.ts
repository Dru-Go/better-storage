import fs, { createReadStream, createWriteStream } from 'fs-extra';
import path from 'path';
import mime from 'mime-types';
import { StorageDriver } from '../../core/StorageDriver';
import { FileMetadata } from './metadata';
import { Readable } from 'stream';
import { PathGenerator } from '../../core/PathGenerator';
import { log } from 'npmlog';
import { FileNotFoundError } from '../../errors/storage_error';

type Visibility = 'public' | 'private' | 'test';
type LocalDriverConfig = {
  root: string;
  baseUrl?: string,
  visibility?: Visibility;
};

/**
 * LocalStorageDriver provides a StorageDriver implementation
 * for handling file operations on the local filesystem with
 * support for visibility (public/private/test), symlinks, and
 * metadata extraction.
 */
export class LocalStorageDriver implements StorageDriver {
  private root: string;
  private baseUrl?: string
  private defaultVisibility: Visibility;

  /**
   * Create a new LocalStorageDriver instance.
   * @param {LocalDriverConfig} config - Configuration for the local storage driver.
   * @param {string} config.root - Root directory for storage.
   * @param {string} [config.baseUrl] - Optional base URL for generating public URLs.
   * @param {Visibility} [config.visibility] - Default visibility for files.
   */
  constructor(config: LocalDriverConfig) {
    this.root = config.root;
    this.baseUrl = config.baseUrl;
    this.defaultVisibility = config.visibility ?? 'public';
  }

  /**
   * Delete a file from all visibility scopes (public, private, test).
   * @param {string} filePath - Relative path to the file.
   * @returns {Promise<void>}
   */
  async delete(filePath: string): Promise<void> {
    for (const visibility of ['public', 'private', 'test'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        await fs.unlink(targetPath);
        return;
      }
    }
  }

  /**
   * Check if a file exists in the specified visibility scope.
   * @param {string} filePath - Relative path to the file.
   * @param {Visibility} [visibility='public'] - Visibility scope to check.
   * @param {PathGenerator} [pathGen] - Optional path generator.
   * @returns {Promise<boolean>} True if file exists, false otherwise.
   */
  async exists(filePath: string, visibility: Visibility = 'public', pathGen?: PathGenerator): Promise<boolean> {
    const targetPath = this.resolvePath(filePath, visibility, pathGen);
    try {
      await fs.access(targetPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Retrieve metadata for a file, searching all visibility scopes.
   * @param {string} filePath - Relative path to the file.
   * @returns {Promise<FileMetadata>} Metadata object for the file.
   * @throws {Error} If file is not found in any visibility scope.
   */
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
    throw new FileNotFoundError(filePath);
  }

  /**
   * Change the visibility of a file (move between public/private/test).
   * @param {string} filePath - Relative path to the file.
   * @param {Visibility} visibility - New visibility to set.
   * @returns {Promise<void>}
   */
  async setVisibility(filePath: string, visibility: Visibility): Promise<void> {
    const current = await this.getMetadata(filePath);
    if (current.visibility === visibility) return; // no change

    const sourcePath = this.resolvePath(filePath, current.visibility);
    const targetPath = this.resolvePath(filePath, visibility);

    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.rename(sourcePath, targetPath);
  }

  /**
   * Get the visibility of a file.
   * @param {string} filePath - Relative path to the file.
   * @returns {Promise<Visibility>} The current visibility of the file.
   */
  async getVisibility(filePath: string): Promise<Visibility> {
    const metadata = await this.getMetadata(filePath);
    return metadata.visibility;
  }

  /**
   * Generate a public URL for a file, if baseUrl is set.
   * @param {string} p - Relative file path.
   * @returns {string} Public URL or empty string if baseUrl is not set.
   */
  url(p: string) {
    return this.baseUrl ? `${this.baseUrl}/${p}` : '';
  }

  /**
   * Generate a signed URL for accessing a file, with expiration.
   * Public files return a direct URL, private files return a simulated signed URL.
   * @param {string} filePath - Relative path to the file.
   * @param {number} expiresInSeconds - Number of seconds until the URL expires.
   * @returns {Promise<string>} Signed URL string.
   */
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

  /**
   * Resolve the absolute path for a file, considering visibility and optional path generator.
   * @param {string} originalName - Original file name or relative path.
   * @param {Visibility} [visibility='public'] - Visibility scope.
   * @param {PathGenerator} [generator] - Optional path generator.
   * @returns {string} Absolute path on the filesystem.
   */
  public resolvePath(originalName: string, visibility: Visibility = "public", generator?: PathGenerator): string {
    const logicalPath = this.resolveFilePath(originalName, generator);
    const targetVisibility = visibility ?? this.defaultVisibility;
    return path.join(this.root, targetVisibility, logicalPath);
  }

  /**
   * Resolve the logical file path, using a path generator if provided.
   * @param {string} originalName - Original file name or relative path.
   * @param {PathGenerator} [generator] - Optional path generator.
   * @returns {string} Logical file path.
   */
  public resolveFilePath(originalName: string, generator?: PathGenerator): string {
    if (generator) {
      return generator.generatePath(originalName);
    }
    return originalName
  }

  /**
   * Read a file's contents as a Buffer, searching all visibility scopes.
   * @param {string} filePath - Relative path to the file.
   * @returns {Promise<Buffer>} File contents.
   * @throws {Error} If file is not found.
   */
  async read(filePath: string): Promise<Buffer> {
    for (const visibility of ['public', 'private', 'test'] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        return fs.readFile(targetPath);
      }
    }
    throw new FileNotFoundError(filePath);
  }

  /**
   * Create a readable stream for a file, searching all visibility scopes.
   * @param {string} filePath - Relative path to the file.
   * @returns {Promise<Readable>} Readable stream for the file.
   * @throws {Error} If file is not found.
   */
  async readStream(filePath: string): Promise<Readable> {
    for (const visibility of ['public', 'private', "test"] as const) {
      const targetPath = this.resolvePath(filePath, visibility);
      if (await this.exists(filePath, visibility)) {
        return createReadStream(targetPath);
      }
    }
    throw new FileNotFoundError(filePath);
  }

  /**
   * Write content to a file, creating directories as needed.
   * Optionally ensures a public symlink for public visibility.
   * @param {string} filePath - Relative path to the file.
   * @param {Buffer|string} content - File content to write.
   * @param {Visibility} [visibility=this.defaultVisibility] - Visibility scope.
   * @param {PathGenerator} [pathGen] - Optional path generator.
   * @returns {Promise<void>}
   */
  async write(filePath: string, content: Buffer | string, visibility = this.defaultVisibility, pathGen?: PathGenerator): Promise<void> {
    if (visibility === 'public') {
      this.ensurePublicSymlink();
    }
    const targetPath = this.resolvePath(filePath, visibility, pathGen);
    await fs.mkdir(path.dirname(targetPath), { recursive: true });
    await fs.writeFile(targetPath, content);
  }

  /**
   * Write a stream to a file, creating directories as needed and using a temp file for atomicity.
   * Optionally ensures a public symlink for public visibility.
   * @param {string} filePath - Relative path to the file.
   * @param {Readable} stream - Readable stream to write.
   * @param {Visibility} [visibility=this.defaultVisibility] - Visibility scope.
   * @param {PathGenerator} [pathGen] - Optional path generator.
   * @returns {Promise<void>}
   */
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

  /**
   * Generate a public URL for a file, if it is public.
   * @param {string} filePath - Relative path to the file.
   * @param {string} baseUrl - Base URL for public access.
   * @param {Visibility} [visibility='public'] - Visibility scope.
   * @returns {Promise<string>} Public URL or empty string if not public.
   */
  async getPublicUrl(filePath: string, baseUrl: string, visibility: Visibility = 'public'): Promise<string> {
    const finalVisibility = visibility ?? this.defaultVisibility;

    if (finalVisibility !== 'public') {
      return "";  // Or throw new Error('File is not public')
    }

    // Mimic Laravel: /public/storage/file.ext -> your base URL + path
    return `${baseUrl}/${filePath.replace(/\\/g, '/')}`;
  }

  /**
   * Ensure the public symlink exists for serving public files.
   * Creates necessary directories and symlink if missing.
   * @param {string} [publicDirectory] - Path to the public directory.
   * @param {string} [storagePublic] - Path to the storage public directory.
   * @param {string} [symLinkPath] - Path where the symlink should be created.
   * @returns {Promise<void>}
   */
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
