import { StorageDriver } from './StorageDriver';
import { disks } from '../config';
import { ChunkManager } from './ChuckManager';
import path from 'path';
import os from 'os';
import { SettingDiskError } from '../errors/storage_error';

type Visibility = 'public' | 'private' | 'test';

class StorageManager {
  private drivers: Record<string, StorageDriver> = {};
  private defaultDisk = 'local';
  private static instances: Map<string, StorageDriver> = new Map();
  private chunkManager: ChunkManager;

  /**
   * Creates an instance of StorageManager.
   * Automatically registers storage drivers from the configuration
   * and initializes the ChunkManager for chunked uploads.
   */
  constructor() {
    // Auto-register disks from config
    for (const [name, config] of Object.entries(disks)) {
      this.register(name, config.driver());
    }
    this.chunkManager = new ChunkManager(path.join(os.tmpdir(), 'chunked-uploads'));
  }

  /**
   * Retrieves a singleton instance of a storage driver by disk name.
   * Throws an error if the disk is not defined in the config.
   * 
   * @param name - The name of the disk to retrieve.
   * @returns The StorageDriver instance for the specified disk.
   * @throws If the disk name is not defined in the configuration.
   */
  static disk(name: string): StorageDriver {
    if (!disks[name]) {
      throw new Error(`Disk '${name}' is not defined in config.`);
    }

    if (!this.instances.has(name)) {
      const driver = disks[name].driver();
      this.instances.set(name, driver);
    }

    return this.instances.get(name)!;
  }

  /**
   * Returns the ChunkManager instance for managing chunked uploads.
   * 
   * @returns The ChunkManager instance.
   */
  chunk(): ChunkManager {
    return this.chunkManager;
  }

  /**
   * Alias for static disk method to retrieve a storage driver by disk name.
   * 
   * @param name - The name of the disk to use.
   * @returns The StorageDriver instance for the specified disk.
   */
  static use(name: string): StorageDriver {
    return this.disk(name);
  }

  /**
   * Registers a new storage driver under the specified disk name.
   * 
   * @param disk - The name of the disk.
   * @param driver - The StorageDriver instance to register.
   */
  register(disk: string, driver: StorageDriver): void {
    this.drivers[disk] = driver;
  }

  /**
   * Retrieves metadata for a file from the default disk.
   * 
   * @param path - The path of the file.
   * @returns A promise resolving to the file metadata.
   */
  fileMetadata(path: string) {
    return Storage.disk().getMetadata(path);
  }

  /**
   * Retrieves the storage driver for the specified disk name or the default disk if none is provided.
   * Throws an error if the disk is not registered.
   * 
   * @param diskName - Optional disk name to retrieve.
   * @returns The StorageDriver instance.
   * @throws If the disk is not registered.
   */
  disk(diskName?: string): StorageDriver {
    const resolvedDisk = diskName ?? this.defaultDisk;
    const driver = this.drivers[resolvedDisk];

    if (!driver) {
      throw new SettingDiskError(resolvedDisk);
    }

    return driver;
  }

  /**
   * Sets the default disk to be used when no disk name is specified.
   * Throws an error if the disk is not registered.
   * 
   * @param disk - The disk name to set as default.
   * @throws If the disk is not registered.
   */
  setDefault(disk: string): void {
    if (!this.drivers[disk]) {
      throw new SettingDiskError(disk);
    }
    this.defaultDisk = disk;
  }

  /**
   * Retrieves a public URL for a file stored on a specified disk with a given visibility.
   * 
   * @param filePath - The path of the file.
   * @param diskName - The disk name where the file is stored.
   * @param visibility - The visibility setting of the file (default is 'public').
   * @returns A promise resolving to the public URL string or null.
   */
  static async url(filePath: string, diskName: string, visibility: Visibility = 'public'): Promise<string | null> {
    const driver = this.disk(diskName);
    return await driver.getPublicUrl(filePath, visibility);
  }
}

export const Storage = new StorageManager();
