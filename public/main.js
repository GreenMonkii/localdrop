// src/client/api.ts
class APIError extends Error {
  status;
  constructor(status, message) {
    super(message);
    this.status = status;
    this.name = "APIError";
  }
}
function getBaseUrl() {
  if (typeof window === "undefined") {
    return "http://localhost:3000";
  }
  const { protocol, hostname, port } = window.location;
  return port ? `${protocol}//${hostname}:${port}` : `${protocol}//${hostname}`;
}
async function makeRequest(endpoint, options) {
  const url = `${getBaseUrl()}${endpoint}`;
  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options?.headers
      }
    });
    if (!response.ok) {
      let errorMessage = `API Error: ${response.status} ${response.statusText}`;
      try {
        const errorData = await response.json();
        if (errorData.error?.message) {
          errorMessage = errorData.error.message;
        }
      } catch (e) {}
      throw new APIError(response.status, errorMessage);
    }
    if (response.status === 204) {
      return {};
    }
    return await response.json();
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    if (error instanceof TypeError) {
      throw new APIError(0, "Network error: Unable to connect to server. Check your connection.");
    }
    throw new APIError(500, error instanceof Error ? error.message : "Unknown error occurred");
  }
}
async function fetchFileList() {
  return makeRequest("/api/files");
}
async function deleteFile(fileId) {
  await makeRequest(`/api/files/${fileId}`, {
    method: "DELETE"
  });
}

// src/client/handlers.ts
var MAX_FILE_SIZE = 500 * 1024 * 1024;
function validateFile(file) {
  if (file.size > MAX_FILE_SIZE) {
    return {
      file: file.name,
      reason: `File size exceeds maximum allowed (${formatFileSize(MAX_FILE_SIZE)})`
    };
  }
  return null;
}
function validateFiles(files) {
  const errors = [];
  for (let i = 0;i < files.length; i++) {
    const file = files[i];
    if (!file)
      continue;
    const error = validateFile(file);
    if (error) {
      errors.push(error);
    }
  }
  return {
    valid: errors.length === 0,
    errors
  };
}
function setupDragAndDrop(dropZone, onFilesDrop) {
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, preventDefaults);
    document.body.addEventListener(eventName, preventDefaults);
  });
  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, () => {
      dropZone.classList.remove("dragover");
    });
  });
  dropZone.addEventListener("drop", (e) => {
    const dragEvent = e;
    const files = dragEvent.dataTransfer?.files;
    if (files) {
      onFilesDrop(files);
    }
  });
  dropZone.addEventListener("click", () => {
    const fileInput = document.getElementById("file-input");
    fileInput?.click();
  });
}
function setupFileInput(fileInputId, onFilesSelected) {
  const fileInput = document.getElementById(fileInputId);
  if (!fileInput)
    return;
  fileInput.addEventListener("change", (e) => {
    const target = e.target;
    const files = target.files;
    if (files) {
      onFilesSelected(files);
      target.value = "";
    }
  });
}
function preventDefaults(e) {
  e.preventDefault();
  e.stopPropagation();
}
function formatFileSize(bytes) {
  if (bytes === 0)
    return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}

// src/client/ui.ts
function showElement(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove("hidden");
    element.removeAttribute("hidden");
  }
}
function hideElement(elementId) {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.add("hidden");
    element.setAttribute("hidden", "");
  }
}
function formatFileSize2(bytes) {
  if (bytes === 0)
    return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + " " + sizes[i];
}
function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// src/client/upload.ts
var MAX_RETRIES = 3;
var RETRY_DELAY_MS = 1000;
var UPLOAD_TIMEOUT_MS = 5 * 60 * 1000;
function generateTransferId() {
  return `t-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}
async function uploadFile(file, transferId, fileIndex, onProgress, attempt = 1) {
  const formData = new FormData;
  formData.append("file", file);
  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest;
    const startTime = Date.now();
    let lastLoaded = 0;
    let lastTime = startTime;
    const timeoutId = setTimeout(() => {
      xhr.abort();
    }, UPLOAD_TIMEOUT_MS);
    xhr.upload.addEventListener("progress", (e) => {
      if (e.lengthComputable && onProgress) {
        const now = Date.now();
        const timeDelta = (now - lastTime) / 1000;
        const bytesDelta = e.loaded - lastLoaded;
        const instantSpeed = timeDelta > 0 ? bytesDelta / timeDelta : 0;
        const elapsed = (now - startTime) / 1000;
        const avgSpeed = elapsed > 0 ? e.loaded / elapsed : 0;
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
          percentage: Math.round(e.loaded / e.total * 100),
          speedBps,
          etaSeconds,
          transferId
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
            attempts: attempt
          });
        } catch (_error) {
          resolve({
            success: false,
            transferId,
            fileName: file.name,
            error: "Failed to parse server response",
            attempts: attempt
          });
        }
      } else {
        let errorMessage = `Upload failed (HTTP ${xhr.status})`;
        try {
          const errData = JSON.parse(xhr.responseText);
          if (errData?.error?.message)
            errorMessage = errData.error.message;
        } catch (_) {}
        resolve({
          success: false,
          transferId,
          fileName: file.name,
          error: errorMessage,
          attempts: attempt
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
        attempts: attempt
      });
    });
    xhr.addEventListener("abort", () => {
      clearTimeout(timeoutId);
      resolve({
        success: false,
        transferId,
        fileName: file.name,
        error: attempt > 1 ? "Upload timed out" : "Upload was cancelled",
        attempts: attempt
      });
    });
    xhr.open("POST", "/api/upload");
    xhr.send(formData);
  });
}
async function uploadFileWithRetry(file, transferId, fileIndex, onProgress) {
  let lastResult = null;
  for (let attempt = 1;attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 1 && onProgress) {
      onProgress({
        fileIndex,
        fileName: file.name,
        bytesLoaded: 0,
        bytesTotal: file.size,
        percentage: 0,
        speedBps: 0,
        etaSeconds: 0,
        transferId
      });
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
    }
    const result = await uploadFile(file, transferId, fileIndex, onProgress, attempt);
    lastResult = result;
    if (result.success)
      return result;
    if (result.error?.includes("cancelled") && attempt === 1)
      break;
    if (attempt === MAX_RETRIES)
      break;
    console.warn(`[WARN] Upload attempt ${attempt} failed for ${file.name}: ${result.error}. Retrying...`);
  }
  return lastResult;
}
async function uploadFiles(files, onProgress) {
  const totalBytes = files.reduce((s, f) => s + f.size, 0);
  const state = {
    isUploading: true,
    currentFile: 0,
    totalFiles: files.length,
    totalBytesLoaded: 0,
    totalBytesTotal: totalBytes,
    overallPercentage: 0,
    progress: null,
    errors: [],
    completed: []
  };
  let previousFilesBytes = 0;
  for (let i = 0;i < files.length; i++) {
    const file = files[i];
    if (!file)
      continue;
    state.currentFile = i + 1;
    const transferId = generateTransferId();
    const result = await uploadFileWithRetry(file, transferId, i, (progress) => {
      state.progress = progress;
      state.totalBytesLoaded = previousFilesBytes + progress.bytesLoaded;
      state.overallPercentage = totalBytes > 0 ? Math.round(state.totalBytesLoaded / totalBytes * 100) : 0;
      onProgress?.({ ...state });
    });
    previousFilesBytes += file.size;
    state.totalBytesLoaded = previousFilesBytes;
    state.overallPercentage = totalBytes > 0 ? Math.round(state.totalBytesLoaded / totalBytes * 100) : 0;
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
function formatFileSize3(bytes) {
  if (bytes === 0)
    return "0 B";
  if (bytes < 1024)
    return `${bytes} B`;
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return (bytes / Math.pow(k, i)).toFixed(i > 1 ? 1 : 0) + " " + sizes[i];
}
function formatSpeed(bps) {
  if (bps <= 0)
    return "—";
  return `${formatFileSize3(bps)}/s`;
}
function formatETA(seconds) {
  if (seconds <= 0 || !isFinite(seconds))
    return "—";
  if (seconds < 60)
    return `${Math.ceil(seconds)}s`;
  const m = Math.floor(seconds / 60);
  const s = Math.ceil(seconds % 60);
  return s > 0 ? `${m}m ${s}s` : `${m}m`;
}

// src/client/main.ts
var state = {
  serverInfo: null,
  files: [],
  isUploading: false,
  fileListPollInterval: null,
  currentTab: "send",
  deleteModal: null
};
async function initializeApp() {
  try {
    console.log("[>] Initializing LocalDrop client...");
    await loadServerInfo();
    setupEventHandlers();
    await loadFileList();
    setupTabSwitching();
    console.log("[>] LocalDrop client ready");
  } catch (error) {
    console.error("[ERR] Failed to initialize app:", error);
    showToast("Failed to initialize application", "error");
  }
}
async function loadServerInfo() {
  try {
    const response = await fetch("/api/info");
    if (!response.ok)
      throw new Error("Failed to fetch server info");
    const info = await response.json();
    state.serverInfo = info;
    updateServerInfoUI(info);
  } catch (error) {
    console.error("[ERR] Failed to fetch server info:", error);
    showToast("Could not connect to server", "error");
  }
}
function updateServerInfoUI(info) {
  const deviceName = document.getElementById("device-name");
  const localIp = document.getElementById("local-ip");
  const portInfo = document.getElementById("port-info");
  const statusText = document.getElementById("status-text");
  const statusIcon = document.querySelector(".status-icon");
  const qrCodeContainer = document.getElementById("qr-code");
  const urlDisplay = document.getElementById("connection-url");
  const copyBtn = document.getElementById("copy-url-btn");
  if (deviceName)
    deviceName.textContent = info.deviceName;
  if (localIp)
    localIp.textContent = info.ip;
  if (portInfo)
    portInfo.textContent = info.port.toString();
  if (statusText)
    statusText.textContent = "Online";
  if (statusIcon)
    statusIcon.classList.add("connected");
  const connectionUrl = `http://${info.ip}:${info.port}`;
  if (urlDisplay)
    urlDisplay.textContent = connectionUrl;
  if (copyBtn) {
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(connectionUrl);
        copyBtn.classList.add("copied");
        const originalTitle = copyBtn.getAttribute("title");
        copyBtn.setAttribute("title", "Copied!");
        setTimeout(() => {
          copyBtn.classList.remove("copied");
          copyBtn.setAttribute("title", originalTitle || "Copy URL");
        }, 2000);
      } catch (_) {
        const el = document.createElement("textarea");
        el.value = connectionUrl;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        showToast("URL copied!", "success");
      }
    });
  }
  if (qrCodeContainer && info.qrCode) {
    const img = document.createElement("img");
    img.src = info.qrCode;
    img.alt = "Connection QR Code";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.display = "block";
    img.style.objectFit = "contain";
    img.onload = () => {
      qrCodeContainer.classList.remove("qr-skeleton");
      qrCodeContainer.innerHTML = "";
      qrCodeContainer.appendChild(img);
    };
    img.onerror = () => {
      console.error("[ERR] Failed to load QR code");
      qrCodeContainer.classList.remove("qr-skeleton");
      qrCodeContainer.textContent = "QR unavailable";
    };
  }
}
async function loadFileList() {
  try {
    const response = await fetchFileList();
    state.files = response.files;
    renderFileList(response.files);
  } catch (error) {
    console.error("[ERR] Failed to load file list:", error);
  }
}
function showDeleteModal(fileId, fileName) {
  state.deleteModal = { fileId, fileName };
  let modal = document.getElementById("delete-modal");
  if (!modal) {
    createDeleteModal();
    modal = document.getElementById("delete-modal");
  }
  if (modal) {
    modal.classList.add("active");
    const fileNameEl = modal.querySelector(".delete-file-name");
    if (fileNameEl) {
      fileNameEl.textContent = fileName;
    }
    const confirmBtn = modal.querySelector(".delete-confirm-btn");
    const cancelBtn = modal.querySelector(".delete-cancel-btn");
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
function closeDeleteModal() {
  const modal = document.getElementById("delete-modal");
  if (modal)
    modal.classList.remove("active");
  state.deleteModal = null;
}
function createDeleteModal() {
  if (document.getElementById("delete-modal"))
    return;
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
  modal.querySelector(".delete-modal-overlay")?.addEventListener("click", closeDeleteModal);
  document.body.appendChild(modal);
}
async function confirmedDeleteFile(fileId) {
  try {
    await deleteFile(fileId);
    showToast("File deleted successfully", "success");
    await loadFileList();
  } catch (error) {
    console.error("[ERR] Failed to delete file:", error);
    showToast("Failed to delete file", "error");
  }
}
function getFileIcon(fileName) {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "avif"].includes(ext)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>`;
  }
  if (["mp4", "mov", "avi", "mkv", "webm", "flv"].includes(ext)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18"/><path d="M7 2v20M17 2v20M2 12h20M2 7h5M2 17h5M17 17h5M17 7h5"/>
    </svg>`;
  }
  if (["mp3", "wav", "flac", "aac", "ogg", "m4a"].includes(ext)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>`;
  }
  if (["zip", "tar", "gz", "rar", "7z", "bz2"].includes(ext)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/>
      <line x1="10" y1="12" x2="14" y2="12"/>
    </svg>`;
  }
  if (["js", "ts", "jsx", "tsx", "json", "html", "css", "py", "go", "rs", "java", "c", "cpp", "sh", "yaml", "yml", "toml", "xml", "sql", "txt", "md"].includes(ext)) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
    </svg>`;
  }
  if (ext === "pdf") {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
      <polyline points="14 2 14 8 20 8"/>
      <line x1="9" y1="15" x2="15" y2="15"/>
    </svg>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
    <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
    <polyline points="13 2 13 9 20 9"/>
  </svg>`;
}
function renderFileList(files) {
  const container = document.getElementById("files-list-container");
  if (!container)
    return;
  if (files.length === 0) {
    if (!container.querySelector(".receive-placeholder")) {
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
    }
    return;
  }
  let filesList = container.querySelector(".files-list-items");
  const hadPlaceholder = !!container.querySelector(".receive-placeholder");
  if (hadPlaceholder || !filesList) {
    container.innerHTML = "";
    filesList = document.createElement("div");
    filesList.className = "files-list-items";
    container.appendChild(filesList);
  }
  const existingItems = new Map;
  filesList.querySelectorAll(".file-item[data-file-id]").forEach((el) => {
    const id = el.dataset.fileId;
    if (id)
      existingItems.set(id, el);
  });
  const newIds = new Set(files.map((f) => f.id));
  existingItems.forEach((el, id) => {
    if (!newIds.has(id)) {
      el.classList.add("file-item-removing");
      setTimeout(() => el.remove(), 300);
    }
  });
  files.forEach((file, index) => {
    if (existingItems.has(file.id)) {
      return;
    }
    const fileItem = document.createElement("div");
    fileItem.className = "file-item file-item-entering";
    fileItem.dataset.fileId = file.id;
    fileItem.id = `file-${file.id}`;
    const formattedSize = formatFileSize2(file.size);
    const formattedDate = new Date(file.uploadedAt).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
    fileItem.innerHTML = `
      <div class="file-item-header">
        <div class="file-item-info">
          <div class="file-icon">
            ${getFileIcon(file.name)}
          </div>
          <div class="file-details">
            <p class="file-name" title="${escapeHtml(file.name)}">${escapeHtml(file.name)}</p>
            <div class="file-meta">
              <span class="file-meta-item">${formattedSize}</span>
              <span class="file-meta-sep">·</span>
              <span class="file-meta-item">${formattedDate}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="file-item-actions">
        <button class="file-btn btn-download-file" title="Download ${escapeHtml(file.name)}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <path d="M2.99969 17.0002C2.99969 17.9302 2.99969 18.3952 3.10192 18.7767C3.37932 19.8119 4.18796 20.6206 5.22324 20.898C5.60474 21.0002 6.06972 21.0002 6.99969 21.0002L16.9997 21.0002C17.9297 21.0002 18.3947 21.0002 18.7762 20.898C19.8114 20.6206 20.6201 19.8119 20.8975 18.7767C20.9997 18.3952 20.9997 17.9302 20.9997 17.0002" />
            <path d="M16.4998 11.5002C16.4998 11.5002 13.1856 16.0002 11.9997 16.0002C10.8139 16.0002 7.49976 11.5002 7.49976 11.5002M11.9997 15.0002V3.00016" />
          </svg>
        </button>
        <button class="file-btn btn-delete-file" title="Delete ${escapeHtml(file.name)}">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="3 6 5 6 21 6"/>
            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6M14 11v6"/>
            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
          </svg>
        </button>
      </div>
    `;
    const downloadBtn = fileItem.querySelector(".btn-download-file");
    if (downloadBtn) {
      downloadBtn.addEventListener("click", () => downloadFile(file));
    }
    const deleteBtn = fileItem.querySelector(".btn-delete-file");
    if (deleteBtn) {
      deleteBtn.addEventListener("click", () => showDeleteModal(file.id, file.name));
    }
    const insertBefore = filesList.children[index];
    if (insertBefore) {
      filesList.insertBefore(fileItem, insertBefore);
    } else {
      filesList.appendChild(fileItem);
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        fileItem.classList.remove("file-item-entering");
      });
    });
  });
  let downloadAllContainer = container.querySelector(".download-all-container");
  if (!downloadAllContainer) {
    downloadAllContainer = document.createElement("div");
    downloadAllContainer.className = "download-all-container";
    downloadAllContainer.innerHTML = `
      <button class="btn btn-primary btn-download-all">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M2.99969 17.0002C2.99969 17.9302 2.99969 18.3952 3.10192 18.7767C3.37932 19.8119 4.18796 20.6206 5.22324 20.898C5.60474 21.0002 6.06972 21.0002 6.99969 21.0002L16.9997 21.0002C17.9297 21.0002 18.3947 21.0002 18.7762 20.898C19.8114 20.6206 20.6201 19.8119 20.8975 18.7767C20.9997 18.3952 20.9997 17.9302 20.9997 17.0002" />
          <path d="M16.4998 11.5002C16.4998 11.5002 13.1856 16.0002 11.9997 16.0002C10.8139 16.0002 7.49976 11.5002 7.49976 11.5002M11.9997 15.0002V3.00016" />
        </svg>
        Download All
      </button>
    `;
    container.appendChild(downloadAllContainer);
  }
  const downloadAllBtn = downloadAllContainer.querySelector(".btn-download-all");
  if (downloadAllBtn) {
    downloadAllBtn.onclick = () => downloadAllFiles(files);
  }
}
function downloadAllFiles(files) {
  files.forEach((file, index) => {
    setTimeout(() => downloadFile(file), index * 200);
  });
  showToast(`Downloading ${files.length} file(s)...`, "info");
}
function downloadFile(file) {
  const link = document.createElement("a");
  link.href = `/api/files/${file.id}/download`;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Downloading ${file.name}…`, "info");
}
function setupEventHandlers() {
  const dropZone = document.getElementById("drop-zone");
  if (!dropZone)
    return;
  setupDragAndDrop(dropZone, handleFilesDrop);
  setupFileInput("file-input", handleFilesDrop);
  createDeleteModal();
}
async function handleFilesDrop(files) {
  if (state.isUploading) {
    showToast("Already uploading — please wait.", "error");
    return;
  }
  const validationResult = validateFiles(files);
  if (!validationResult.valid) {
    validationResult.errors.forEach((error) => {
      showToast(`${error.file}: ${error.reason}`, "error");
    });
    return;
  }
  const fileArray = Array.from(files);
  state.isUploading = true;
  const transfersList = document.getElementById("transfers-list");
  if (transfersList) {
    transfersList.innerHTML = "";
  }
  try {
    const uploadState = await uploadFiles(fileArray, (us) => {
      updateUploadUI(us);
    });
    if (uploadState.errors.length === 0) {
      showToast(`${fileArray.length === 1 ? fileArray[0]?.name ?? "File" : `${fileArray.length} files`} uploaded successfully`, "success");
      await loadFileList();
    } else {
      uploadState.errors.forEach((error) => {
        showToast(error, "error");
      });
      if (uploadState.completed.some((r) => r.success)) {
        await loadFileList();
      }
    }
  } catch (error) {
    console.error("[ERR] Upload error:", error);
    showToast(error instanceof Error ? error.message : "Upload failed", "error");
  } finally {
    state.isUploading = false;
  }
}
function updateUploadUI(uploadState) {
  const progressSection = document.getElementById("upload-progress");
  const progressBar = document.getElementById("progress-bar");
  const progressPercentage = document.getElementById("progress-percentage");
  const progressSpeed = document.getElementById("progress-speed");
  const progressETA = document.getElementById("progress-eta");
  const progressFilesCount = document.getElementById("progress-files-count");
  const transfersList = document.getElementById("transfers-list");
  if (!progressSection || !transfersList)
    return;
  if (uploadState.isUploading && uploadState.progress) {
    showElement("upload-progress");
    const pct = uploadState.overallPercentage;
    if (progressBar)
      progressBar.style.width = `${pct}%`;
    if (progressPercentage)
      progressPercentage.textContent = `${pct}%`;
    if (progressSpeed)
      progressSpeed.textContent = formatSpeed(uploadState.progress.speedBps);
    if (progressETA)
      progressETA.textContent = uploadState.progress.etaSeconds > 0 ? `ETA ${formatETA(uploadState.progress.etaSeconds)}` : "";
    if (progressFilesCount && uploadState.totalFiles > 1) {
      progressFilesCount.textContent = `File ${uploadState.currentFile} of ${uploadState.totalFiles}`;
    }
    const { transferId, fileName, bytesLoaded, bytesTotal, percentage } = uploadState.progress;
    const itemId = `transfer-${transferId}`;
    let transferItem = document.getElementById(itemId);
    if (!transferItem) {
      transferItem = document.createElement("div");
      transferItem.id = itemId;
      transferItem.className = "transfer-item uploading";
      transferItem.dataset.transferId = transferId;
      transfersList.appendChild(transferItem);
    }
    const currentPct = transferItem.dataset.lastPct;
    if (currentPct !== String(percentage)) {
      transferItem.dataset.lastPct = String(percentage);
      transferItem.innerHTML = `
        <div class="transfer-header">
          <span class="transfer-name" title="${escapeHtml(fileName)}">${escapeHtml(fileName)}</span>
          <span class="transfer-status transfer-status-uploading">Uploading…</span>
        </div>
        <div class="transfer-progress-bar">
          <div class="transfer-progress-fill" style="width: ${percentage}%"></div>
        </div>
        <div class="transfer-meta">
          <span class="transfer-size">${formatFileSize2(bytesLoaded)} / ${formatFileSize2(bytesTotal)}</span>
          <span class="transfer-speed">${formatSpeed(uploadState.progress.speedBps)}</span>
        </div>
      `;
    }
  }
  if (!uploadState.isUploading) {
    hideElement("upload-progress");
    if (progressBar)
      progressBar.style.width = "0%";
    if (progressPercentage)
      progressPercentage.textContent = "0%";
    if (progressSpeed)
      progressSpeed.textContent = "";
    if (progressETA)
      progressETA.textContent = "";
    if (progressFilesCount)
      progressFilesCount.textContent = "";
    uploadState.completed.forEach((result) => {
      const itemId = `transfer-${result.transferId}`;
      let transferItem = document.getElementById(itemId);
      if (!transferItem) {
        transferItem = document.createElement("div");
        transferItem.id = itemId;
        transfersList.appendChild(transferItem);
      }
      if (result.success) {
        transferItem.className = "transfer-item completed";
        transferItem.innerHTML = `
          <div class="transfer-header">
            <span class="transfer-name" title="${escapeHtml(result.fileName ?? "")}">${escapeHtml(result.fileName ?? "Unknown")}</span>
            <span class="transfer-status transfer-status-done">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              Done
            </span>
          </div>
          <div class="transfer-meta">
            <span class="transfer-size">${formatFileSize2(result.fileSize ?? 0)}</span>
            ${(result.attempts ?? 1) > 1 ? `<span class="transfer-retries">${result.attempts} attempts</span>` : ""}
          </div>
        `;
        setTimeout(() => {
          transferItem.classList.add("transfer-item-fading");
          setTimeout(() => transferItem.remove(), 500);
        }, 6000);
      } else {
        transferItem.className = "transfer-item failed";
        transferItem.innerHTML = `
          <div class="transfer-header">
            <span class="transfer-name" title="${escapeHtml(result.fileName ?? "")}">${escapeHtml(result.fileName ?? "Unknown")}</span>
            <span class="transfer-status transfer-status-failed">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              Failed
            </span>
          </div>
          <div class="transfer-error">${escapeHtml(result.error ?? "Unknown error")}</div>
        `;
      }
    });
    setTimeout(() => {
      if (transfersList && transfersList.children.length === 0) {
        transfersList.innerHTML = `<div class="empty-message">No active transfers</div>`;
      }
    }, 7000);
  }
}
function setupTabSwitching() {
  document.querySelectorAll(".tab-button").forEach((button) => {
    button.addEventListener("click", () => {
      const tabName = button.getAttribute("data-tab");
      if (!tabName)
        return;
      document.querySelectorAll(".tab-button").forEach((b) => b.classList.remove("active"));
      button.classList.add("active");
      document.querySelectorAll(".tab-content").forEach((content) => content.classList.remove("active"));
      const tabElement = document.getElementById(`${tabName}-tab`);
      if (tabElement)
        tabElement.classList.add("active");
      state.currentTab = tabName;
      if (tabName === "receive") {
        startFileListPolling();
      } else {
        stopFileListPolling();
      }
    });
  });
}
function startFileListPolling() {
  if (state.fileListPollInterval)
    return;
  console.log("[>] Starting file list polling");
  loadFileList();
  state.fileListPollInterval = setInterval(async () => {
    try {
      const response = await fetchFileList();
      const newIds = response.files.map((f) => f.id).join(",");
      const oldIds = state.files.map((f) => f.id).join(",");
      if (newIds !== oldIds) {
        state.files = response.files;
        renderFileList(response.files);
      }
    } catch (error) {
      console.error("[ERR] Failed to poll files:", error);
    }
  }, 2500);
}
function stopFileListPolling() {
  if (state.fileListPollInterval) {
    console.log("[>] Stopping file list polling");
    clearInterval(state.fileListPollInterval);
    state.fileListPollInterval = null;
  }
}
function showToast(message, type = "info") {
  if (typeof window !== "undefined" && window.showToast) {
    window.showToast(message, type, 5000);
  }
}
window.updateFileListUI = renderFileList;
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializeApp);
} else {
  initializeApp();
}
export {
  initializeApp
};
