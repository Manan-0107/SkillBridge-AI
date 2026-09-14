import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName,
      headline,
      email,
      phone,
      location,
      linkedIn,
      portfolio,
      github,
      summary,
      experiences,
      educations,
      skills,
      tools,
      projects,
      certifications,
    } = body;

    // Convert to standard JSONResume Schema (v1.0.0) from GitHub: jsonresume/resume-schema
    const jsonResume = {
      $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
      basics: {
        name: fullName || "",
        label: headline || "",
        email: email || "",
        phone: phone || "",
        url: portfolio || "",
        summary: summary || "",
        location: {
          city: location ? location.split(",")[0]?.trim() : "",
          region: location ? location.split(",")[1]?.trim() : "",
        },
        profiles: [
          linkedIn && { network: "LinkedIn", url: linkedIn.startsWith("http") ? linkedIn : `https://${linkedIn}` },
          github && { network: "GitHub", url: github.startsWith("http") ? github : `https://${github}` },
        ].filter(Boolean),
      },
      work: (experiences || []).map((exp: { role?: string; company?: string; location?: string; startDate?: string; endDate?: string; current?: boolean; bullets?: string }) => ({
        name: exp.company || "",
        position: exp.role || "",
        location: exp.location || "",
        startDate: exp.startDate || "",
        endDate: exp.current ? "Present" : exp.endDate || "",
        summary: exp.bullets || "",
        highlights: (exp.bullets || "").split("\n").filter((b: string) => b.trim().length > 0).map((b: string) => b.replace(/^[•\-\*]\s*/, "")),
      })),
      education: (educations || []).map((edu: { institution?: string; degree?: string; location?: string; graduationYear?: string; gpaOrHonors?: string }) => ({
        institution: edu.institution || "",
        studyType: edu.degree || "",
        endDate: edu.graduationYear || "",
        score: edu.gpaOrHonors || "",
      })),
      skills: [
        skills && {
          name: "Core Skills",
          keywords: skills.split(",").map((s: string) => s.trim()).filter(Boolean),
        },
        tools && {
          name: "Tools & Platforms",
          keywords: tools.split(",").map((s: string) => s.trim()).filter(Boolean),
        },
      ].filter(Boolean),
      projects: (projects || []).map((proj: { title?: string; techStack?: string; liveUrl?: string; repoUrl?: string; description?: string }) => ({
        name: proj.title || "",
        description: proj.description || "",
        highlights: (proj.description || "").split("\n").filter((b: string) => b.trim().length > 0).map((b: string) => b.replace(/^[•\-\*]\s*/, "")),
        keywords: (proj.techStack || "").split(",").map((s: string) => s.trim()).filter(Boolean),
        url: proj.liveUrl || proj.repoUrl || "",
      })),
      certificates: (certifications || []).map((cert: { name?: string; issuer?: string; date?: string; linkOrId?: string }) => ({
        name: cert.name || "",
        issuer: cert.issuer || "",
        date: cert.date || "",
        url: cert.linkOrId || "",
      })),
      meta: {
        canonical: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
        version: "v1.0.0",
        lastModified: new Date().toISOString(),
      },
    };

    return NextResponse.json({
      status: "success",
      schema: "JSONResume v1.0.0",
      data: jsonResume,
    });
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: error instanceof Error ? error.message : "Invalid payload" },
      { status: 400 }
    );
  }
}
