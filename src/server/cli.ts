import { homedir, tmpdir } from "os";
import { resolve } from "path";

export interface CLIOptions {
  port: number;
  host: string;
  outputDir: string;
  deviceName: string;
  open: boolean;
  verbose: boolean;
  help: boolean;
}

const DEFAULT_OPTIONS: CLIOptions = {
  port: 3000,
  host: "0.0.0.0",
  outputDir: resolve(tmpdir(), "localdrop"),
  deviceName: "LocalDrop",
  open: false,
  verbose: false,
  help: false,
};

/**
 * Parse command line arguments
 */
export function parseArgs(args: string[]): CLIOptions {
  const options: CLIOptions = { ...DEFAULT_OPTIONS };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;

    switch (arg) {
      case "--port":
      case "-p":
        i++;
        if (i < args.length) {
          const nextArg = args[i];
          if (!nextArg) throw new Error("[ERR] Port argument requires a value");
          const port = parseInt(nextArg, 10);
          if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error(`[ERR] Invalid port number: ${nextArg}`);
          }
          options.port = port;
        }
        break;

      case "--host":
      case "-h":
        i++;
        if (i < args.length) {
          const nextArg = args[i];
          if (!nextArg) throw new Error("[ERR] Host argument requires a value");
          options.host = nextArg;
        } else {
          throw new Error("[ERR] Host argument requires a value");
        }
        break;

      case "--output-dir":
      case "-o":
        i++;
        if (i < args.length) {
          const nextArg = args[i];
          if (!nextArg)
            throw new Error("[ERR] Output directory argument requires a value");
          options.outputDir = resolve(nextArg);
        } else {
          throw new Error("[ERR] Output directory argument requires a value");
        }
        break;

      case "--temp":
      case "-t":
        options.outputDir = resolve(tmpdir(), "localdrop");
        break;

      case "--open":
        options.open = true;
        break;

      case "--verbose":
      case "-v":
        options.verbose = true;
        break;

      case "--device-name":
      case "-d":
        i++;
        if (i < args.length) {
          const nextArg = args[i];
          if (!nextArg)
            throw new Error("[ERR] Device name argument requires a value");
          options.deviceName = nextArg;
        } else {
          throw new Error("[ERR] Device name argument requires a value");
        }
        break;

      case "--help":
        options.help = true;
        break;

      default:
        if (arg.startsWith("-")) {
          throw new Error(`[ERR] Unknown option: ${arg}`);
        }
        break;
    }
  }

  return options;
}

/**
 * Display help text
 */
export function showHelp(): void {
  console.log(`
LocalDrop - Easy File Sharing Over Local Network

[USAGE]
  localdrop [options]

[OPTIONS]
  -p, --port <number>          Port to listen on (default: 3000)
  -h, --host <address>         Host address to bind to (default: 0.0.0.0)
  -o, --output-dir <path>      Directory to save received files (default: system temp dir)
  -d, --device-name <name>     Friendly device name (default: LocalDrop)
  -t, --temp                    Use system temp directory (default)
  --open                        Automatically open browser on startup
  -v, --verbose                 Enable verbose logging
  --help                        Display this help message

[EXAMPLES]
  localdrop
  localdrop --port 8080
  localdrop --output-dir ./downloads --open
  localdrop -p 3001 -o /tmp/uploads -v
  localdrop --device-name "My Computer"
  localdrop --temp

[ENVIRONMENT VARIABLES]
  PORT                          Override default port
  LOCALDROP_OUTPUT_DIR          Override default output directory
  LOCALDROP_DEVICE_NAME         Override device name
`);
}

/**
 * Validate CLI options
 */
export function validateOptions(options: CLIOptions): string[] {
  const errors: string[] = [];

  if (options.port < 1 || options.port > 65535) {
    errors.push("[ERR] Port must be between 1 and 65535");
  }

  if (!options.host) {
    errors.push("[ERR] Host cannot be empty");
  }

  if (!options.outputDir) {
    errors.push("[ERR] Output directory cannot be empty");
  }

  return errors;
}

/**
 * Get CLI options with environment variable overrides
 */
export function getOptions(): CLIOptions {
  const args = process.argv.slice(2);
  let options = parseArgs(args);

  // Override with environment variables
  if (process.env.PORT) {
    options.port = parseInt(process.env.PORT, 10);
  }

  if (process.env.LOCALDROP_OUTPUT_DIR) {
    options.outputDir = process.env.LOCALDROP_OUTPUT_DIR;
  }

  if (process.env.LOCALDROP_HOST) {
    options.host = process.env.LOCALDROP_HOST;
  }

  if (process.env.LOCALDROP_VERBOSE === "true") {
    options.verbose = true;
  }

  if (process.env.LOCALDROP_DEVICE_NAME) {
    options.deviceName = process.env.LOCALDROP_DEVICE_NAME;
  }

  // Validate options
  const errors = validateOptions(options);
  if (errors.length > 0) {
    errors.forEach((error) => console.error(error));
    process.exit(1);
  }

  return options;
}

/**
 * Display server startup information
 */
export function displayStartupInfo(options: CLIOptions): void {
  console.log("[*] LocalDrop Started");
  console.log(`[>] Device Name: ${options.deviceName}`);
  console.log(`[>] Port: ${options.port}`);
  console.log(`[>] Host: ${options.host}`);
  console.log(`[>] Output Directory: ${options.outputDir}`);
  console.log(`[>] URL: http://localhost:${options.port}`);

  if (options.verbose) {
    console.log("[*] Verbose logging enabled");
  }
}
