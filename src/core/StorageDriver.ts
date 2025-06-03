import { FileMetadata } from "../drivers/local/metadata";
import { Readable } from 'stream';
import { PathGenerator } from "./PathGenerator";
type Visibility = 'public' | 'private' | 'test';

export interface StorageDriver {
  /**
   * Writes content to the storage at the specified path or generated path.
   * 
   * @param filePathOrGenerator - The file path as a string or a PathGenerator instance to generate the path.
   * @param content - The content to write, either as a Buffer or string.
   * @param visibility - Optional visibility setting for the file ('public', 'private', or 'test').
   * @returns A promise that resolves when the write operation completes.
   */
  write(filePathOrGenerator: string | PathGenerator, content: Buffer | string, visibility?: Visibility): Promise<void>;

  /**
   * Reads the content of the file at the specified path.
   * 
   * @param filePath - The path to the file to read.
   * @returns A promise that resolves with the file content as a Buffer.
   */
  read(filePath: string): Promise<Buffer>;

  /**
   * Deletes the file at the specified path.
   * 
   * @param filePath - The path to the file to delete.
   * @returns A promise that resolves when the file has been deleted.
   */
  delete(filePath: string): Promise<void>;

  /**
   * Checks if a file exists at the specified path with optional visibility.
   * 
   * @param filePath - The path to the file.
   * @param visibility - Optional visibility to check for.
   * @returns A promise that resolves with true if the file exists, false otherwise.
   */
  exists(filePath: string, visibility?: Visibility): Promise<boolean>;

  /**
   * Retrieves metadata information for the file at the specified path.
   * 
   * @param filePath - The path to the file.
   * @returns A promise that resolves with the file metadata.
   */
  getMetadata(filePath: string): Promise<FileMetadata>;

  /**
   * Sets the visibility of the file at the specified path.
   * 
   * @param filePath - The path to the file.
   * @param visibility - The visibility to set ('public', 'private', or 'test').
   * @returns A promise that resolves when the visibility has been set.
   */
  setVisibility(filePath: string, visibility: Visibility): Promise<void>;

  /**
   * Gets the current visibility setting of the file at the specified path.
   * 
   * @param filePath - The path to the file.
   * @returns A promise that resolves with the visibility of the file.
   */
  getVisibility(filePath: string): Promise<Visibility>;

  /**
   * Gets a publicly accessible URL for the file at the specified path.
   * 
   * @param filePath - The path to the file.
   * @param visibility - The visibility setting of the file.
   * @returns A promise that resolves with the public URL as a string.
   */
  getPublicUrl(filePath: string, visibility: Visibility): Promise<string>;

  /**
   * Gets a signed URL for the file that expires after a specified time.
   * 
   * @param filePath - The path to the file.
   * @param expiresInSeconds - The number of seconds until the signed URL expires.
   * @returns A promise that resolves with the signed URL as a string.
   */
  getSignedUrl(filePath: string, expiresInSeconds: number): Promise<string>;

  /**
   * Returns a readable stream for the file at the specified path.
   * 
   * @param filePath - The path to the file.
   * @returns A promise that resolves with a Readable stream of the file content.
   */
  readStream(filePath: string): Promise<Readable>;

  /**
   * Writes data from a readable stream to the file at the specified path.
   * 
   * @param filePath - The path to the file.
   * @param stream - The readable stream containing the data to write.
   * @param visibility - Optional visibility setting for the file.
   * @returns A promise that resolves when the write stream operation completes.
   */
  writeStream(filePath: string, stream: Readable, visibility?: Visibility): Promise<void>;
}
