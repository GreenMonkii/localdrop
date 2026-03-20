import type {
  DeleteResponse,
  FilesListResponse,
  ServerInfo,
  UploadResponse,
} from "@shared/types";
import { readFile } from "fs/promises";
import type { Context } from "hono";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { join } from "path";
import type { CLIOptions } from "./cli";
import { getDebugInfo } from "./debug";
import { generateConnectionQRDataURL } from "./qr";
import { getStorage } from "./storage";

export interface RouteContext {
  port: number;
  host: string;
  ip: string;
  deviceName: string;
  options?: CLIOptions;
}

const routes = new Hono();
const storage = getStorage();
let routeContext: RouteContext = {
  port: 3000,
  host: "0.0.0.0",
  ip: "127.0.0.1",
  deviceName: "LocalDrop",
};

/**
 * Set route context for dynamic values
 */
export function setRouteContext(context: RouteContext): void {
  routeContext = context;
}

/**
 * GET /api/info
 * Returns server information (device name, IP, port, QR code)
 */
routes.get("/info", async (c: Context) => {
  try {
    let qrCode: string | null = null;

    // Generate QR code for connection URL
    try {
      qrCode = await generateConnectionQRDataURL(
        routeContext.ip,
        routeContext.port,
      );
    } catch (error) {
      console.warn("[WARN] Failed to generate QR code:", error);
      // Continue without QR code rather than failing the request
    }

    const info: ServerInfo = {
      deviceName: routeContext.deviceName,
      port: routeContext.port,
      ip: routeContext.ip,
      version: "1.0.0",
      timestamp: new Date().toISOString(),
    };

    // Return with QR code if generated successfully
    return c.json({
      ...info,
      ...(qrCode && { qrCode }),
    });
  } catch (error) {
    console.error("[ERR] Failed to fetch server info:", error);
    throw new HTTPException(500, { message: "Failed to fetch server info" });
  }
});

/**
 * POST /api/upload
 * Handles file uploads with multipart/form-data
 */
routes.post("/upload", async (c: Context) => {
  try {
    const body = await c.req.formData();

    if (!body.has("file")) {
      throw new HTTPException(400, { message: "No file provided" });
    }

    const file = body.get("file") as File;

    if (!file) {
      throw new HTTPException(400, { message: "Invalid file" });
    }

    // Save the file
    const buffer = await file.arrayBuffer();
    const fileInfo = await storage.saveFile(file.name, buffer, file.type);

    const response: UploadResponse = {
      success: true,
      fileId: fileInfo.id,
      fileName: fileInfo.name,
      fileSize: fileInfo.size,
      mimeType: fileInfo.type,
      uploadedAt: fileInfo.uploadedAt,
    };

    return c.json(response, 201);
  } catch (err) {
    if (err instanceof HTTPException) {
      throw err;
    }

    const errorMessage =
      err instanceof Error ? err.message : "File upload failed";
    console.error("[ERR] Upload error:", err);

    throw new HTTPException(400, { message: errorMessage });
  }
});

/**
 * GET /api/files
 * Lists received files
 */
routes.get("/files", (c: Context) => {
  try {
    const files = storage.getFiles();

    const response: FilesListResponse = {
      files,
      totalCount: files.length,
    };

    return c.json(response);
  } catch (error) {
    console.error("[ERR] Failed to fetch files:", error);
    throw new HTTPException(500, { message: "Failed to fetch files" });
  }
});

/**
 * GET /api/files/:id/download
 * Downloads a file by ID
 */
routes.get("/files/:id/download", async (c: Context) => {
  try {
    const fileId = c.req.param("id");

    if (!fileId) {
      throw new HTTPException(400, { message: "File ID is required" });
    }

    const fileInfo = storage.getFile(fileId);
    if (!fileInfo) {
      throw new HTTPException(404, { message: "File not found" });
    }

    const filePath = join(storage.getOutputDir(), fileInfo.name);
    const fileContent = await readFile(filePath);

    // Set appropriate headers for file download
    c.header("Content-Type", fileInfo.type || "application/octet-stream");
    c.header(
      "Content-Disposition",
      `attachment; filename="${encodeURIComponent(fileInfo.name)}"`,
    );
    c.header("Content-Length", fileContent.length.toString());

    return c.body(fileContent);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error("[ERR] Download error:", error);
    throw new HTTPException(500, { message: "Failed to download file" });
  }
});

/**
 * DELETE /api/files/:id
 * Removes a file by ID
 */
routes.delete("/files/:id", async (c: Context) => {
  try {
    const fileId = c.req.param("id");

    if (!fileId) {
      throw new HTTPException(400, { message: "File ID is required" });
    }

    const fileInfo = storage.getFile(fileId);
    if (!fileInfo) {
      throw new HTTPException(404, { message: "File not found" });
    }

    const deleted = await storage.deleteFile(fileId);

    if (!deleted) {
      throw new HTTPException(500, { message: "Failed to delete file" });
    }

    const response: DeleteResponse = {
      success: true,
      id: fileId,
      message: "File deleted successfully",
    };

    return c.json(response);
  } catch (error) {
    if (error instanceof HTTPException) {
      throw error;
    }

    console.error("[ERR] Delete error:", error);
    throw new HTTPException(500, { message: "Failed to delete file" });
  }
});

/**
 * GET /api/health
 * Health check endpoint
 */
routes.get("/health", (c: Context) => {
  return c.json({
    status: "ok",
    uptime: process.uptime(),
  });
});

/**
 * GET /api/debug
 * Network diagnostics endpoint (development mode only)
 */
routes.get("/debug", (c: Context) => {
  // Only allow in development or with explicit enable
  const isDev = process.env.NODE_ENV !== "production";

  if (!isDev && !process.env.LOCALDROP_ENABLE_DEBUG) {
    throw new HTTPException(403, {
      message: "Debug endpoint is disabled in production",
    });
  }

  if (!routeContext.options) {
    throw new HTTPException(500, {
      message: "Debug information not available",
    });
  }

  try {
    const debugInfo = getDebugInfo(routeContext.options);
    return c.json(debugInfo);
  } catch (error) {
    console.error("[ERR] Failed to get debug info:", error);
    throw new HTTPException(500, {
      message: "Failed to retrieve debug information",
    });
  }
});

export default routes;
