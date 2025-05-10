import { StorageDriver } from "./core/StorageDriver";
import { LocalStorageDriver } from "./drivers/local/LocalStorageDriver";

const NODE_ENV = process.env["NODE_ENV"] || "development";
const TEST_DOMAIN_PATH = process.env["TEST_DOMAIN_PATH"] || "";

// src/config.ts

type DiskConfig = {
    driver: () => StorageDriver;
};

const disks: Record<string, DiskConfig> = {
    local: {
        driver: () => new LocalStorageDriver({
            root: './storage/app',
            visibility: 'private'
        }),
    },
    public: {
        driver: () => new LocalStorageDriver({
            root: './storage/public',
            visibility: 'public'
        }),
    },
    test: {
        driver: () => new LocalStorageDriver({
            root: './tests/storage',
            visibility: 'test'
        }),
    },
};


export {
    NODE_ENV,
    TEST_DOMAIN_PATH,
    disks
};

