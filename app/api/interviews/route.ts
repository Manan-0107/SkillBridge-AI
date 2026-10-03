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
import { getAuthenticatedUserId } from "@/lib/supabase/auth";
import { checkRateLimit, RATE_LIMIT_POLICIES } from "@/lib/security/rateLimit";
import { getUserResumes, getUserApplications, saveUserApplication } from "@/lib/db";
import { parseStructuredResume, type CanonicalResume } from "@/lib/resume/structuredParser";
import {
  generateInterviewQuestions,
  evaluatePracticeAnswer,
} from "@/lib/career/interviewEngine";
import type {
  NormalizedJob,
  InterviewRecord,
  ApplicationRecord,
} from "@/lib/career/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const userId = await getAuthenticatedUserId(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const rl = checkRateLimit(`interview:${userId}`, RATE_LIMIT_POLICIES.PUBLIC_API);
    if (rl.isLimited) {
      return NextResponse.json({ error: "Too many requests. Please wait a moment." }, { status: 429 });
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
        id: interviewRecord.id || `int_${Date.now()}`,
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
            id: `evt_${Date.now()}`,
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

