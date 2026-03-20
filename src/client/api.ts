/**
 * API Communication Module
 * Handles all client-server API calls with error handling and type safety
 */

import type { ServerInfo, FilesListResponse, FileInfo } from "@shared/types";

/**
 * API Error class for custom error handling
 */
export class APIError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "APIError";
  }
}

/**
 * Base URL for API calls (uses current host/port)
 */
function getBaseUrl(): string {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }
  const { protocol, hostname, port } = window.location;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
}

/**
 * Helper function to make API requests with error handling
 */
async function makeRequest<T>(
  endpoint: string,
  options?: RequestInit,
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers,
      },
    });

    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;

      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {
        // Failed to parse error response, use default message
      }

      throw new APIError(response.status, errorMessage);
    }

    // Handle empty responses (204 No Content)
    if (response.status === 204) {
      return {} as T;
    }

    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }

    if (error instanceof TypeError) {
      throw new APIError(
        0,
        "Network error: Unable to connect to server. Check your connection.",
      );
    }

    throw new APIError(
      500,
      error instanceof Error ? error.message : "Unknown error occurred",
    );
  }
}

/**
 * Fetch server information (IP, port, device name)
 */
export async function fetchServerInfo(): Promise<ServerInfo> {
  return makeRequest<ServerInfo>("/api/info");
}

/**
 * Upload files to the server
 * Returns response with file IDs and metadata
 */
export async function uploadFiles(
  files: File[],
  onProgress?: (progress: { loaded: number; total: number }) => void,
): Promise<{ fileIds: string[] }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    let totalSize = 0;

    files.forEach((file) => {
      formData.append("files", file);
      totalSize += file.size;
    });

    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener("progress", (e: ProgressEvent) => {
        if (e.lengthComputable) {
          onProgress({
            loaded: e.loaded,
            total: e.total,
          });
        }
      });
    }

    // Handle completion
    xhr.addEventListener("load", () => {
      if (xhr.status === 201 || xhr.status === 200) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch (error) {
          reject(
            new APIError(
              xhr.status,
              "Failed to parse upload response from server",
            ),
          );
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          reject(
            new APIError(
              xhr.status,
              errorData.error?.message ||
                `Upload failed with status ${xhr.status}`,
            ),
          );
        } catch (e) {
          reject(
            new APIError(xhr.status, `Upload failed with status ${xhr.status}`),
          );
        }
      }
    });

    // Handle errors
    xhr.addEventListener("error", () => {
      reject(
        new APIError(0, "Network error during upload. Check your connection."),
      );
    });

    xhr.addEventListener("abort", () => {
      reject(new APIError(0, "Upload was cancelled by user"));
    });

    // Send request
    xhr.open("POST", `${getBaseUrl()}/api/upload`);
    xhr.send(formData);
  });
}

/**
 * Fetch list of uploaded files
 */
export async function fetchFileList(): Promise<FilesListResponse> {
  return makeRequest<FilesListResponse>("/api/files");
}

/**
 * Get a single file by ID
 */
export async function fetchFile(fileId: string): Promise<FileInfo> {
  return makeRequest<FileInfo>(`/api/files/${fileId}`);
}

/**
 * Delete a file by ID
 */
export async function deleteFile(fileId: string): Promise<void> {
  await makeRequest<void>(`/api/files/${fileId}`, {
    method: "DELETE",
  });
}

/**
 * Check server health/connectivity
 */
export async function checkServerHealth(): Promise<boolean> {
  try {
    const response = await fetch(`${getBaseUrl()}/api/info`, {
      method: "HEAD",
    });
    return response.ok;
  } catch (error) {
    return false;
  }
}

/**
 * Get API base URL (for testing/debugging)
 */
export function getApiBaseUrl(): string {
  return getBaseUrl();
}
