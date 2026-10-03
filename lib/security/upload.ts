/**
 * CareerForge Upload Security Utilities
 * Enforces file size, magic byte verification, executable detection,
 * and filename sanitization to prevent path traversal and arbitrary file upload.
 */

const DANGEROUS_SIGNATURES = [
  Buffer.from([0x4d, 0x5a]), // DOS MZ / PE (exe, dll, sys)
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // Linux ELF
  Buffer.from([0xca, 0xfe, 0xba, 0xbe]), // Mach-O / Java class
  Buffer.from([0xfe, 0xed, 0xfa, 0xce]), // Mach-O 32-bit
  Buffer.from([0xfe, 0xed, 0xfa, 0xcf]), // Mach-O 64-bit
];

export function isExecutable(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 2) return false;
  return DANGEROUS_SIGNATURES.some((sig) => {
    if (buffer.length < sig.length) return false;
    return buffer.subarray(0, sig.length).equals(sig);
  });
}

export function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

export const MAX_RESUME_TEXT_LENGTH = 64 * 1024; // 64 KB canonical limit
export const MAX_PDF_PAGES = 15; // 15 pages max
export const MAX_ZIP_ENTRIES = 300; // max entry count in DOCX archive
export const MAX_ZIP_UNCOMPRESSED_BYTES = 30 * 1024 * 1024; // 30 MB max uncompressed
export const MAX_ZIP_COMPRESSION_RATIO = 100; // 100:1 max ratio

export interface ZipSafetyResult {
  safe: boolean;
  error?: string;
}

export function isDocx(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
}

/**
 * Validates in-memory ZIP / DOCX structure against decompression bombs,
 * pathological compression ratios, excessive entries, and malformed central directories.
 * Operates purely in-memory with zero disk extraction.
 */
export function validateZipSafety(buffer: Buffer): ZipSafetyResult {
  if (!buffer || buffer.length < 22) {
    return { safe: false, error: "File is too small to be a valid ZIP archive." };
  }

  // Confirm ZIP local file header signature PK\x03\x04
  if (
    buffer[0] !== 0x50 ||
    buffer[1] !== 0x4b ||
    buffer[2] !== 0x03 ||
    buffer[3] !== 0x04
  ) {
    return { safe: false, error: "Invalid ZIP/DOCX file signature." };
  }

  // Locate End of Central Directory (EOCD) record (signature: PK\x05\x06 -> 0x06054b50)
  // EOCD is at least 22 bytes long, with a comment field up to 65535 bytes.
  let eocdOffset = -1;
  const maxSearch = Math.min(buffer.length, 65557);
  const searchStart = buffer.length - maxSearch;
  for (let i = buffer.length - 22; i >= searchStart; i--) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    return {
      safe: false,
      error: "Corrupted ZIP archive: Missing End of Central Directory record.",
    };
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const cdSize = buffer.readUInt32LE(eocdOffset + 12);
  const cdOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (totalEntries > MAX_ZIP_ENTRIES) {
    return {
      safe: false,
      error: `ZIP entry count (${totalEntries}) exceeds safety ceiling (${MAX_ZIP_ENTRIES}).`,
    };
  }

  if (cdOffset + cdSize > buffer.length) {
    return {
      safe: false,
      error: "Corrupted ZIP archive: Central directory boundaries exceed file size.",
    };
  }

  let offset = cdOffset;
  let totalUncompressedSize = 0;
  let entriesInspected = 0;

  while (offset + 46 <= cdOffset + cdSize && entriesInspected < totalEntries) {
    // Confirm central directory entry header signature PK\x01\x02
    if (
      buffer[offset] !== 0x50 ||
      buffer[offset + 1] !== 0x4b ||
      buffer[offset + 2] !== 0x01 ||
      buffer[offset + 3] !== 0x02
    ) {
      return {
        safe: false,
        error: "Corrupted ZIP archive: Invalid central directory entry header.",
      };
    }

    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const nameLen = buffer.readUInt16LE(offset + 28);
    const extraLen = buffer.readUInt16LE(offset + 30);
    const commentLen = buffer.readUInt16LE(offset + 32);

    totalUncompressedSize += uncompressedSize;

    if (totalUncompressedSize > MAX_ZIP_UNCOMPRESSED_BYTES) {
      return {
        safe: false,
        error: `Total uncompressed size exceeds maximum safety limit (${MAX_ZIP_UNCOMPRESSED_BYTES / (1024 * 1024)} MB).`,
      };
    }

    // Pathological compression ratio check (e.g. zip bomb targeting memory exhaustion)
    if (compressedSize > 0 && uncompressedSize > 1024 * 1024) {
      const ratio = uncompressedSize / compressedSize;
      if (ratio > MAX_ZIP_COMPRESSION_RATIO) {
        return {
          safe: false,
          error: `Pathological compression ratio (${Math.round(ratio)}:1) detected.`,
        };
      }
    }

    offset += 46 + nameLen + extraLen + commentLen;
    entriesInspected++;
  }

  if (entriesInspected !== totalEntries) {
    return {
      safe: false,
      error: "Corrupted ZIP archive: Central directory entry count mismatch.",
    };
  }

  return { safe: true };
}

export function isValidAudioContainer(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;
  if (isExecutable(buffer)) return false;

  // 1. WebM / Matroska container
  if (
    buffer[0] === 0x1a &&
    buffer[1] === 0x45 &&
    buffer[2] === 0xdf &&
    buffer[3] === 0xa3
  ) {
    return true;
  }

  // 2. WAV (RIFF ... WAVE)
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WAVE"
  ) {
    return true;
  }

  // 3. Ogg (OggS)
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return true;
  }

  // 4. MP3 (ID3 or MPEG Audio Frame Sync)
  if (
    buffer.subarray(0, 3).toString("ascii") === "ID3" ||
    (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)
  ) {
    return true;
  }

  // 5. AAC / M4A (ftyp box)
  if (buffer.length >= 8 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return true;
  }

  // 6. FLAC (fLaC)
  if (buffer.subarray(0, 4).toString("ascii") === "fLaC") {
    return true;
  }

  return false;
}

export function detectAudioMime(buffer: Buffer): string | null {
  if (!buffer || buffer.length < 4) return null;
  if (buffer[0] === 0x1a && buffer[1] === 0x45 && buffer[2] === 0xdf && buffer[3] === 0xa3) {
    return "audio/webm";
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WAVE") {
    return "audio/wav";
  }
  if (buffer.subarray(0, 4).toString("ascii") === "OggS") {
    return "audio/ogg";
  }
  if (buffer.subarray(0, 3).toString("ascii") === "ID3" || (buffer[0] === 0xff && (buffer[1] & 0xe0) === 0xe0)) {
    return "audio/mpeg";
  }
  if (buffer.length >= 8 && buffer.subarray(4, 8).toString("ascii") === "ftyp") {
    return "audio/mp4";
  }
  if (buffer.subarray(0, 4).toString("ascii") === "fLaC") {
    return "audio/flac";
  }
  return null;
}

export function sanitizeFilename(rawName: string | null | undefined): string {
  if (!rawName || typeof rawName !== "string") return "resume.txt";
  // Normalize both forward and back slashes
  const normalized = rawName.replace(/\\/g, "/");
  // Take only the final path segment to neutralize directory traversal
  const segments = normalized.split("/").filter(Boolean);
  const base = segments[segments.length - 1] || "resume.txt";
  
  // Strip control chars, null bytes, remove leading dots, replace illegal characters
  const clean = base
    .replace(/[\r\n\0\t]/g, "")
    .replace(/^\.+/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .slice(0, 100);

  return clean || "resume.txt";
}
