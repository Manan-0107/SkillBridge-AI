/**
 * /api/interviews
 *
 * GET: Fetch interview questions for a job/application or list practice history.
 * POST:
 *   - action: "generate_questions" -> Generates role-specific questions for a job/resume.
 *   - action: "evaluate_answer" -> Evaluates a candidate's answer with STAR feedback.
 *   - action: "record_interview" -> Logs an interview round on an application.
 *
 * Invariant: Never predicts hiring probability or invents candidate facts.
 */

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, checkRateLimitAsync, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";
import { getUserResumes, getUserApplications, saveUserApplication } from "@/lib/db";
import { parseStructuredResume, type CanonicalResume } from "@/lib/resume/structuredParser";
import {
  generateInterviewQuestions,
  evaluatePracticeAnswer,
} from "@/lib/career/interviewEngine";
import {
  generateTeachBackPrompt,
  evaluateTeachBack,
} from "@/lib/interview/teachBack";
import type {
  NormalizedJob,
  InterviewRecord,
  ApplicationRecord,
} from "@/lib/career/types";

// FIX #5: Maximum body size for interview requests
// A request includes a job object + optional resume object. 256KB is generous
// for structured JSON while preventing CPU-intensive parsing of huge payloads.
const MAX_INTERVIEW_BODY_BYTES = 256 * 1024;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = await checkRateLimitAsync(`interview:${userId}`, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (!rl.allowed || rl.isLimited) {
      if (rl.status === 503) {
        return NextResponse.json({ error: "Service temporarily unavailable. Please try again shortly." }, { status: 503 });
      }
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
    }

    // FIX #5: Enforce body size limit before parsing to prevent ReDoS via huge payloads
    const contentLength = Number(req.headers.get("content-length") || "0");
    if (contentLength > MAX_INTERVIEW_BODY_BYTES) {
      return NextResponse.json(
        { error: "Request body too large. Maximum allowed is 256KB." },
        { status: 413 }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { action, job, resume, resumeId, question, answer, applicationId, interviewRecord } = body;

    // Helper: resolve candidate resume
    let candidateResume: CanonicalResume | null = null;
    if (resume && typeof resume === "object" && resume.basics && resume.skills) {
      candidateResume = resume as CanonicalResume;
    } else {
      const userResumes = await getUserResumes(userId);
      if (userResumes && userResumes.length > 0) {
        const targetUpload = resumeId
          ? userResumes.find((r) => r.id === resumeId) || userResumes[0]
          : userResumes[0];

        if (
          targetUpload.analysis_json &&
          typeof targetUpload.analysis_json === "object" &&
          (targetUpload.analysis_json as Record<string, unknown>).structuredResume
        ) {
          candidateResume = (targetUpload.analysis_json as Record<string, unknown>).structuredResume as CanonicalResume;
        } else if (targetUpload.resume_text) {
          candidateResume = parseStructuredResume(targetUpload.resume_text);
        }
      }
    }

    // Action 1: Generate role-specific questions
    if (action === "generate_questions") {
      if (!job || !job.title || !job.company) {
        return NextResponse.json({ error: "Job title and company are required." }, { status: 400 });
      }

      const questions = generateInterviewQuestions({
        job: job as NormalizedJob,
        resume: candidateResume,
      });

      return NextResponse.json({
        success: true,
        ok: true,
        questions,
        notice: "Practice questions generated from employer job requirements.",
      });
    }

    // Action 2: Evaluate practice answer
    if (action === "evaluate_answer") {
      if (!question || !answer || typeof answer !== "string") {
        return NextResponse.json({ error: "Valid question and answer text are required." }, { status: 400 });
      }

      const feedback = evaluatePracticeAnswer({
        question,
        answer: answer.slice(0, 3000),
        resume: candidateResume,
      });

      return NextResponse.json({
        success: true,
        ok: true,
        feedback,
      });
    }

    // Action 3: Record an interview round on a tracked application
    if (action === "record_interview") {
      if (!applicationId || !interviewRecord) {
        return NextResponse.json({ error: "Application ID and interview record details are required." }, { status: 400 });
      }

      const apps = await getUserApplications(userId);
      const app = apps.find((a: ApplicationRecord) => a.id === applicationId);

      if (!app) {
        return NextResponse.json({ error: "Tracked application not found." }, { status: 404 });
      }

      const newInterview: InterviewRecord = {
        ...interviewRecord,
        // FIX #10: Use crypto.randomUUID() instead of Date.now() to avoid collision
        id: interviewRecord.id || `int_${crypto.randomUUID()}`,
        applicationId,
        userId,
        status: interviewRecord.status || "SCHEDULED",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const existingInterviews = Array.isArray(app.interviews) ? app.interviews : [];
      const updatedApp: ApplicationRecord = {
        ...app,
        status: "INTERVIEW",
        interviews: [...existingInterviews, newInterview],
        timeline: [
          ...(app.timeline || []),
          {
            id: `evt_${crypto.randomUUID()}`,
            applicationId,
            eventType: "INTERVIEW_SCHEDULED",
            description: `Scheduled ${newInterview.roundType} interview round (${newInterview.format})`,
            timestamp: new Date().toISOString(),
          },
        ],
        updatedAt: new Date().toISOString(),
      };

      await saveUserApplication(userId, updatedApp);

      return NextResponse.json({
        success: true,
        ok: true,
        interview: newInterview,
        application: updatedApp,
      });
    }

    // Action 4: Generate a Teach-Back prompt for Feynman technique practice
    if (action === "get_teach_back_prompt") {
      const skill = body.skill || "Full-Stack System Architecture";
      const audience = body.targetAudience || "JUNIOR_DEVELOPER";
      const prompt = generateTeachBackPrompt(skill, audience);
      return NextResponse.json({
        success: true,
        ok: true,
        prompt,
      });
    }

    // Action 5: Evaluate candidate Teach-Back explanation
    if (action === "evaluate_teach_back") {
      const { prompt, answer: candidateAnswer } = body;
      if (!prompt || !candidateAnswer || typeof candidateAnswer !== "string") {
        return NextResponse.json({ error: "Teach-back prompt and answer are required." }, { status: 400 });
      }

      const evaluation = evaluateTeachBack(prompt, candidateAnswer);
      return NextResponse.json({
        success: true,
        ok: true,
        evaluation,
      });
    }

    return NextResponse.json({ error: "Invalid interview action" }, { status: 400 });
  } catch (err: unknown) {
    console.error("[POST /api/interviews] Error:", err);
    return NextResponse.json({ error: "Internal error processing interview request." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apps = await getUserApplications(userId);
    const interviews = apps.flatMap((a) => a.interviews || []);

    return NextResponse.json({
      ok: true,
      interviews,
    });
  } catch (err: unknown) {
    console.error("[GET /api/interviews] Error:", err);
    return NextResponse.json({ error: "Internal error fetching interviews." }, { status: 500 });
  }
}

/**
 * DELETE /api/interviews?id={interviewId}
 *
 * Removes a specific interview from its parent application.
 * The interview MUST belong to an application owned by the authenticated user.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(req.url, "http://localhost:3000");
    const interviewId = url.searchParams.get("id");
    if (!interviewId || typeof interviewId !== "string" || !interviewId.trim()) {
      return NextResponse.json({ error: "Missing or invalid interview id" }, { status: 400 });
    }

    const apps = await getUserApplications(userId);
    let targetApp: ApplicationRecord | undefined;
    let targetInterviewFound = false;

    for (const app of apps as ApplicationRecord[]) {
      const interviews: InterviewRecord[] = Array.isArray(app.interviews) ? app.interviews : [];
      if (interviews.some((i) => i.id === interviewId.trim())) {
        targetApp = app;
        targetInterviewFound = true;
        break;
      }
    }

    if (!targetInterviewFound || !targetApp) {
      return NextResponse.json({ error: "Interview not found." }, { status: 404 });
    }

    const updatedInterviews = (targetApp.interviews as InterviewRecord[]).filter(
      (i) => i.id !== interviewId.trim()
    );

    const updatedApp: ApplicationRecord = {
      ...targetApp,
      interviews: updatedInterviews,
      updatedAt: new Date().toISOString(),
    };

    await saveUserApplication(userId, updatedApp);

    return NextResponse.json({ success: true, ok: true, deletedId: interviewId.trim() });
  } catch (err: unknown) {
    console.error("[DELETE /api/interviews] Error:", err);
    return NextResponse.json({ error: "Failed to delete interview." }, { status: 500 });
  }
}

