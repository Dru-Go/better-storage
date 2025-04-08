import { StorageDriver } from './driver';

class StorageManager {
  private drivers: Record<string, StorageDriver> = {};
  private defaultDisk = 'local';

  register(disk: string, driver: StorageDriver) {
    this.drivers[disk] = driver;
  }

  disk(diskName?: string): StorageDriver {
    return this.drivers[diskName ?? this.defaultDisk];
  }

  setDefault(disk: string) {
    this.defaultDisk = disk;
  }
}

export const Storage = new StorageManager();
