/**
 * Client-Side State Management Module
 * Maintains application state and provides functions to read/update it
 */

import type { ServerInfo, FileInfo } from "@shared/types";

/**
 * Application state interface
 */
export interface AppState {
  serverInfo: ServerInfo | null;
  files: FileInfo[];
  uploadQueue: File[];
  uploadProgress: Map<string, number>; // fileId -> percentage
  isUploading: boolean;
  theme: "light" | "dark";
}

/**
 * State change callbacks
 */
type StateChangeListener = (state: AppState) => void;
type StateChangeListeners = {
  serverInfo?: StateChangeListener;
  files?: StateChangeListener;
  uploadQueue?: StateChangeListener;
  uploadProgress?: StateChangeListener;
  isUploading?: StateChangeListener;
  theme?: StateChangeListener;
  any?: StateChangeListener;
};

/**
 * Initial application state
 */
const initialState: AppState = {
  serverInfo: null,
  files: [],
  uploadQueue: [],
  uploadProgress: new Map(),
  isUploading: false,
  theme: "light",
};

/**
 * Current application state
 */
let state: AppState = { ...initialState };

/**
 * State change listeners
 */
const listeners: StateChangeListeners = {};

/**
 * Get current state
 */
export function getState(): AppState {
  return { ...state };
}

/**
 * Get a specific state property
 */
export function getStateProperty<K extends keyof AppState>(
  property: K,
): AppState[K] {
  return state[property];
}

/**
 * Update server info
 */
export function setServerInfo(info: ServerInfo): void {
  state.serverInfo = info;
  notifyListeners("serverInfo");
}

/**
 * Get server info
 */
export function getServerInfo(): ServerInfo | null {
  return state.serverInfo;
}

/**
 * Set files list
 */
export function setFiles(files: FileInfo[]): void {
  state.files = [...files];
  notifyListeners("files");
}

/**
 * Get files list
 */
export function getFiles(): FileInfo[] {
  return [...state.files];
}

/**
 * Add file to list
 */
export function addFile(file: FileInfo): void {
  state.files = [file, ...state.files];
  notifyListeners("files");
}

/**
 * Remove file from list by ID
 */
export function removeFile(fileId: string): void {
  state.files = state.files.filter((f) => f.id !== fileId);
  notifyListeners("files");
}

/**
 * Clear files list
 */
export function clearFiles(): void {
  state.files = [];
  notifyListeners("files");
}

/**
 * Add file to upload queue
 */
export function addToUploadQueue(file: File): void {
  state.uploadQueue.push(file);
  notifyListeners("uploadQueue");
}

/**
 * Add multiple files to upload queue
 */
export function addToUploadQueueBatch(files: File[]): void {
  state.uploadQueue = [...state.uploadQueue, ...files];
  notifyListeners("uploadQueue");
}

/**
 * Remove file from upload queue
 */
export function removeFromUploadQueue(fileName: string): void {
  state.uploadQueue = state.uploadQueue.filter((f) => f.name !== fileName);
  notifyListeners("uploadQueue");
}

/**
 * Clear upload queue
 */
export function clearUploadQueue(): void {
  state.uploadQueue = [];
  notifyListeners("uploadQueue");
}

/**
 * Get upload queue
 */
export function getUploadQueue(): File[] {
  return [...state.uploadQueue];
}

/**
 * Set upload progress for a file
 */
export function setUploadProgress(fileId: string, percentage: number): void {
  state.uploadProgress.set(fileId, Math.min(Math.max(percentage, 0), 100));
  notifyListeners("uploadProgress");
}

/**
 * Get upload progress for a file
 */
export function getUploadProgress(fileId: string): number {
  return state.uploadProgress.get(fileId) ?? 0;
}

/**
 * Get all upload progress
 */
export function getAllUploadProgress(): Map<string, number> {
  return new Map(state.uploadProgress);
}

/**
 * Clear upload progress for a file
 */
export function clearUploadProgress(fileId: string): void {
  state.uploadProgress.delete(fileId);
  notifyListeners("uploadProgress");
}

/**
 * Clear all upload progress
 */
export function clearAllUploadProgress(): void {
  state.uploadProgress.clear();
  notifyListeners("uploadProgress");
}

/**
 * Set uploading state
 */
export function setIsUploading(isUploading: boolean): void {
  state.isUploading = isUploading;
  notifyListeners("isUploading");
}

/**
 * Get uploading state
 */
export function getIsUploading(): boolean {
  return state.isUploading;
}

/**
 * Set theme preference
 */
export function setTheme(theme: "light" | "dark"): void {
  state.theme = theme;
  // Persist to localStorage
  localStorage.setItem("theme", theme);
  notifyListeners("theme");
}

/**
 * Get current theme
 */
export function getTheme(): "light" | "dark" {
  return state.theme;
}

/**
 * Initialize theme from localStorage or system preference
 */
export function initializeTheme(): void {
  const savedTheme = localStorage.getItem("theme");
  if (savedTheme === "light" || savedTheme === "dark") {
    state.theme = savedTheme;
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    state.theme = "dark";
  } else {
    state.theme = "light";
  }
  notifyListeners("theme");
}

/**
 * Subscribe to state changes for a specific property
 */
export function subscribe(
  property: keyof AppState | "any",
  callback: StateChangeListener,
): () => void {
  const key = property as keyof typeof listeners;
  if (!listeners[key]) {
    listeners[key] = callback;
  } else {
    // If multiple listeners, wrap them
    const previousListener = listeners[key];
    listeners[key] = (newState: AppState) => {
      previousListener?.(newState);
      callback(newState);
    };
  }

  // Return unsubscribe function
  return () => {
    delete listeners[key];
  };
}

/**
 * Notify all listeners of state changes
 */
function notifyListeners(property: keyof AppState | "any"): void {
  // Notify specific property listeners
  const key = property as keyof typeof listeners;
  if (listeners[key]) {
    listeners[key]!(state);
  }

  // Notify generic "any" listeners
  if (listeners.any) {
    listeners.any(state);
  }
}

/**
 * Reset state to initial values
 */
export function resetState(): void {
  state = {
    serverInfo: null,
    files: [],
    uploadQueue: [],
    uploadProgress: new Map(),
    isUploading: false,
    theme: state.theme, // Keep theme preference
  };
  notifyListeners("any");
}

/**
 * Get state statistics
 */
export function getStateStats(): {
  fileCount: number;
  queueSize: number;
  totalUploadSize: number;
  isUploading: boolean;
} {
  const totalUploadSize = state.uploadQueue.reduce(
    (sum, file) => sum + file.size,
    0,
  );

  return {
    fileCount: state.files.length,
    queueSize: state.uploadQueue.length,
    totalUploadSize,
    isUploading: state.isUploading,
  };
}
