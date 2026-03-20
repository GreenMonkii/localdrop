/**
 * DOM Utilities Module
 * Provides helper functions for manipulating the DOM and showing/hiding UI elements
 */

/**
 * Show an element by removing hidden class or setting display
 */
export function showElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove("hidden");
    element.removeAttribute("hidden");
  }
}

/**
 * Hide an element by adding hidden class or setting display
 */
export function hideElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.add("hidden");
    element.setAttribute("hidden", "");
  }
}

/**
 * Toggle element visibility
 */
export function toggleElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    if (element.classList.contains("hidden")) {
      showElement(elementId);
    } else {
      hideElement(elementId);
    }
  }
}

/**
 * Add a file item to the file list
 */
export function addFileToList(
  listContainerId: string,
  fileId: string,
  fileName: string,
  fileSize: number,
  uploadedAt: string,
): void {
  const container = document.getElementById(listContainerId);
  if (!container) return;

  const fileItem = document.createElement("div");
  fileItem.className = "file-item";
  fileItem.id = `file-${fileId}`;

  const formattedSize = formatFileSize(fileSize);
  const formattedDate = new Date(uploadedAt).toLocaleString();

  fileItem.innerHTML = `
    <div class="file-info">
      <div class="file-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/>
          <polyline points="13 2 13 9 20 9"/>
        </svg>
      </div>
      <div class="file-details">
        <p class="file-name">${escapeHtml(fileName)}</p>
        <div class="file-meta">
          <span class="file-meta-item">${formattedSize}</span>
          <span class="file-meta-item">${formattedDate}</span>
        </div>
      </div>
    </div>
    <div class="file-actions">
      <button
        class="file-btn file-btn-delete"
        data-file-id="${fileId}"
        aria-label="Delete ${escapeHtml(fileName)}"
        title="Delete file"
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          <line x1="10" y1="11" x2="10" y2="17"/>
          <line x1="14" y1="11" x2="14" y2="17"/>
        </svg>
      </button>
    </div>
  `;

  container.appendChild(fileItem);
}

/**
 * Remove a file item from the list
 */
export function removeFileFromList(fileId: string): void {
  const fileItem = document.getElementById(`file-${fileId}`);
  if (fileItem) {
    fileItem.remove();
  }
}

/**
 * Clear all file items from a list
 */
export function clearFileList(listContainerId: string): void {
  const container = document.getElementById(listContainerId);
  if (container) {
    container.innerHTML = "";
  }
}

/**
 * Update progress bar
 */
export function updateProgressBar(
  progressBarId: string,
  percentage: number,
): void {
  const progressBar = document.getElementById(progressBarId);
  if (progressBar) {
    progressBar.style.width = `${Math.min(Math.max(percentage, 0), 100)}%`;
  }
}

/**
 * Update progress percentage text
 */
export function updateProgressPercentage(
  percentageElementId: string,
  percentage: number,
): void {
  const element = document.getElementById(percentageElementId);
  if (element) {
    element.textContent = `${Math.min(Math.max(percentage, 0), 100)}%`;
  }
}

/**
 * Update progress label/info text
 */
export function updateProgressLabel(
  labelElementId: string,
  text: string,
): void {
  const element = document.getElementById(labelElementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Show a toast notification
 */
export function showToast(
  message: string,
  type: "success" | "error" | "info" = "info",
  duration: number = 5000,
): void {
  const container = document.getElementById("upload-status");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `status-message ${type}`;

  const iconSvg = getIconSvg(type);
  toast.innerHTML = `${iconSvg}<span>${escapeHtml(message)}</span>`;

  container.appendChild(toast);

  // Auto-remove after specified duration
  if (duration > 0) {
    setTimeout(() => {
      toast.remove();
    }, duration);
  }
}

/**
 * Get SVG icon for notification type
 */
function getIconSvg(type: "success" | "error" | "info"): string {
  if (type === "success") {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
  } else if (type === "error") {
    return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
  }
  return '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
}

/**
 * Set text content of element
 */
export function setElementText(elementId: string, text: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.textContent = text;
  }
}

/**
 * Get text content of element
 */
export function getElementText(elementId: string): string {
  const element = document.getElementById(elementId);
  return element?.textContent || "";
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
 * Escape HTML special characters for safe display
 */
export function escapeHtml(text: string): string {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

/**
 * Add CSS class to element
 */
export function addClass(elementId: string, className: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.add(className);
  }
}

/**
 * Remove CSS class from element
 */
export function removeClass(elementId: string, className: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.remove(className);
  }
}

/**
 * Toggle CSS class on element
 */
export function toggleClass(elementId: string, className: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.classList.toggle(className);
  }
}

/**
 * Check if element has class
 */
export function hasClass(elementId: string, className: string): boolean {
  const element = document.getElementById(elementId);
  return element?.classList.contains(className) ?? false;
}

/**
 * Show empty state message
 */
export function showEmptyState(
  containerElementId: string,
  message: string = "No files yet",
): void {
  const container = document.getElementById(containerElementId);
  if (container) {
    container.innerHTML = `<div class="empty-message">${escapeHtml(message)}</div>`;
  }
}

/**
 * Clear element's children
 */
export function clearElement(elementId: string): void {
  const element = document.getElementById(elementId);
  if (element) {
    element.innerHTML = "";
  }
}
