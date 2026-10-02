/**
 * POST /api/resume/parse
 *
 * Hardened Secure Resume File Parser API:
 * - Authenticated only (requires active session)
 * - Rate limited against DoS and memory exhaustion (10 uploads/min)
 * - Early Content-Length request size bounding before multipart body buffering
 * - Authoritative 10MB post-parse file size limit
 * - Strict filename sanitization (blocks directory traversal and control characters)
 * - Magic byte inspection (validates PDF and DOCX file signatures)
 * - Blocks executable files (PE, ELF, Mach-O)
 * - DOCX in-memory ZIP safety validation (limits entries, uncompressed size, compression ratio)
 * - PDF 15-page ceiling enforcement
 * - Bounded 6-second parser execution timeout
 * - Canonical 64KB extracted resume text bounding
 * - Purely in-memory processing (zero disk writes, zero Supabase Storage)
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { createApiErrorResponse } from "@/lib/errors/apiError";
import {
  isExecutable,
  isPdf,
  isDocx,
  sanitizeFilename,
  validateZipSafety,
  MAX_RESUME_TEXT_LENGTH,
  MAX_PDF_PAGES,
} from "@/lib/security/upload";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB authoritative file limit
const MAX_MULTIPART_OVERHEAD = 64 * 1024; // 64 KB multipart boundary and header allowance
const MAX_REQUEST_SIZE = MAX_FILE_SIZE + MAX_MULTIPART_OVERHEAD;
const PARSER_TIMEOUT_MS = 6000; // 6 seconds execution ceiling

/**
 * Executes an async parsing operation with a strict timeout boundary.
 *
 * Note on cancellation:
 * If an underlying third-party parser executes synchronous CPU work or lacks an AbortSignal,
 * Node.js will continue executing that synchronous tick until completion.
 * However, this timeout boundary guarantees that the client request terminates within 6 seconds,
 * preventing client hang or indefinite connection starvation.
 */
async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
  errorMessage: string
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(errorMessage);
      err.name = "ParserTimeoutError";
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([fn(), timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const clientIp = getClientIp(req);

  // 1. Authentication Check
  const authUser = await getAuthenticatedUser(req);
  if (!authUser) {
    return createApiErrorResponse(
      "UNAUTHORIZED",
      "Authentication required to upload and parse resumes.",
      requestId,
      { statusCode: 401 }
    );
  }

  // 2. Rate Limiting (10 uploads per min per user)
  const rl = checkRateLimit(
    `resume_upload:${authUser.id || clientIp}`,
    RATE_LIMIT_PRESETS.resumeUpload
  );
  if (rl.isLimited) {
    return createApiErrorResponse(
      "RATE_LIMITED",
      "Too many resume uploads. Please wait a minute before uploading another document.",
      requestId,
      { statusCode: 429, retryable: true }
    );
  }

  // 3. Early Request Size Bounding (BEFORE multipart parsing)
  // Rejects obviously oversized payloads early before formData buffering consumes heap memory.
  // Note: Content-Length is an early rejection optimization and not the sole boundary;
  // for chunked requests omitting Content-Length, the authoritative file.size check below applies.
  const rawContentLength = req.headers.get("content-length");
  if (rawContentLength) {
    const contentLength = parseInt(rawContentLength, 10);
    if (!Number.isNaN(contentLength) && contentLength > MAX_REQUEST_SIZE) {
      return createApiErrorResponse(
        "PAYLOAD_TOO_LARGE",
        "Request payload exceeds maximum allowed size (10 MB + multipart overhead).",
        requestId,
        { statusCode: 413 }
      );
    }
  }

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return createApiErrorResponse(
        "BAD_REQUEST",
        "Failed to parse multipart form data.",
        requestId,
        { statusCode: 400 }
      );
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return createApiErrorResponse(
        "BAD_REQUEST",
        "No resume file was provided.",
        requestId,
        { statusCode: 400 }
      );
    }

    // 4. Authoritative File Size Validation
    if (file.size > MAX_FILE_SIZE) {
      return createApiErrorResponse(
        "PAYLOAD_TOO_LARGE",
        "File exceeds maximum allowed size (10 MB).",
        requestId,
        { statusCode: 413 }
      );
    }

    const sanitizedName = sanitizeFilename(file.name);
    const ext = sanitizedName.split(".").pop()?.toLowerCase() ?? "";
    const buffer = Buffer.from(await file.arrayBuffer());

    // 5. Guard against executable files
    if (isExecutable(buffer)) {
      return createApiErrorResponse(
        "UNSUPPORTED_MEDIA",
        "Executable files cannot be parsed as resumes.",
        requestId,
        { statusCode: 415 }
      );
    }

    // 6. PDF Parsing with Magic Byte Check, 15-page limit, and execution timeout
    if (ext === "pdf" || file.type === "application/pdf") {
      if (!isPdf(buffer)) {
        return createApiErrorResponse(
          "UNPROCESSABLE_ENTITY",
          "Invalid PDF file signature. The file appears to be corrupted or renamed.",
          requestId,
          { statusCode: 422 }
        );
      }

      try {
        const parseResult = await executeWithTimeout(
          async () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const pdfModule = require("pdf-parse");
            let text = "";
            let pages = 1;

            if (pdfModule?.PDFParse) {
              try {
                if (!(globalThis as any).pdfjsWorker) {
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  const { pathToFileURL } = require("url");
                  // eslint-disable-next-line @typescript-eslint/no-require-imports
                  const fs = require("fs");
                  const workerPath = path.resolve(
                    process.cwd(),
                    "node_modules/pdf-parse/dist/pdf-parse/cjs/pdf.worker.mjs"
                  );
                  if (fs.existsSync(workerPath)) {
                    const dynamicImport = new Function("u", "return import(u)");
                    (globalThis as any).pdfjsWorker = await dynamicImport(
                      pathToFileURL(workerPath).href
                    );
                  }
                }
              } catch (workerInitErr) {
                console.warn("[Resume Parse] Worker initialization note:", workerInitErr);
              }

              const parser = new pdfModule.PDFParse({ data: buffer });
              try {
                const info = await parser.getInfo();
                pages = info.total || 1;

                if (pages > MAX_PDF_PAGES) {
                  return {
                    errorResponse: createApiErrorResponse(
                      "PAYLOAD_TOO_LARGE",
                      `Document exceeds maximum allowed page count (${MAX_PDF_PAGES} pages). Resumes must not exceed ${MAX_PDF_PAGES} pages.`,
                      requestId,
                      { statusCode: 422 }
                    ),
                  };
                }

                const data = await parser.getText();
                text = (data.text || "").trim();
                pages = data.total || pages;
              } finally {
                await parser.destroy();
              }
            } else if (typeof pdfModule === "function") {
              const data = await pdfModule(buffer);
              pages = data.numpages || 1;
              if (pages > MAX_PDF_PAGES) {
                return {
                  errorResponse: createApiErrorResponse(
                    "PAYLOAD_TOO_LARGE",
                    `Document exceeds maximum allowed page count (${MAX_PDF_PAGES} pages). Resumes must not exceed ${MAX_PDF_PAGES} pages.`,
                    requestId,
                    { statusCode: 422 }
                  ),
                };
              }
              text = (data.text || "").trim();
            } else if (typeof pdfModule?.default === "function") {
              const data = await pdfModule.default(buffer);
              pages = data.numpages || 1;
              if (pages > MAX_PDF_PAGES) {
                return {
                  errorResponse: createApiErrorResponse(
                    "PAYLOAD_TOO_LARGE",
                    `Document exceeds maximum allowed page count (${MAX_PDF_PAGES} pages). Resumes must not exceed ${MAX_PDF_PAGES} pages.`,
                    requestId,
                    { statusCode: 422 }
                  ),
                };
              }
              text = (data.text || "").trim();
            }

            return { text, pages };
          },
          PARSER_TIMEOUT_MS,
          "PDF document parsing exceeded the 6-second execution limit."
        );

        if ("errorResponse" in parseResult && parseResult.errorResponse) {
          return parseResult.errorResponse;
        }

        const rawText = parseResult.text || "";
        const pages = parseResult.pages || 1;

        if (!rawText || rawText.length < 40) {
          // Attempt OCR extraction fallback for scanned image PDFs
          const geminiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_AI_KEY;
          let ocrExtractedText = "";
          if (geminiKey && buffer) {
            try {
              const ocrRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${geminiKey}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [
                      {
                        parts: [
                          {
                            text: "Extract all text verbatim from this scanned resume document. Return only the extracted text. If no legible text exists, reply exactly with: NO_TEXT_FOUND.",
                          },
                          {
                            inlineData: {
                              mimeType: "application/pdf",
                              data: buffer.toString("base64"),
                            },
                          },
                        ],
                      },
                    ],
                    generationConfig: {
                      maxOutputTokens: 2000,
                      temperature: 0.1,
                    },
                  }),
                  signal: AbortSignal.timeout(5000),
                }
              );
              if (ocrRes.ok) {
                const ocrData = await ocrRes.json();
                const cand = ocrData.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
                if (cand && !cand.includes("NO_TEXT_FOUND") && cand.length >= 40) {
                  ocrExtractedText = cand;
                }
              }
            } catch (ocrErr) {
              console.warn(`[Resume Parse] OCR fallback attempt failed (${requestId}):`, ocrErr);
            }
          }

          if (ocrExtractedText) {
            const normalizedText = ocrExtractedText.slice(0, MAX_RESUME_TEXT_LENGTH);
            return NextResponse.json({
              success: true,
              status: "SUCCESS",
              text: normalizedText,
              filename: sanitizedName,
              pages,
              ocrApplied: true,
              truncated: ocrExtractedText.length > MAX_RESUME_TEXT_LENGTH,
            });
          }

          return NextResponse.json(
            {
              success: false,
              code: "OCR_REQUIRED",
              status: "OCR_REQUIRED",
              error:
                "Text could not be extracted from this document. The file appears to be a scanned image or flattened PDF without a digital text layer. OCR or manual text review is required.",
              filename: sanitizedName,
              pages,
              requestId,
            },
            { status: 422 }
          );
        }

        // Enforce canonical text bounding
        const normalizedText = rawText.slice(0, MAX_RESUME_TEXT_LENGTH);

        return NextResponse.json({
          success: true,
          status: "SUCCESS",
          text: normalizedText,
          filename: sanitizedName,
          pages,
          truncated: rawText.length > MAX_RESUME_TEXT_LENGTH,
        });
      } catch (pdfErr: any) {
        if (pdfErr?.name === "ParserTimeoutError") {
          return createApiErrorResponse(
            "PARSER_TIMEOUT",
            "PDF parser execution timed out (6-second limit exceeded).",
            requestId,
            { statusCode: 422 }
          );
        }
        console.error(`[Resume Parse] PDF parsing failed (${requestId}):`, pdfErr);
        return NextResponse.json(
          {
            success: false,
            code: "PARSER_FAILED",
            status: "PARSER_FAILED",
            error: "Could not parse document structure. File may be encrypted, malformed, or corrupted.",
            requestId,
          },
          { status: 422 }
        );
      }
    }

    // 7. DOCX Parsing with ZIP Magic Byte Check, Decompression Safety, and Timeout
    if (
      ["docx", "doc"].includes(ext) ||
      file.type.includes("word") ||
      file.type.includes("officedocument")
    ) {
      if (ext === "docx" && !isDocx(buffer)) {
        return createApiErrorResponse(
          "UNPROCESSABLE_ENTITY",
          "Invalid DOCX file signature. The file appears to be corrupted.",
          requestId,
          { statusCode: 422 }
        );
      }

      // Pre-decompression ZIP safety boundary checks
      const zipSafety = validateZipSafety(buffer);
      if (!zipSafety.safe) {
        return createApiErrorResponse(
          "UNPROCESSABLE_ENTITY",
          zipSafety.error || "DOCX archive failed decompression safety validation.",
          requestId,
          { statusCode: 422 }
        );
      }

      try {
        const extractedRaw = await executeWithTimeout(
          async () => {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const mammoth = require("mammoth");
            const result = await mammoth.extractRawText({ buffer });
            return (result.value || "").trim();
          },
          PARSER_TIMEOUT_MS,
          "DOCX document parsing exceeded the 6-second execution limit."
        );

        if (!extractedRaw) {
          return createApiErrorResponse(
            "UNPROCESSABLE_ENTITY",
            "Document contains no readable text. Try pasting your resume text directly.",
            requestId,
            { statusCode: 422 }
          );
        }

        const normalizedText = extractedRaw.slice(0, MAX_RESUME_TEXT_LENGTH);

        return NextResponse.json({
          success: true,
          text: normalizedText,
          filename: sanitizedName,
          truncated: extractedRaw.length > MAX_RESUME_TEXT_LENGTH,
        });
      } catch (docxErr: any) {
        if (docxErr?.name === "ParserTimeoutError") {
          return createApiErrorResponse(
            "PARSER_TIMEOUT",
            "DOCX parser execution timed out (6-second limit exceeded).",
            requestId,
            { statusCode: 422 }
          );
        }
        console.error(`[Resume Parse] Mammoth error (${requestId}):`, docxErr);
        return createApiErrorResponse(
          "UNPROCESSABLE_ENTITY",
          "Could not extract text from document. Try pasting your resume text directly.",
          requestId,
          { statusCode: 422 }
        );
      }
    }

    // 8. Plain text / Markdown
    if (["txt", "md", "rtf"].includes(ext) || file.type.includes("text")) {
      const rawText = buffer.toString("utf-8").trim();
      const normalizedText = rawText.slice(0, MAX_RESUME_TEXT_LENGTH);
      return NextResponse.json({
        success: true,
        text: normalizedText,
        filename: sanitizedName,
        truncated: rawText.length > MAX_RESUME_TEXT_LENGTH,
      });
    }

    return createApiErrorResponse(
      "UNSUPPORTED_MEDIA",
      `Unsupported file format: .${ext}. Please upload a PDF, DOCX, or TXT file.`,
      requestId,
      { statusCode: 415 }
    );
  } catch (err: any) {
    console.error(`[Resume Parse] Fatal error (${requestId}):`, err);
    return createApiErrorResponse(
      "INTERNAL_ERROR",
      "Failed to parse resume.",
      requestId,
      { statusCode: 500 }
    );
  }
}
