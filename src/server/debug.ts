/**
 * Network Diagnostics Debug Module
 * Provides network information for troubleshooting and diagnostics
 */

import { getNetworkInterfacesInfo, getLocalIP } from "./network";
import type { CLIOptions } from "./cli";

export interface NetworkDiagnostics {
  detectedIP: string;
  allInterfaces: Record<
    string,
    Array<{
      family: string;
      address: string;
      netmask: string;
      internal: boolean;
      mac?: string;
    }>
  >;
  warnings: string[];
  recommendations: string[];
}

/**
 * Get comprehensive network diagnostics
 */
export function getNetworkDiagnostics(): NetworkDiagnostics {
  const detectedIP = getLocalIP();
  const allInterfaces = getNetworkInterfacesInfo();
  const warnings: string[] = [];
  const recommendations: string[] = [];

  // Check for IPv4 connectivity
  const hasIPv4 = Object.values(allInterfaces).some((addrs) =>
    addrs.some((addr) => addr.family === "IPv4" && !addr.internal),
  );

  if (!hasIPv4) {
    warnings.push(
      "No IPv4 network interfaces detected. The server may not be accessible.",
    );
    recommendations.push(
      "Check your network connection and ensure you have an active IPv4 network interface.",
    );
  }

  // Check if using localhost
  if (detectedIP === "127.0.0.1") {
    warnings.push(
      "Using localhost (127.0.0.1). Other devices may not be able to connect.",
    );
    recommendations.push(
      "Ensure you have an active network connection and a valid IPv4 address.",
    );
  }

  // Check for VPN indication
  const interfaceNames = Object.keys(allInterfaces).join(", ").toLowerCase();
  if (
    interfaceNames.includes("tun") ||
    interfaceNames.includes("tap") ||
    interfaceNames.includes("vpn")
  ) {
    warnings.push(
      "VPN interface detected. Your actual IP may differ from detected IP.",
    );
    recommendations.push(
      "Verify that other devices can reach the IP address shown above.",
    );
  }

  // Check for multiple interfaces
  const activeInterfaces = Object.entries(allInterfaces).filter(([, addrs]) =>
    addrs.some((addr) => addr.family === "IPv4" && !addr.internal),
  );

  if (activeInterfaces.length > 1) {
    recommendations.push(
      `Multiple active network interfaces detected: ${activeInterfaces.map(([name]) => name).join(", ")}. The highest priority interface was selected.`,
    );
  }

  return {
    detectedIP,
    allInterfaces,
    warnings,
    recommendations,
  };
}

/**
 * Log network diagnostics to console
 */
export function logNetworkDiagnostics(options?: CLIOptions): void {
  const diagnostics = getNetworkDiagnostics();

  console.log("\n[*] Network Diagnostics");
  console.log(`[>] Detected IP: ${diagnostics.detectedIP}`);

  console.log("\n[*] Network Interfaces:");
  for (const [ifName, addrs] of Object.entries(diagnostics.allInterfaces)) {
    console.log(`    ${ifName}:`);
    for (const addr of addrs) {
      const status = addr.internal ? "(loopback)" : "";
      console.log(`      ${addr.family}: ${addr.address} ${status}`);
      if (addr.netmask) {
        console.log(`        Netmask: ${addr.netmask}`);
      }
      if (addr.mac) {
        console.log(`        MAC: ${addr.mac}`);
      }
    }
  }

  if (diagnostics.warnings.length > 0) {
    console.log("\n[!] Warnings:");
    diagnostics.warnings.forEach((warning) => {
      console.log(`    - ${warning}`);
    });
  }

  if (diagnostics.recommendations.length > 0) {
    console.log("\n[*] Recommendations:");
    diagnostics.recommendations.forEach((rec) => {
      console.log(`    - ${rec}`);
    });
  }

  if (options) {
    console.log("\n[*] Connection Info:");
    console.log(`    Device Name: ${options.deviceName}`);
    console.log(`    URL: http://${diagnostics.detectedIP}:${options.port}`);
    console.log(
      `    mDNS URL: http://${options.deviceName.toLowerCase().replace(/\s+/g, "-")}.local:${options.port}`,
    );
  }

  console.log();
}

/**
 * Get debug information object for API response
 */
export function getDebugInfo(options: CLIOptions): {
  diagnostics: NetworkDiagnostics;
  config: {
    port: number;
    host: string;
    deviceName: string;
  };
  environment: {
    platform: string;
    nodeVersion: string;
    uptime: number;
  };
} {
  return {
    diagnostics: getNetworkDiagnostics(),
    config: {
      port: options.port,
      host: options.host,
      deviceName: options.deviceName,
    },
    environment: {
      platform: process.platform,
      nodeVersion: process.version,
      uptime: process.uptime(),
    },
  };
}
