import fs from 'fs-extra';
import mime from 'mime-types';
import path from 'path';
type Visibility = 'public' | 'private' | 'test';

interface FileMetadata {
  path: string; // relative path within the disk
  size: number; // in bytes
  mimeType: string; // e.g. 'image/jpeg'
  visibility: Visibility;
  lastModified: Date; // file system or S3 timestamp
}

async function getLocalMetadata(root: string, filePath: string): Promise<FileMetadata> {
  const fullPath = path.join(root, filePath);
  const stat = await fs.stat(fullPath);

  return {
    path: filePath,
    size: stat.size,
    mimeType: mime.lookup(fullPath) || 'application/octet-stream',
    visibility: 'public', // default for local — you might read from config
    lastModified: stat.mtime,
  };
}

export { getLocalMetadata, type FileMetadata };
