/**
 * POST /api/resume/parse
 *
 * Accepts multipart/form-data with a `file` field.
 * - .txt / .md  → reads as UTF-8 text
 * - .pdf        → uses pdf-parse (Node.js only)
 * - .docx / .doc → uses mammoth
 * - Other       → returns empty string (fallback to client-side handling)
 *
 * Returns: { text: string, filename: string, pages?: number }
 */

import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs"; // pdf-parse requires Node.js

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 10 MB hard limit
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json(
        { error: "File too large (max 10 MB)" },
        { status: 413 }
      );
    }

    const filename = file.name ?? "resume";
    const ext = filename.split(".").pop()?.toLowerCase() ?? "";
    const buffer = Buffer.from(await file.arrayBuffer());

    // ── Plain text / Markdown ────────────────────────────────────────────────
    if (["txt", "md", "rtf"].includes(ext) || file.type.includes("text")) {
      const text = buffer.toString("utf-8");
      return NextResponse.json({ text, filename });
    }

    // ── PDF ─────────────────────────────────────────────────────────────────
    if (ext === "pdf" || file.type === "application/pdf") {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const pdfParse = require("pdf-parse");
        const data = await pdfParse(buffer);
        return NextResponse.json({
          text: data.text,
          filename,
          pages: data.numpages,
        });
      } catch (pdfErr) {
        console.error("[parse] pdf-parse error:", pdfErr);
        return NextResponse.json(
          { error: "Could not extract text from PDF. Try pasting your resume text instead." },
          { status: 422 }
        );
      }
    }

    // ── DOCX / DOC ──────────────────────────────────────────────────────────
    if (
      ["docx", "doc"].includes(ext) ||
      file.type.includes("word") ||
      file.type.includes("officedocument")
    ) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const mammoth = require("mammoth");
        const result = await mammoth.extractRawText({ buffer });
        return NextResponse.json({ text: result.value, filename });
      } catch (docxErr) {
        console.error("[parse] mammoth error:", docxErr);
        return NextResponse.json(
          { error: "Could not extract text from DOCX. Try pasting your resume text instead." },
          { status: 422 }
        );
      }
    }

    // ── Unsupported format ───────────────────────────────────────────────────
    return NextResponse.json(
      { error: `Unsupported file type: .${ext}. Use PDF, DOCX, or TXT.` },
      { status: 415 }
    );
  } catch (err) {
    console.error("[parse] Unexpected error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
