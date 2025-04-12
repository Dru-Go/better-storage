import { StorageDriver } from './StorageDriver';
import { disks } from '../config';

export class StorageManager {
  private drivers: Record<string, StorageDriver> = {};
  private defaultDisk = 'local';

  constructor() {
    // Auto-register disks from config
    for (const [name, config] of Object.entries(disks)) {
      this.register(name, config.driver());
    }
  }

  register(disk: string, driver: StorageDriver) {
    this.drivers[disk] = driver;
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
}

export const Storage = new StorageManager();
