/**
 * Shared type definitions for LocalDrop
 * Used across both server and client
 */

// File metadata structure
export interface FileInfo {
  id: string;
  name: string;
  size: number;
  type: string;
  uploadedAt: string;
}

// Upload response from server
export interface UploadResponse {
  success: boolean;
  fileId: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedAt: string;
}

// Server configuration and network details
export interface ServerInfo {
  deviceName: string;
  port: number;
  ip: string;
  version: string;
  timestamp: string;
  qrCode?: string; // QR code as data URL for connection
}

// Standardized error response
export interface APIError {
  error: {
    message: string;
    stack?: string;
  };
}

// Files list response
export interface FilesListResponse {
  files: FileInfo[];
  totalCount: number;
}

// Delete response
export interface DeleteResponse {
  success: boolean;
  message: string;
  id: string;
}

// Health check response
export interface HealthResponse {
  status: string;
  uptime: number;
}

// CLI configuration
export interface CLIConfig {
  port: number;
  host: string;
  outputDir: string;
  open: boolean;
  verbose: boolean;
  help: boolean;
}

// File upload configuration
export interface UploadConfig {
  maxFileSize: number; // in bytes
  allowedMimeTypes: string[];
  sanitizeFilename: boolean;
}

// Upload progress tracking
export interface UploadProgress {
  fileIndex: number;
  fileName: string;
  bytesLoaded: number;
  bytesTotal: number;
  percentage: number;
}

// Upload state during operation
export interface UploadState {
  isUploading: boolean;
  currentFile: number;
  totalFiles: number;
  progress: UploadProgress | null;
  errors: string[];
  completed: Array<{
    success: boolean;
    fileId?: string;
    fileName?: string;
    fileSize?: number;
    error?: string;
  }>;
}
