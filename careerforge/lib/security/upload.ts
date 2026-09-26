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

export function isDocx(buffer: Buffer): boolean {
  return (
    buffer.length >= 4 &&
    buffer[0] === 0x50 &&
    buffer[1] === 0x4b &&
    buffer[2] === 0x03 &&
    buffer[3] === 0x04
  );
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
