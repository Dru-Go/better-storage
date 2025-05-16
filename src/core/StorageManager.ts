import { StorageDriver } from './StorageDriver';
import { disks } from '../config';
import { ChunkManager } from './ChuckManager';
import path from 'path';
import os from 'os';

type Visibility = 'public' | 'private' | 'test';

class StorageManager {
  private drivers: Record<string, StorageDriver> = {};
  private defaultDisk = 'local';
  private static instances: Map<string, StorageDriver> = new Map();
  private chunkManager: ChunkManager
  constructor() {
    // Auto-register disks from config
    for (const [name, config] of Object.entries(disks)) {
      this.register(name, config.driver());
    }
    this.chunkManager = new ChunkManager(path.join(os.tmpdir(), 'chunked-uploads'));
  }

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

  chunk(): ChunkManager {
    return this.chunkManager;
  }

  static use(name: string): StorageDriver {
    return this.disk(name);
  }

  register(disk: string, driver: StorageDriver) {
    this.drivers[disk] = driver;
  }
  fileMetadata(path: string) {
    return Storage.disk().getMetadata(path);
  }

  disk(diskName?: string): StorageDriver {
    const resolvedDisk = diskName ?? this.defaultDisk;
    const driver = this.drivers[resolvedDisk];

    if (!driver) {
      throw new Error(`Disk '${resolvedDisk}' is not registered.`);
    }

    return driver;
  }

  setDefault(disk: string) {
    if (!this.drivers[disk]) {
      throw new Error(`Cannot set '${disk}' as default: disk is not registered.`);
    }
    this.defaultDisk = disk;
  }

  static async url(filePath: string, diskName: string, visibility: Visibility = 'public'): Promise<string | null> {
    const driver = this.disk(diskName);
    return await driver.getPublicUrl(filePath, visibility);
  }
}

export const Storage = new StorageManager();
