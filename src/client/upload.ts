/**
 * Upload Module
 * Handles file uploads with progress tracking and error handling
 */

export interface UploadProgress {
  fileIndex: number;
  fileName: string;
  bytesLoaded: number;
  bytesTotal: number;
  percentage: number;
}

export interface UploadResult {
  success: boolean;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export interface UploadState {
  isUploading: boolean;
  currentFile: number;
  totalFiles: number;
  progress: UploadProgress | null;
  errors: string[];
  completed: UploadResult[];
}

/**
 * Upload a single file
 */
export async function uploadFile(
  file: File,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    xhr.upload.addEventListener("progress", (e: ProgressEvent) => {
      if (e.lengthComputable && onProgress) {
        onProgress({
          fileIndex: 0,
          fileName: file.name,
          bytesLoaded: e.loaded,
          bytesTotal: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
        });
      }
    });

    // Handle completion
    xhr.addEventListener("load", () => {
      if (xhr.status === 201) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            success: true,
            fileId: response.fileId,
            fileName: response.fileName,
            fileSize: response.fileSize,
          });
        } catch (error) {
          resolve({
            success: false,
            error: "Failed to parse server response",
          });
        }
      } else {
        resolve({
          success: false,
          error: `Upload failed with status ${xhr.status}`,
        });
      }
    });

    // Handle errors
    xhr.addEventListener("error", () => {
      resolve({
        success: false,
        error: "Network error during upload",
      });
    });

    xhr.addEventListener("abort", () => {
      resolve({
        success: false,
        error: "Upload was cancelled",
      });
    });

    // Send request
    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

/**
 * Upload multiple files sequentially with progress tracking
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (state: UploadState) => void,
): Promise<UploadState> {
  const state: UploadState = {
    isUploading: true,
    currentFile: 0,
    totalFiles: files.length,
    progress: null,
    errors: [],
    completed: [],
  };

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    state.currentFile = i + 1;

    const result = await uploadFile(file, (progress) => {
      state.progress = {
        ...progress,
        fileIndex: i,
      };
      if (onProgress) {
        onProgress({ ...state });
      }
    });

    state.completed.push(result);

    if (!result.success && result.error) {
      state.errors.push(`${file.name}: ${result.error}`);
    }

    if (onProgress) {
      onProgress({ ...state });
    }
  }

  state.isUploading = false;
  if (onProgress) {
    onProgress({ ...state });
  }

  return state;
}

/**
 * Calculate total size of files
 */
export function calculateTotalSize(files: File[]): number {
  return files.reduce((sum, file) => sum + file.size, 0);
}

/**
 * Format bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
