/**
 * Upload Module
 * Handles file uploads with progress tracking, retry logic, speed calculation, and error handling
 */

export interface UploadProgress {
  fileIndex: number;
  fileName: string;
  bytesLoaded: number;
  bytesTotal: number;
  percentage: number;
  speedBps: number;      // bytes per second
  etaSeconds: number;    // estimated seconds remaining
  transferId: string;    // unique per-upload ID (not filename-based)
}

export interface UploadResult {
  success: boolean;
  transferId: string;
  fileId?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
  attempts?: number;
}

export interface UploadState {
  isUploading: boolean;
  currentFile: number;
  totalFiles: number;
  totalBytesLoaded: number;
  totalBytesTotal: number;
  overallPercentage: number;
  progress: UploadProgress | null;
  errors: string[];
  completed: UploadResult[];
}

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const UPLOAD_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Generate a unique transfer ID
 */
function generateTransferId(): string {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Upload a single file with retry logic and speed calculation
 */
export async function uploadFile(
  file: File,
  transferId: string,
  fileIndex: number,
  onProgress?: (progress: UploadProgress) => void,
  attempt = 1,
): Promise<UploadResult> {
  const formData = new FormData();
  formData.append("file", file);

  return new Promise<UploadResult>((resolve) => {
    const xhr = new XMLHttpRequest();
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;

    // Timeout handling
    const timeoutId = setTimeout(() => {
      xhr.abort();
    }, UPLOAD_TIMEOUT_MS);

    // Track upload progress with speed calculation
    xhr.upload.addEventListener("progress", (e: ProgressEvent) => {
      if (e.lengthComputable && onProgress) {
        const now = Date.now();
        const timeDelta = (now - lastTime) / 1000; // seconds
        const bytesDelta = e.loaded - lastLoaded;

        // Exponential moving average for speed (smoother)
        const instantSpeed = timeDelta > 0 ? bytesDelta / timeDelta : 0;
        const elapsed = (now - startTime) / 1000;
        const avgSpeed = elapsed > 0 ? e.loaded / elapsed : 0;
        // Blend: 70% average, 30% instant for stability
        const speedBps = avgSpeed * 0.7 + instantSpeed * 0.3;

        const remaining = e.total - e.loaded;
        const etaSeconds = speedBps > 0 ? remaining / speedBps : 0;

        lastLoaded = e.loaded;
        lastTime = now;

        onProgress({
          fileIndex,
          fileName: file.name,
          bytesLoaded: e.loaded,
          bytesTotal: e.total,
          percentage: Math.round((e.loaded / e.total) * 100),
          speedBps,
          etaSeconds,
          transferId,
        });
      }
    });

    xhr.addEventListener("load", () => {
      clearTimeout(timeoutId);
      if (xhr.status === 201) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve({
            success: true,
            transferId,
            fileId: response.fileId,
            fileName: response.fileName,
            fileSize: response.fileSize,
            attempts: attempt,
          });
        } catch (_error) {
          resolve({
            success: false,
            transferId,
            fileName: file.name,
            error: "Failed to parse server response",
            attempts: attempt,
          });
        }
      } else {
        let errorMessage = `Upload failed (HTTP ${xhr.status})`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData?.error?.message) errorMessage = errData.error.message;
        } catch (_) {}

        resolve({
          success: false,
          transferId,
          fileName: file.name,
          error: errorMessage,
          attempts: attempt,
        });
      }
    });

    xhr.addEventListener("error", () => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        transferId,
        fileName: file.name,
        error: "Network error during upload",
        attempts: attempt,
      });
    });

    xhr.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        transferId,
        fileName: file.name,
        error: attempt > 1 ? "Upload timed out" : "Upload was cancelled",
        attempts: attempt,
      });
    });

    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}

/**
 * Upload a single file with automatic retry on failure
 */
async function uploadFileWithRetry(
  file: File,
  transferId: string,
  fileIndex: number,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadResult> {
  let lastResult: UploadResult | null = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    // Notify a retry attempt via progress with 0% to signal restart
    if (attempt > 1 && onProgress) {
      onProgress({
        fileIndex,
        fileName: file.name,
        bytesLoaded: 0,
        bytesTotal: file.size,
        percentage: 0,
        speedBps: 0,
        etaSeconds: 0,
        transferId,
      });
      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }

    const result = await uploadFile(file, transferId, fileIndex, onProgress, attempt);
    lastResult = result;

    if (result.success) return result;

    // Don't retry on certain non-retriable errors
    if (result.error?.includes("cancelled") && attempt === 1) break;
    if (attempt === MAX_RETRIES) break;

    console.warn(
      `[WARN] Upload attempt ${attempt} failed for ${file.name}: ${result.error}. Retrying...`,
    );
  }

  return lastResult!;
}

/**
 * Upload multiple files sequentially with overall progress tracking and retry
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (state: UploadState) => void,
): Promise<UploadState> {
  const totalBytes = files.reduce((s, f) => s + f.size, 0);

  const state: UploadState = {
    isUploading: true,
    currentFile: 0,
    totalFiles: files.length,
    totalBytesLoaded: 0,
    totalBytesTotal: totalBytes,
    overallPercentage: 0,
    progress: null,
    errors: [],
    completed: [],
  };

  // Track bytes completed from previous files
  let previousFilesBytes = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;

    state.currentFile = i + 1;
    const transferId = generateTransferId();

    const result = await uploadFileWithRetry(file, transferId, i, (progress) => {
      state.progress = progress;
      state.totalBytesLoaded = previousFilesBytes + progress.bytesLoaded;
      state.overallPercentage = totalBytes > 0
        ? Math.round((state.totalBytesLoaded / totalBytes) * 100)
        : 0;
      onProgress?.({ ...state });
    });

    previousFilesBytes += file.size;
    state.totalBytesLoaded = previousFilesBytes;
    state.overallPercentage = totalBytes > 0
      ? Math.round((state.totalBytesLoaded / totalBytes) * 100)
      : 0;

    state.completed.push(result);

    if (!result.success && result.error) {
      state.errors.push(`${file.name}: ${result.error}`);
    }

    onProgress?.({ ...state });
  }

  state.isUploading = false;
  state.progress = null;
  onProgress?.({ ...state });

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
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0) + " " + sizes[i];
}

/**
 * Format bytes/second to human-readable speed
 */
export function formatSpeed(bps: number): string {
  if (bps <= 0) return "—";
  return `${formatFileSize(bps)}/s`;
}

/**
 * Format ETA seconds to human-readable duration
 */
export function formatETA(seconds: number): string {
  if (seconds <= 0 || !isFinite(seconds)) return "—";
  if (seconds < 60) return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}
