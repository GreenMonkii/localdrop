import { existsSync, mkdirSync } from "fs";
import { writeFile, readdir, unlink, stat } from "fs/promises";
import { join, basename, resolve } from "path";
import type { FileInfo } from "@shared/types";

/**
 * File Storage Service
 * Handles file uploads, storage, and retrieval
 */
export class StorageService {
  private outputDir: string;
  private fileMetadata: Map<string, FileInfo> = new Map();
  private maxFileSize: number = 100 * 1024 * 1024; // 100MB default

  constructor(outputDir: string) {
    this.outputDir = resolve(outputDir);
    this.ensureDirectory();
    this.loadExistingFiles();
  }

  /**
   * Ensure the output directory exists
   */
  private ensureDirectory(): void {
    if (!existsSync(this.outputDir)) {
      mkdirSync(this.outputDir, { recursive: true });
      console.log(`[>] Created storage directory: ${this.outputDir}`);
    }
  }

  /**
   * Load existing files from the output directory
   * Note: Disabled to prevent pre-existing files from being listed as received files
   */
  private async loadExistingFiles(): Promise<void> {
    // Only track files uploaded in the current session
    // Pre-existing files in the directory are not automatically loaded
  }

  /**
   * Save an uploaded file
   */
  async saveFile(
    filename: string,
    content: ArrayBuffer,
    mimeType: string,
  ): Promise<FileInfo> {
    // Validate file size
    if (content.byteLength > this.maxFileSize) {
      throw new Error(
        `File size exceeds maximum allowed size of ${this.maxFileSize} bytes`,
      );
    }

    // Sanitize filename
    const sanitizedName = this.sanitizeFilename(filename);
    const filePath = join(this.outputDir, sanitizedName);

    // Write file
    await writeFile(filePath, Buffer.from(content));

    // Create metadata
    const fileInfo: FileInfo = {
      id: this.generateId(sanitizedName),
      name: sanitizedName,
      size: content.byteLength,
      type: mimeType,
      uploadedAt: new Date().toISOString(),
    };

    this.fileMetadata.set(fileInfo.id, fileInfo);
    return fileInfo;
  }

  /**
   * Get all stored files
   */
  getFiles(): FileInfo[] {
    return Array.from(this.fileMetadata.values());
  }

  /**
   * Get file info by ID
   */
  getFile(fileId: string): FileInfo | undefined {
    return this.fileMetadata.get(fileId);
  }

  /**
   * Delete a file
   */
  async deleteFile(fileId: string): Promise<boolean> {
    const fileInfo = this.fileMetadata.get(fileId);
    if (!fileInfo) {
      return false;
    }

    const filePath = join(this.outputDir, fileInfo.name);
    try {
      await unlink(filePath);
      this.fileMetadata.delete(fileId);
      return true;
    } catch (error) {
      console.error(`[ERR] Failed to delete file ${fileId}:`, error);
      return false;
    }
  }

  /**
   * Sanitize filename to prevent directory traversal
   */
  private sanitizeFilename(filename: string): string {
    // Remove any path separators and suspicious characters
    let sanitized = basename(filename);
    sanitized = sanitized.replace(/[^\w.\-]/g, "_");
    // Prevent empty filenames
    if (!sanitized || sanitized === "_") {
      sanitized = `file_${Date.now()}`;
    }
    return sanitized;
  }

  /**
   * Generate unique ID from filename
   */
  private generateId(filename: string): string {
    return `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  }

  /**
   * Set maximum file size
   */
  setMaxFileSize(bytes: number): void {
    this.maxFileSize = bytes;
  }

  /**
   * Get output directory path
   */
  getOutputDir(): string {
    return this.outputDir;
  }

  /**
   * Get total size of all stored files
   */
  getTotalSize(): number {
    let total = 0;
    for (const file of this.fileMetadata.values()) {
      total += file.size;
    }
    return total;
  }
}

// Create singleton instance
let storageInstance: StorageService | null = null;

/**
 * Get or create storage service instance
 */
export function getStorage(outputDir?: string): StorageService {
  if (!storageInstance) {
    const dir = outputDir || process.cwd();
    storageInstance = new StorageService(dir);
  }
  return storageInstance;
}
