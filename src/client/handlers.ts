/**
 * File Handlers Module
 * Manages drag-and-drop, file validation, and file selection
 */

export interface FileValidationError {
  file: string;
  reason: string;
}

export interface FileValidationResult {
  valid: boolean;
  errors: FileValidationError[];
}

const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500MB
const ALLOWED_MIME_TYPES = ["*/*"]; // Allow all file types

/**
 * Validate a single file
 */
export function validateFile(file: File): FileValidationError | null {
  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    return {
      file: file.name,
      reason: `File size exceeds maximum allowed (${formatFileSize(MAX_FILE_SIZE)})`,
    };
  }

  // File is valid
  return null;
}

/**
 * Validate multiple files
 */
export function validateFiles(files: FileList): FileValidationResult {
  const errors: FileValidationError[] = [];

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (!file) continue;
    const error = validateFile(file);
    if (error) {
      errors.push(error);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Setup drag and drop handlers
 */
export function setupDragAndDrop(
  dropZone: HTMLElement,
  onFilesDrop: (files: FileList) => void,
): void {
  // Prevent default drag behaviors
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults);
    document.body.addEventListener(eventName, preventDefaults);
  });

  // Highlight drop zone on dragover
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add("dragover");
    });
  });

  // Remove highlight on dragleave/drop
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("dragover");
    });
  });

  // Handle dropped files
  dropZone.addEventListener("drop", (e: Event) => {
    const dragEvent = e as DragEvent;
    const files = dragEvent.dataTransfer?.files;
    if (files) {
      onFilesDrop(files);
    }
  });

  // Handle click to browse
  dropZone.addEventListener("click", () => {
    const fileInput = document.getElementById("file-input") as HTMLInputElement;
    fileInput?.click();
  });
}

/**
 * Setup file input change handler
 */
export function setupFileInput(
  fileInputId: string,
  onFilesSelected: (files: FileList) => void,
): void {
  const fileInput = document.getElementById(
    fileInputId,
  ) as HTMLInputElement | null;
  if (!fileInput) return;

  fileInput.addEventListener("change", (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = target.files;
    if (files) {
      onFilesSelected(files);
      // Reset input so same file can be uploaded again
      target.value = "";
    }
  });
}

/**
 * Prevent default drag and drop behavior
 */
function preventDefaults(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
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

/**
 * Convert file to ArrayBuffer
 */
export async function fileToArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}
