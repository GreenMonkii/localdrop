/**
 * LocalDrop Client - Main Application Entry Point
 * Handles initialization, real-time file polling, and UI updates
 */

import {
  fetchServerInfo,
  fetchFileList,
  deleteFile as deleteFileAPI,
} from "./api";
import { setupDragAndDrop, setupFileInput, validateFiles } from "./handlers";
import {
  showElement,
  hideElement,
  addFileToList,
  removeFileFromList,
  clearFileList,
  formatFileSize,
  escapeHtml,
} from "./ui";
import { uploadFiles as uploadMultipleFiles } from "./upload";
import type { FileInfo } from "@shared/types";

/**
 * Application state
 */
let state = {
  serverInfo: null as any,
  files: [] as FileInfo[],
  isUploading: false,
  fileListPollInterval: null as NodeJS.Timer | null,
  currentTab: "send" as "send" | "receive",
  deleteModal: null as { fileId: string; fileName: string } | null,
};

/**
 * Initialize the application
 */
export async function initializeApp(): Promise<void> {
  try {
    console.log("[>] Initializing LocalDrop client...");

    // Fetch server info and update UI
    await loadServerInfo();

    // Setup event handlers
    setupEventHandlers();

    // Load initial file list
    await loadFileList();

    // Setup tab switching
    setupTabSwitching();

    console.log("[>] LocalDrop client ready");
  } catch (error) {
    console.error("[ERR] Failed to initialize app:", error);
    showToast("Failed to initialize application", "error");
  }
}

/**
 * Load server information and update UI
 */
async function loadServerInfo(): Promise<void> {
  try {
    const response = await fetch("/api/info");
    if (!response.ok) throw new Error("Failed to fetch server info");

    const info = await response.json();
    state.serverInfo = info;
    updateServerInfoUI(info);
  } catch (error) {
    console.error("[ERR] Failed to fetch server info:", error);
    showToast("Could not connect to server", "error");
  }
}

/**
 * Update server info in the UI
 */
function updateServerInfoUI(info: any): void {
  const deviceName = document.getElementById("device-name");
  const localIp = document.getElementById("local-ip");
  const portInfo = document.getElementById("port-info");
  const statusText = document.getElementById("status-text");
  const statusIcon = document.querySelector(".status-icon");
  const qrCodeContainer = document.getElementById("qr-code");

  if (deviceName) deviceName.textContent = info.deviceName;
  if (localIp) localIp.textContent = info.ip;
  if (portInfo) portInfo.textContent = info.port.toString();

  if (statusText) statusText.textContent = "Online";
  if (statusIcon) statusIcon.classList.add("connected");

  // Load QR code
  if (qrCodeContainer && info.qrCode) {
    const img = document.createElement("img");
    img.src = info.qrCode;
    img.alt = "Connection QR Code";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
    img.style.objectFit = "cover";

    img.onload = () => {
      qrCodeContainer.classList.remove("qr-skeleton");
      qrCodeContainer.innerHTML = "";
      qrCodeContainer.appendChild(img);
    };

    img.onerror = () => {
      console.error("[ERR] Failed to load QR code");
      qrCodeContainer.classList.remove("qr-skeleton");
      qrCodeContainer.textContent = "Failed to load QR code";
    };
  }
}

/**
 * Load file list from server
 */
async function loadFileList(): Promise<void> {
  try {
    const response = await fetchFileList();
    state.files = response.files;
    renderFileList(response.files);
  } catch (error) {
    console.error("[ERR] Failed to load file list:", error);
  }
}

/**
 * Show delete confirmation modal
 */
function showDeleteModal(fileId: string, fileName: string): void {
  state.deleteModal = { fileId, fileName };

  const modal = document.getElementById("delete-modal");
  if (!modal) {
    createDeleteModal();
  }

  const modal2 = document.getElementById("delete-modal");
  if (modal2) {
    modal2.classList.add("active");
    const fileNameEl = modal2.querySelector(".delete-file-name");
    if (fileNameEl) {
      fileNameEl.textContent = escapeHtml(fileName);
    }

    const confirmBtn = modal2.querySelector(
      ".delete-confirm-btn",
    ) as HTMLButtonElement;
    const cancelBtn = modal2.querySelector(
      ".delete-cancel-btn",
    ) as HTMLButtonElement;

    if (confirmBtn) {
      confirmBtn.onclick = () => {
        confirmedDeleteFile(fileId);
        closeDeleteModal();
      };
    }

    if (cancelBtn) {
      cancelBtn.onclick = closeDeleteModal;
    }
  }
}

/**
 * Close delete confirmation modal
 */
function closeDeleteModal(): void {
  const modal = document.getElementById("delete-modal");
  if (modal) {
    modal.classList.remove("active");
  }
  state.deleteModal = null;
}

/**
 * Create delete confirmation modal in DOM
 */
function createDeleteModal(): void {
  if (document.getElementById("delete-modal")) return;

  const modal = document.createElement("div");
  modal.id = "delete-modal";
  modal.className = "delete-modal";
  modal.innerHTML = `
    <div class="delete-modal-overlay"></div>
    <div class="delete-modal-content">
      <h2>Delete File?</h2>
      <p>Are you sure you want to delete <strong class="delete-file-name"></strong>?</p>
      <p class="delete-modal-warning">This action cannot be undone.</p>
      <div class="delete-modal-actions">
        <button class="delete-cancel-btn btn">Cancel</button>
        <button class="delete-confirm-btn btn btn-danger">Delete</button>
      </div>
    </div>
  `;

  modal
    .querySelector(".delete-modal-overlay")
    ?.addEventListener("click", closeDeleteModal);

  document.body.appendChild(modal);
}

/**
 * Confirmed delete file
 */
async function confirmedDeleteFile(fileId: string): Promise<void> {
  try {
    await deleteFileAPI(fileId);
    showToast("File deleted successfully", "success");
    await loadFileList();
  } catch (error) {
    console.error("[ERR] Failed to delete file:", error);
    showToast("Failed to delete file", "error");
  }
}

/**
 * Render file list to the receive tab
 */
function renderFileList(files: FileInfo[]): void {
  const container = document.getElementById("files-list-container");
  if (!container) return;

  if (files.length === 0) {
    container.innerHTML = `
      <div class="receive-placeholder">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="currentColor" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="receive-icon">
          <path d="M15.5 3.49973C19.7 3.49973 21.5 5.89973 21.5 9.49973L19.5 8.49973" />
          <path d="M8.5 20.4997C4.3 20.4997 2.5 18.0997 2.5 14.4997L4.5 15.4997" />
          <path d="M7.49947 4.51198L7.18117 3.87006C6.92232 3.34805 6.79289 3.08703 6.59399 2.9012C6.4498 2.76649 6.28045 2.66155 6.09564 2.5924C5.8407 2.497 5.54936 2.49729 4.96668 2.49786C4.06212 2.49874 3.60984 2.49918 3.27025 2.68828C3.02596 2.82431 2.82456 3.02591 2.68877 3.27033C2.5 3.61011 2.5 4.06239 2.5 4.96695V7.50026C2.5 9.38588 2.5 10.3287 3.08579 10.9145C3.67157 11.5003 4.61438 11.5003 6.5 11.5003H9.00371C10.4043 11.5003 11.1045 11.5003 11.6081 11.165C11.8285 11.0182 12.0176 10.8291 12.1643 10.6087C12.4996 10.1052 12.4996 9.40492 12.4996 8.00437C12.4996 6.60083 12.4996 5.89907 12.1634 5.39504C12.0162 5.17442 11.8266 4.98527 11.6056 4.83861C11.1008 4.50354 10.399 4.50519 8.99552 4.50848L7.49947 4.51198Z" />
          <path d="M16.5001 14.5139L16.8184 13.8719C17.0773 13.3499 17.2067 13.0889 17.4056 12.9031C17.5498 12.7684 17.7192 12.6634 17.904 12.5943C18.1589 12.4989 18.4503 12.4992 19.0329 12.4997C19.9375 12.5006 20.3898 12.5011 20.7294 12.6901C20.9736 12.8262 21.1751 13.0278 21.3108 13.2722C21.4996 13.612 21.4996 14.0643 21.4996 14.9688V17.5021C21.4996 19.3878 21.4996 20.3306 20.9138 20.9163C20.328 21.5021 19.3852 21.5021 17.4996 21.5021H14.9959C13.5953 21.5021 12.8951 21.5021 12.3915 21.1669C12.1711 21.0201 11.982 20.831 11.8353 20.6106C11.5 20.1071 11.5 19.4068 11.5 18.0062C11.5 16.6027 11.5 15.3009 11.8362 15.3969C11.9834 15.1763 12.173 14.9871 12.394 14.8405C12.8988 14.5054 13.6006 14.5071 15.0041 14.5103L16.5001 14.5139Z" />
        </svg>
        <p class="receive-title">Waiting for transfers</p>
        <p class="receive-subtitle">Files received will appear here</p>
      </div>
    `;
    return;
  }

  // Clear existing content and render files
  container.innerHTML = "";

  const filesList = document.createElement("div");
  filesList.className = "files-list-items";

  files.forEach((file) => {
    const fileItem = document.createElement("div");
    fileItem.className = "file-item";
    fileItem.id = `file-${file.id}`;

    const formattedSize = formatFileSize(file.size);
    const formattedDate = new Date(file.uploadedAt).toLocaleString();

    fileItem.innerHTML = `
      <div class="file-item-header">
        <div class="file-item-info">
          <div class="file-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
              <polyline points="13 2 13 9 20 9"/>
            </svg>
          </div>
          <div class="file-details">
            <p class="file-name">${escapeHtml(file.name)}</p>
            <div class="file-meta">
              <span class="file-meta-item">${formattedSize}</span>
              <span class="file-meta-item">${formattedDate}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="file-item-actions">
        <button class="file-btn btn-download-file" title="Download file">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.99969 17.0002C2.99969 17.9302 2.99969 18.3952 3.10192 18.7767C3.37932 19.8119 4.18796 20.6206 5.22324 20.898C5.60474 21.0002 6.06972 21.0002 6.99969 21.0002L16.9997 21.0002C17.9297 21.0002 18.3947 21.0002 18.7762 20.898C19.8114 20.6206 20.6201 19.8119 20.8975 18.7767C20.9997 18.3952 20.9997 17.9302 20.9997 17.0002" />
            <path d="M16.4998 11.5002C16.4998 11.5002 13.1856 16.0002 11.9997 16.0002C10.8139 16.0002 7.49976 11.5002 7.49976 11.5002M11.9997 15.0002V3.00016" />
          </svg>
        </button>
      </div>
    `;

    // Add download handler
    const downloadBtn = fileItem.querySelector(
      ".btn-download-file",
    ) as HTMLButtonElement;
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => downloadFile(file));
    }

    filesList.appendChild(fileItem);
  });

  container.appendChild(filesList);

  // Add download all button
  const downloadAllContainer = document.createElement("div");
  downloadAllContainer.className = "download-all-container";
  downloadAllContainer.innerHTML = `
    <button class="btn btn-primary btn-download-all">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.99969 17.0002C2.99969 17.9302 2.99969 18.3952 3.10192 18.7767C3.37932 19.8119 4.18796 20.6206 5.22324 20.898C5.60474 21.0002 6.06972 21.0002 6.99969 21.0002L16.9997 21.0002C17.9297 21.0002 18.3947 21.0002 18.7762 20.898C19.8114 20.6206 20.6201 19.8119 20.8975 18.7767C20.9997 18.3952 20.9997 17.9302 20.9997 17.0002" />
        <path d="M16.4998 11.5002C16.4998 11.5002 13.1856 16.0002 11.9997 16.0002C10.8139 16.0002 7.49976 11.5002 7.49976 11.5002M11.9997 15.0002V3.00016" />
      </svg>
      Download All
    </button>
  `;

  const downloadAllBtn = downloadAllContainer.querySelector(
    ".btn-download-all",
  ) as HTMLButtonElement;
  if (downloadAllBtn) {
    downloadAllBtn.addEventListener("click", () => downloadAllFiles(files));
  }

  container.appendChild(downloadAllContainer);
}

/**
 * Download all files as individual downloads
 */
function downloadAllFiles(files: FileInfo[]): void {
  files.forEach((file, index) => {
    // Stagger downloads slightly to avoid browser blocking
    setTimeout(() => {
      downloadFile(file);
    }, index * 200);
  });
  showToast(`Downloading ${files.length} file(s)...`, "info");
}

/**
 * Download a file
 */
function downloadFile(file: FileInfo): void {
  const link = document.createElement("a");
  link.href = `/api/files/${file.id}/download`;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Downloading ${file.name}...`, "info");
}

/**
 * Delete a file (shows modal confirmation)
 */
function deleteFile(fileId: string): void {
  const file = state.files.find((f) => f.id === fileId);
  if (file) {
    showDeleteModal(fileId, file.name);
  }
}

/**
 * Setup event handlers for drag-drop and file input
 */
function setupEventHandlers(): void {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone) return;

  setupDragAndDrop(dropZone, handleFilesDrop);
  setupFileInput("file-input", handleFilesDrop);

  // Create delete modal on init
  createDeleteModal();
}

/**
 * Handle dropped or selected files
 */
async function handleFilesDrop(files: FileList): Promise<void> {
  if (state.isUploading) {
    showToast("Already uploading files. Please wait.", "error");
    return;
  }

  // Validate files
  const validationResult = validateFiles(files);
  if (!validationResult.valid) {
    validationResult.errors.forEach((error) => {
      showToast(`${error.file}: ${error.reason}`, "error");
    });
    return;
  }

  const fileArray = Array.from(files);
  state.isUploading = true;

  try {
    const uploadState = await uploadMultipleFiles(fileArray, (state) => {
      updateUploadUI(state);
    });

    if (uploadState.errors.length === 0) {
      showToast(`Successfully uploaded ${fileArray.length} file(s)`, "success");
    } else {
      uploadState.errors.forEach((error: string) => {
        showToast(error, "error");
      });
    }
  } catch (error: unknown) {
    console.error("[ERR] Upload error:", error);
    showToast(
      error instanceof Error ? error.message : "Upload failed",
      "error",
    );
  } finally {
    state.isUploading = false;
  }
}

/**
 * Update upload UI with progress
 */
function updateUploadUI(uploadState: any): void {
  const progressSection = document.getElementById("upload-progress");
  const progressBar = document.getElementById("progress-bar");
  const progressPercentage = document.getElementById("progress-percentage");
  const transfersList = document.getElementById("transfers-list");

  if (!progressSection || !transfersList) return;

  if (uploadState.progress) {
    showElement("upload-progress");

    if (progressBar) {
      progressBar.style.width = `${uploadState.progress.percentage}%`;
    }
    if (progressPercentage) {
      progressPercentage.textContent = `${uploadState.progress.percentage}%`;
    }

    // Update transfer item
    const transferId = `transfer-${uploadState.progress.fileName}`;
    let transferItem = document.getElementById(transferId) as HTMLElement;

    if (!transferItem) {
      transferItem = document.createElement("div");
      transferItem.id = transferId;
      transferItem.className = "transfer-item uploading";
      transfersList.appendChild(transferItem);
    }

    transferItem.innerHTML = `
      <div class="transfer-header">
        <span class="transfer-name">${escapeHtml(uploadState.progress.fileName)}</span>
        <span class="transfer-status">Uploading...</span>
      </div>
      <div class="transfer-meta">
        <span class="transfer-size">${formatFileSize(uploadState.progress.bytesLoaded)} / ${formatFileSize(uploadState.progress.bytesTotal)}</span>
      </div>
      <div class="transfer-progress-bar">
        <div class="transfer-progress-fill" style="width: ${uploadState.progress.percentage}%"></div>
      </div>
    `;
  }

  if (!uploadState.isUploading) {
    hideElement("upload-progress");

    // Update completed items
    uploadState.completed.forEach((result: any, index: number) => {
      const transferId = `transfer-${result.fileName || `file-${index}`}`;
      let transferItem = document.getElementById(transferId) as HTMLElement;

      if (!transferItem) {
        transferItem = document.createElement("div");
        transferItem.id = transferId;
        transfersList.appendChild(transferItem);
      }

      if (result.success) {
        transferItem.className = "transfer-item completed";
        transferItem.innerHTML = `
          <div class="transfer-header">
            <span class="transfer-name">${escapeHtml(result.fileName)}</span>
            <span class="transfer-status">✓ Completed</span>
          </div>
        `;
      } else {
        transferItem.className = "transfer-item failed";
        transferItem.innerHTML = `
          <div class="transfer-header">
            <span class="transfer-name">${escapeHtml(result.fileName)}</span>
            <span class="transfer-status">✗ Failed</span>
          </div>
          <div class="transfer-error">${escapeHtml(result.error)}</div>
        `;
      }

      // Keep completed items visible for user confirmation
      // Do not auto-remove - user can see persistent confirmation of successful upload
    });
  }
}

/**
 * Setup tab switching with visual updates and polling control
 */
function setupTabSwitching(): void {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab") as "send" | "receive";
      if (!tabName) return;

      // Update active button
      document.querySelectorAll(".tab-button").forEach((b) => {
        b.classList.remove("active");
      });
      button.classList.add("active");

      // Update active content
      document.querySelectorAll(".tab-content").forEach((content) => {
        content.classList.remove("active");
      });
      const tabElement = document.getElementById(`${tabName}-tab`);
      if (tabElement) {
        tabElement.classList.add("active");
      }

      // Update state and control polling
      state.currentTab = tabName;
      if (tabName === "receive") {
        startFileListPolling();
      } else {
        stopFileListPolling();
      }
    });
  });
}

/**
 * Start polling for file list updates
 */
function startFileListPolling(): void {
  if (state.fileListPollInterval) return;

  console.log("[>] Starting file list polling");
  state.fileListPollInterval = setInterval(async () => {
    try {
      const response = await fetchFileList();
      state.files = response.files;
      renderFileList(response.files);
    } catch (error) {
      console.error("[ERR] Failed to poll files:", error);
    }
  }, 2000);
}

/**
 * Stop polling for file list updates
 */
function stopFileListPolling(): void {
  if (state.fileListPollInterval) {
    console.log("[>] Stopping file list polling");
    clearInterval(state.fileListPollInterval);
    state.fileListPollInterval = null;
  }
}

/**
 * Show toast notification
 */
function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
): void {
  if (typeof window !== "undefined" && (window as any).showToast) {
    (window as any).showToast(message, type, 5000);
  }
}

/**
 * Export for global access
 */
(window as any).updateFileListUI = renderFileList;

// Initialize app when DOM is ready
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
