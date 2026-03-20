/**
 * QR Code Utility Module
 * Provides functions to generate QR codes for connection URLs
 */

import QRCode from "qrcode";

/**
 * Generate QR code as data URL
 * @param url - The URL to encode in the QR code
 * @param format - Output format ('data-url', 'svg', 'png')
 * @returns Promise resolving to QR code data
 */
export async function generateQRCode(
  url: string,
  format: "data-url" | "svg" | "png" = "data-url",
): Promise<string> {
  try {
    if (format === "data-url") {
      return await QRCode.toDataURL(url, {
        errorCorrectionLevel: "H",
        width: 800,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } else if (format === "svg") {
      return await QRCode.toString(url, {
        type: "svg",
        errorCorrectionLevel: "H",
        width: 800,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
    } else if (format === "png") {
      const buffer = await QRCode.toBuffer(url, {
        errorCorrectionLevel: "H",
        width: 800,
        margin: 1,
        color: {
          dark: "#000000",
          light: "#ffffff",
        },
      });
      return buffer.toString("base64");
    }

    throw new Error(`Unsupported QR code format: ${format}`);
  } catch (error) {
    console.error("[ERR] Failed to generate QR code:", error);
    throw new Error(
      `QR code generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }
}

/**
 * Generate connection URL from host, port, and protocol
 * @param ip - Local IP address
 * @param port - Server port
 * @param protocol - Protocol (http or https)
 * @returns Full connection URL
 */
export function generateConnectionURL(
  ip: string,
  port: number,
  protocol: string = "http",
): string {
  return `${protocol}://${ip}:${port}`;
}

/**
 * Generate QR code for server connection
 * @param ip - Local IP address
 * @param port - Server port
 * @param format - Output format for QR code
 * @returns Promise resolving to QR code data URL
 */
export async function generateConnectionQR(
  ip: string,
  port: number,
  format: "data-url" | "svg" | "png" = "data-url",
): Promise<string> {
  const url = generateConnectionURL(ip, port);
  return generateQRCode(url, format);
}

/**
 * Generate QR code as SVG string for embedding
 * @param ip - Local IP address
 * @param port - Server port
 * @returns Promise resolving to SVG string
 */
export async function generateConnectionQRSVG(
  ip: string,
  port: number,
): Promise<string> {
  return generateConnectionQR(ip, port, "svg");
}

/**
 * Generate QR code as data URL for img src
 * @param ip - Local IP address
 * @param port - Server port
 * @returns Promise resolving to data URL
 */
export async function generateConnectionQRDataURL(
  ip: string,
  port: number,
): Promise<string> {
  return generateConnectionQR(ip, port, "data-url");
}
