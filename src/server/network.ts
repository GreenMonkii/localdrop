/**
 * Network Utility Module
 * Provides functions to detect local IP address and network information
 */

import { networkInterfaces } from "os";

/**
 * Get the local IPv4 address
 * Prioritizes private IP ranges: 192.168.x.x, 10.x.x.x, 172.16-31.x.x
 * Falls back to localhost if no suitable address is found
 */
export function getLocalIP(): string {
  const interfaces = networkInterfaces();

  // Priority order for IP ranges
  const priorityRanges = [
    { start: "192.168.0.0", end: "192.168.255.255", name: "Private (192.168)" },
    { start: "10.0.0.0", end: "10.255.255.255", name: "Private (10.x)" },
    {
      start: "172.16.0.0",
      end: "172.31.255.255",
      name: "Private (172.16-31)",
    },
  ];

  const candidates: Array<{
    ip: string;
    priority: number;
    ifName: string;
  }> = [];

  // Iterate through all network interfaces
  for (const [ifName, addrs] of Object.entries(interfaces)) {
    if (!addrs || !Array.isArray(addrs)) continue;

    for (const addr of addrs) {
      // Only consider IPv4 addresses
      if (addr.family !== "IPv4") continue;

      // Skip loopback addresses
      if (addr.address.startsWith("127.")) continue;

      // Skip internal addresses (usually loopback)
      if (addr.internal) continue;

      // Check priority based on IP range
      let priority = 999; // Default low priority for other IPs
      for (let i = 0; i < priorityRanges.length; i++) {
        const range = priorityRanges[i];
        if (range && isInRange(addr.address, range.start, range.end)) {
          priority = i;
          break;
        }
      }

      candidates.push({
        ip: addr.address,
        priority,
        ifName,
      });
    }
  }

  // Sort by priority (lower number = higher priority)
  candidates.sort((a, b) => a.priority - b.priority);

  // Return the best candidate
  if (candidates.length > 0 && candidates[0]) {
    return candidates[0]!.ip;
  }

  // Fallback to localhost if no suitable address found
  return "127.0.0.1";
}

/**
 * Check if an IP address falls within a range
 */
function isInRange(ip: string, start: string, end: string): boolean {
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(start);
  const endNum = ipToNumber(end);

  return ipNum >= startNum && ipNum <= endNum;
}

/**
 * Convert IP address string to number for comparison
 */
function ipToNumber(ip: string): number {
  const parts = ip.split(".");
  return (
    (parseInt(parts[0] ?? "0", 10) || 0) * 16777216 +
    (parseInt(parts[1] ?? "0", 10) || 0) * 65536 +
    (parseInt(parts[2] ?? "0", 10) || 0) * 256 +
    (parseInt(parts[3] ?? "0", 10) || 0)
  );
}

/**
 * Get all available network interfaces info (for debugging)
 */
export function getNetworkInterfacesInfo(): Record<
  string,
  Array<{
    family: string;
    address: string;
    netmask: string;
    internal: boolean;
    mac?: string;
  }>
> {
  const interfaces = networkInterfaces();
  const info: Record<
    string,
    Array<{
      family: string;
      address: string;
      netmask: string;
      internal: boolean;
      mac?: string;
    }>
  > = {};

  for (const [ifName, addrs] of Object.entries(interfaces)) {
    if (!addrs || !Array.isArray(addrs)) continue;

    info[ifName] = addrs.map((addr) => ({
      family: addr.family,
      address: addr.address,
      netmask: addr.netmask,
      internal: addr.internal,
      mac: addr.mac,
    }));
  }

  return info;
}

/**
 * Log network information for debugging
 */
export function logNetworkInfo(verbose: boolean = false): void {
  const ip = getLocalIP();
  console.log(`[*] Local IP Address: ${ip}`);

  if (verbose) {
    const interfaces = getNetworkInterfacesInfo();
    console.log("[*] Network Interfaces:");
    for (const [ifName, addrs] of Object.entries(interfaces)) {
      if (!addrs || !Array.isArray(addrs)) continue;
      console.log(`    ${ifName}:`);
      for (const addr of addrs) {
        console.log(`      ${addr.family}: ${addr.address}`);
      }
    }
  }
}
