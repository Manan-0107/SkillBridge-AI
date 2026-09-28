/**
 * POST /api/resume/parse
 *
 * Secure Resume File Parser API:
 * - Authenticated only (requires active session)
 * - Rate limited against DoS and memory exhaustion
 * - 10MB payload size limit
 * - Strict filename sanitization (blocks directory traversal and control characters)
 * - Magic byte inspection (validates PDF and DOCX file signatures)
 * - Blocks executable files (PE, ELF, Mach-O)
 * - Extracts clean text from PDF, DOCX, TXT, MD
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import path from "path";
import { getAuthenticatedUser } from "@/lib/supabase/auth";
import { checkRateLimit, getClientIp, RATE_LIMIT_PRESETS } from "@/lib/security/rateLimit";
import { createApiErrorResponse } from "@/lib/errors/apiError";
import { isExecutable, isPdf, isDocx, sanitizeFilename } from "@/lib/security/upload";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const clientIp = getClientIp(req);

  // 1. Authentication Check
  const authUser = await getAuthenticatedUser();
  if (!authUser) {
    return createApiErrorResponse("UNAUTHORIZED", "Authentication required to upload and parse resumes.", requestId, {
      statusCode: 401,
    });
  }

  // 2. Rate Limiting (10 uploads per min per user)
  const rl = checkRateLimit(`resume_upload:${authUser.id || clientIp}`, RATE_LIMIT_PRESETS.resumeUpload);
  if (rl.isLimited) {
    return createApiErrorResponse(
      "RATE_LIMITED",
      "Too many resume uploads. Please wait a minute before uploading another document.",
      requestId,
      { statusCode: 429, retryable: true }
    );
  }

  try {
    let formData: FormData;
    try {
      formData = await req.formData();
    } catch {
      return createApiErrorResponse("BAD_REQUEST", "Failed to parse multipart form data.", requestId, {
        statusCode: 400,
      });
    }

    const file = formData.get("file") as File | null;
    if (!file) {
      return createApiErrorResponse("BAD_REQUEST", "No resume file was provided.", requestId, {
        statusCode: 400,
      });
    }

    // 3. File Size Validation
    if (file.size > MAX_FILE_SIZE) {
      return createApiErrorResponse("PAYLOAD_TOO_LARGE", "File exceeds maximum allowed size (10 MB).", requestId, {
        statusCode: 413,
      });
    }

    const sanitizedName = sanitizeFilename(file.name);
    const ext = sanitizedName.split(".").pop()?.toLowerCase() ?? "";
    const buffer = Buffer.from(await file.arrayBuffer());

    // 4. Guard against executable files
    if (isExecutable(buffer)) {
      return createApiErrorResponse("UNSUPPORTED_MEDIA", "Executable files cannot be parsed as resumes.", requestId, {
        statusCode: 415,
      });
    }

    // 5. PDF Parsing with Magic Byte Check
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
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(buffer);
        const text = (data.text || "").trim();

        if (!text) {
          return createApiErrorResponse(
            "UNPROCESSABLE_ENTITY",
            "Could not extract text from PDF (it may be a scanned image). Please paste your resume text.",
            requestId,
            { statusCode: 422 }
          );
        }

        return NextResponse.json({
          success: true,
          text,
          filename: sanitizedName,
          pages: data.numpages,
        });
      } catch (pdfErr) {
        console.error(`[Resume Parse] PDF parsing failed (${requestId}):`, pdfErr);
        return createApiErrorResponse(
          "UNPROCESSABLE_ENTITY",
          "Could not extract text from PDF. Try pasting your resume text directly.",
          requestId,
          { statusCode: 422 }
        );
      }
    }

    // 6. DOCX Parsing with ZIP Magic Byte Check
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

      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        const text = (result.value || "").trim();

        if (!text) {
          return createApiErrorResponse(
            "UNPROCESSABLE_ENTITY",
            "Document contains no readable text. Try pasting your resume text directly.",
            requestId,
            { statusCode: 422 }
          );
        }

        return NextResponse.json({
          success: true,
          text,
          filename: sanitizedName,
        });
      } catch (docxErr) {
        console.error(`[Resume Parse] Mammoth error (${requestId}):`, docxErr);
        return createApiErrorResponse(
          "UNPROCESSABLE_ENTITY",
          "Could not extract text from document. Try pasting your resume text directly.",
          requestId,
          { statusCode: 422 }
        );
      }
    }

    // 7. Plain text / Markdown
    if (["txt", "md", "rtf"].includes(ext) || file.type.includes("text")) {
      const text = buffer.toString("utf-8").trim();
      return NextResponse.json({
        success: true,
        text,
        filename: sanitizedName,
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
    return createApiErrorResponse("INTERNAL_ERROR", "Failed to parse resume.", requestId, { statusCode: 500 });
  }
}
