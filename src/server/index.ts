import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { HTTPException } from "hono/http-exception";
import { serveStatic } from "hono/bun";
import routes, { setRouteContext } from "./routes";
import { getOptions, displayStartupInfo } from "./cli";
import { getStorage } from "./storage";
import { getLocalIP, logNetworkInfo } from "./network";
import { logNetworkDiagnostics } from "./debug";

// Parse CLI options
const options = getOptions();

if (options.help) {
  process.exit(0);
}

// Initialize storage with output directory
getStorage(options.outputDir);

// Detect local IP address
const localIP = getLocalIP();

// Log network info and diagnostics
if (options.verbose) {
  logNetworkInfo(true);
  logNetworkDiagnostics(options);
} else {
  logNetworkInfo(false);
}

// Set route context for API responses
setRouteContext({
  port: options.port,
  host: options.host,
  ip: localIP,
  deviceName: options.deviceName,
  options: options,
});

// Environment
const isDev = process.env.NODE_ENV !== "production";

// Create Hono app
const app = new Hono();

// Middleware Stack
// Logger middleware
app.use(logger());

// CORS middleware
app.use(
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowHeaders: ["Content-Type", "Authorization"],
    maxAge: 600,
  }),
);

// Error handling middleware
app.onError((err, c) => {
  if (options.verbose) {
    console.error("[ERR]", err);
  }

  if (err instanceof HTTPException) {
    return err.getResponse();
  }

  const statusCode = (err as any).status || 500;
  const message = isDev
    ? err instanceof Error
      ? err.message
      : "Unknown error"
    : "Internal Server Error";

  return c.json(
    {
      error: {
        message,
        ...(isDev &&
          options.verbose &&
          err instanceof Error && { stack: err.stack }),
      },
    },
    statusCode,
  );
});

// Register API routes first (before static file serving)
app.route("/api", routes);

// Cache control middleware - set headers before static serving
app.use("*", async (c, next) => {
  const pathname = new URL(c.req.url).pathname;

  // Font files: cache for 1 year (immutable)
  if (pathname.match(/\.(woff2|ttf|otf|eot)$/)) {
    c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  // JS: cache for 1 year in production only (assuming built/hashed filenames)
  else if (!isDev && pathname.match(/\.js$/) && !pathname.includes("index")) {
    c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  // CSS: cache for 1 year in production only
  else if (!isDev && pathname.endsWith(".css")) {
    c.res.headers.set("Cache-Control", "public, max-age=31536000, immutable");
  }
  // HTML: never cache (always revalidate)
  else if (pathname.endsWith(".html") || pathname === "/") {
    c.res.headers.set("Cache-Control", "public, max-age=0, must-revalidate");
  }

  await next();
});

// Static file serving with proper cache headers
app.use(
  "*",
  serveStatic({
    root: "./public",
    rewriteRequestPath: (path: string) => (path === "/" ? "/index.html" : path),
  }),
);

// SPA fallback - serve index.html for all non-API, non-static routes
app.get("*", async (c) => {
  try {
    const file = Bun.file("./public/index.html");
    const html = await file.text();
    return c.html(html);
  } catch (error) {
    if (options.verbose) {
      console.error("[ERR] Failed to serve index.html:", error);
    }
    const errorFile = Bun.file("./public/error.html");
    const errorHtml = await errorFile.text();
    return c.html(errorHtml, 500);
  }
});

// Handle shutdown signals for graceful shutdown
process.on("SIGINT", () => {
  console.log("[*] Shutting down gracefully...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("[*] Shutting down gracefully...");
  process.exit(0);
});

// Display startup information
displayStartupInfo(options);

// Export as default for Bun.serve
export default {
  port: options.port,
  hostname: options.host,
  fetch: app.fetch,
};
