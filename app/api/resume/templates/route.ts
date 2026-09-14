import { NextResponse } from "next/server";
import { atsTemplates } from "@/lib/templates";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(atsTemplates);
}
