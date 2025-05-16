
export type Visibility = 'public' | 'private' | 'test';

export interface UploadSession {
    id: string;
    originalName: string;
    totalChunks: number;
    receivedChunks: Set<number>;
    targetPath: string;
    visibility: Visibility;
}

export type UploadSessionMetadata = {
    id: string;
    originalName: string;
    totalChunks: number;
    receivedChunks: number[]; // because Set is not serializable
    targetPath: string;
    visibility: Visibility;
};
