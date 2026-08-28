// Type declarations for packages without official @types
declare module "pdf-parse" {
  interface PdfData {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }
  function pdfParse(
    dataBuffer: Buffer,
    options?: Record<string, unknown>
  ): Promise<PdfData>;
  export = pdfParse;
}

declare module "mammoth" {
  interface ExtractResult {
    value: string;
    messages: unknown[];
  }
  function extractRawText(options: {
    buffer?: Buffer;
    path?: string;
  }): Promise<ExtractResult>;
}
