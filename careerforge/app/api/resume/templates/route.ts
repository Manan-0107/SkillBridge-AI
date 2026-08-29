import { NextResponse } from "next/server";

import { atsTemplates } from "@/lib/templates";

export async function GET() {
  return NextResponse.json({
    status: "success",
    source: "Open Source ATS Layout Engine (GitHub Inspired)",
    count: atsTemplates.length,
    templates: atsTemplates,
    standardsCompliant: ["Workday", "Greenhouse", "Lever", "Taleo", "iCIMS", "JSONResume v1.0.0"],
  });
}
