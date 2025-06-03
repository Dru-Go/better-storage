// src/errors/StorageErrors.ts

export class StorageError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'StorageError';
    }
}

export class FileNotFoundError extends StorageError {
    constructor(filePath: string) {
        super(`File not found: ${filePath}`);
        this.name = 'FileNotFoundError';
    }
}

export class PermissionDeniedError extends StorageError {
    constructor(filePath: string) {
        super(`Permission denied: ${filePath}`);
        this.name = 'PermissionDeniedError';
    }
}

export class UploadSessionNotFoundError extends StorageError {
    constructor(sessionId: string) {
        super(`Upload session '${sessionId}' not found.`);
        this.name = 'UploadSessionNotFoundError';
    }
}

export class IncompleteUploadError extends StorageError {
    constructor(sessionId: string, expected: number, received: number) {
        super(
            `Upload session '${sessionId}' is incomplete. Expected ${expected} chunks, received ${received}.`
        );
        this.name = 'IncompleteUploadError';
    }
}

export class InvalidVisibilityError extends StorageError {
    constructor(visibility: string) {
        super(`Invalid visibility setting: '${visibility}'`);
        this.name = 'InvalidVisibilityError';
    }
}


export class SettingDiskError extends Error {
    constructor(disk: string) {
        super(disk);
        this.name = `Disk '${disk}' has not been registered`;
    }
}



