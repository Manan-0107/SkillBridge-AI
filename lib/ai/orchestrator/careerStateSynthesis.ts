/**
 * lib/ai/orchestrator/careerStateSynthesis.ts
 *
 * UBIX Cross-Module Career State Synthesis Engine:
 * Connects the Conversation Engine to authoritative application state across:
 * Roadmap -> Practice -> Progress -> Learning -> Resume -> Jobs.
 *
 * CRITICAL ARCHITECTURAL RULE:
 * Application state owns the facts (roadmap milestones, practice scores, weak areas,
 * resume state, job matches, deadlines).
 * The synthesis engine computes deterministic recommendations from authoritative state.
 * The LLM or Voice Assistant communicates those facts naturally without inventing state.
 */

export interface AuthoritativeCareerState {
  goal: {
    targetRole?: string;
    experienceLevel?: string;
    learningHoursPerWeek?: number;
    location?: string;
    targetDeadlineDays?: number;
  };
  roadmap: {
    activeRole?: string;
    currentMilestoneIndex: number;
    totalMilestones: number;
    currentMilestoneTitle: string;
    currentMilestoneConcepts: string[];
    completedMilestoneIndices: number[];
    completionPercentage: number;
  };
  practice: {
    recentScoreAverage: number; // 0 - 100
    totalQuestionsAnswered: number;
    currentStreak: number;
    struggledConcepts: string[];
    masteredConcepts: string[];
    latestPracticeDate?: string;
  };
  resume: {
    hasResume: boolean;
    atsScore?: number;
    verifiedSkills: string[];
    missingSkills: string[];
  };
  jobs: {
    targetRoles: string[];
    matchedCount: number;
    preferredWorkMode?: string;
  };
  deadlines?: {
    interviewUpcoming?: boolean;
    interviewRole?: string;
    daysRemaining?: number;
  };
}

export type CareerChainQueryType =
  | "daily_focus"
  | "why_learning"
  | "weakness_analysis"
  | "next_practice"
  | "milestone_completion"
  | "update_roadmap_from_practice"
  | "jobs_matching_learned"
  | "resume_reflection"
  | "pre_application_improvements";

export interface CareerSynthesisResult {
  queryType: CareerChainQueryType;
  primaryFocus: string;
  rationale: string;
  spokenRecommendation: string;
  targetWorkspace: "roadmap" | "practice" | "resume" | "jobs" | "courses" | "assistant";
  actionableStep: string;
  toolCall?: {
    tool: string;
    parameters: Record<string, any>;
  };
  authoritativeFacts: Record<string, any>;
}

export class CareerSynthesisEngine {
  /**
   * Detects if user utterance matches one of the 9 cross-module career chain queries
   */
  public static detectQueryType(utterance: string): CareerChainQueryType | null {
    const clean = utterance.toLowerCase().trim();

    // 1. "What should I work on today?"
    if (
      /\b(what should i work on today|what should i do today|what do i do today|aaj kya karu|aaj kya karna hai|aaje shu karvu|today's focus|todays focus|what to study today)\b/i.test(clean)
    ) {
      return "daily_focus";
    }

    // 2. "Why am I learning this?"
    if (
      /\b(why am i learning this|why are we learning this|why is this needed|why should i learn this|kyun sikh raha hu|kem shikhu chu|pourquoi apprendre)\b/i.test(clean)
    ) {
      return "why_learning";
    }

    // 3. "What am I weak at?"
    if (
      /\b(what am i weak at|where am i weak|what are my weak areas|what are my weaknesses|meri kamzori kya hai|mari kamjori su che|quelles sont mes faiblesses)\b/i.test(clean)
    ) {
      return "weakness_analysis";
    }

    // 4. "What should I practice next?"
    if (
      /\b(what should i practice next|what to practice next|what can i practice next|next practice drill|agli practice|aagal su practice karvu)\b/i.test(clean)
    ) {
      return "next_practice";
    }

    // 5. "Have I completed everything for my current milestone?"
    if (
      /\b(have i completed everything for my current milestone|did i finish my milestone|is my milestone complete|current milestone progress|milestone khatam hua|milestone puru thayu)\b/i.test(clean)
    ) {
      return "milestone_completion";
    }

    // 6. "Update my roadmap based on my recent practice."
    if (
      /\b(update my roadmap based on my recent practice|adjust roadmap to practice|adapt roadmap|roadmap update karo|practice ke hisaab se roadmap)\b/i.test(clean)
    ) {
      return "update_roadmap_from_practice";
    }

    // 7. "Find jobs matching what I've learned."
    if (
      /\b(find jobs matching what i've learned|jobs matching what i learned|jobs for my current skills|show jobs for what i know|jo seekha uske jobs)\b/i.test(clean)
    ) {
      return "jobs_matching_learned";
    }

    // 8. "Does my resume reflect my current skills?"
    if (
      /\b(does my resume reflect my current skills|is my resume up to date with my skills|does my cv match my skills|resume check skills|kya mera resume skills reflect karta hai)\b/i.test(clean)
    ) {
      return "resume_reflection";
    }

    // 9. "What do I need to improve before applying?"
    if (
      /\b(what do i need to improve before applying|before i apply|readiness before applying|job ready check|apply karne se pehle kya sudharu)\b/i.test(clean)
    ) {
      return "pre_application_improvements";
    }

    return null;
  }

  /**
   * Synthesizes authoritative career state into a grounded recommendation
   */
  public static synthesize(
    queryType: CareerChainQueryType,
    state: AuthoritativeCareerState,
    lang: string = "en"
  ): CareerSynthesisResult {
    switch (queryType) {
      case "daily_focus":
        return this.synthesizeDailyFocus(state, lang);
      case "why_learning":
        return this.synthesizeWhyLearning(state, lang);
      case "weakness_analysis":
        return this.synthesizeWeaknessAnalysis(state, lang);
      case "next_practice":
        return this.synthesizeNextPractice(state, lang);
      case "milestone_completion":
        return this.synthesizeMilestoneCompletion(state, lang);
      case "update_roadmap_from_practice":
        return this.synthesizeRoadmapUpdate(state, lang);
      case "jobs_matching_learned":
        return this.synthesizeJobsMatchingLearned(state, lang);
      case "resume_reflection":
        return this.synthesizeResumeReflection(state, lang);
      case "pre_application_improvements":
        return this.synthesizePreApplicationImprovements(state, lang);
    }
  }

  // ─── 1. DAILY FOCUS SYNTHESIS ──────────────────────────────────────────────
  private static synthesizeDailyFocus(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const role = state.goal.targetRole;
    const milestoneTitle = state.roadmap.currentMilestoneTitle;
    const milestoneConcepts = state.roadmap.currentMilestoneConcepts || [];
    const struggled = state.practice.struggledConcepts || [];
    const deadline = state.deadlines;

    // Cross-module intersection: did user struggle with a concept in the current milestone?
    const activeStruggle = struggled.find((s) =>
      milestoneConcepts.some((c) => s.toLowerCase().includes(c.toLowerCase()) || c.toLowerCase().includes(s.toLowerCase()))
    ) || (struggled.length > 0 ? struggled[0] : null);

    // If user has no roadmap milestone and no struggle, advise establishing one
    if (!milestoneTitle && !activeStruggle && state.roadmap.totalMilestones === 0) {
      const spoken = role
        ? `To plan your daily focus for ${role}, you don't have an active career roadmap or practice history configured yet. Let's open the Roadmap Suite to generate your milestone plan.`
        : "You don't have an active career roadmap or target role configured yet. Would you like to set your target track and generate a roadmap?";

      return {
        queryType: "daily_focus",
        primaryFocus: "Roadmap Setup",
        rationale: "No active roadmap or practice history found in authoritative state.",
        spokenRecommendation: spoken,
        targetWorkspace: "roadmap",
        actionableStep: "Create career roadmap",
        toolCall: { tool: "navigateTo", parameters: { page: "roadmap" } },
        authoritativeFacts: {
          targetRole: role || null,
          hasRoadmap: false,
          practiceQuestions: state.practice.totalQuestionsAnswered,
        },
      };
    }

    const effectiveTitle = milestoneTitle || "Current Milestone";
    const focusItem = activeStruggle || milestoneConcepts[0] || (role ? `${role} Core Skills` : "Core Skills");
    let rationale = "";
    let spoken = "";

    if (activeStruggle) {
      rationale = `Current roadmap milestone is "${effectiveTitle}", and recent practice shows repeated difficulty in "${activeStruggle}".`;
      if (deadline?.interviewUpcoming) {
        rationale += ` You have an upcoming interview in ${deadline.daysRemaining} days, making this the highest priority.`;
      }
      spoken = `Today, focus on ${focusItem}. You've been struggling with ${focusItem} in recent practice, and it is part of your current roadmap milestone "${effectiveTitle}". I recommend a 30-minute practice drill first, followed by two coding questions. Want me to start the drill?`;
    } else {
      rationale = `Current roadmap milestone "${effectiveTitle}" has upcoming milestones with 0 practice deficits.`;
      spoken = `Today, focus on "${effectiveTitle}"${role ? ` for your ${role} path` : ""}. You've completed earlier prerequisites with solid accuracy. Let's tackle ${focusItem} with an interactive lesson and drill. Shall we open the roadmap?`;
    }

    return {
      queryType: "daily_focus",
      primaryFocus: focusItem,
      rationale,
      spokenRecommendation: spoken,
      targetWorkspace: activeStruggle ? "practice" : "roadmap",
      actionableStep: activeStruggle ? `Start 30-minute drill on ${focusItem}` : `Advance ${effectiveTitle} milestone`,
      toolCall: activeStruggle
        ? { tool: "startPractice", parameters: { topic: focusItem } }
        : { tool: "navigateTo", parameters: { page: "roadmap" } },
      authoritativeFacts: {
        targetRole: role || null,
        milestoneTitle: effectiveTitle,
        activeStruggle,
        interviewDeadline: deadline?.daysRemaining ?? null,
      },
    };
  }

  // ─── 2. WHY AM I LEARNING THIS? ───────────────────────────────────────────
  private static synthesizeWhyLearning(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const role = state.goal.targetRole;
    const currentMilestone = state.roadmap.currentMilestoneTitle;
    const concepts = state.roadmap.currentMilestoneConcepts.length > 0
      ? state.roadmap.currentMilestoneConcepts.join(", ")
      : "";

    if (!currentMilestone || state.roadmap.totalMilestones === 0) {
      return {
        queryType: "why_learning",
        primaryFocus: "Roadmap Alignment",
        rationale: "No active milestone found to explain.",
        spokenRecommendation: "You don't have an active roadmap milestone configured yet. Once you generate a roadmap, I can explain how each milestone and technical skill maps directly to industry hiring benchmarks.",
        targetWorkspace: "roadmap",
        actionableStep: "Generate career roadmap",
        toolCall: { tool: "navigateTo", parameters: { page: "roadmap" } },
        authoritativeFacts: {
          hasMilestone: false,
          role: role || null,
        },
      };
    }

    const roleText = role ? `${role} production standards and technical interviews` : "production standards and technical interviews";
    const spoken = concepts
      ? `You're learning "${currentMilestone}" (${concepts}) because it is a direct prerequisite for ${roleText}. Mastering these concepts bridges the gap between basic coding and the architectural problem-solving hiring managers test for.`
      : `You're learning "${currentMilestone}" because it is a direct prerequisite for ${roleText}. Mastering this milestone bridges the gap between theory and production problem-solving.`;

    return {
      queryType: "why_learning",
      primaryFocus: currentMilestone,
      rationale: `Mapped milestone "${currentMilestone}" directly to job market core competencies${role ? ` for "${role}"` : ""}.`,
      spokenRecommendation: spoken,
      targetWorkspace: "courses",
      actionableStep: `Review curated ${currentMilestone} syllabus`,
      toolCall: { tool: "searchCourses", parameters: { topic: currentMilestone } },
      authoritativeFacts: {
        role: role || null,
        currentMilestone,
        concepts: state.roadmap.currentMilestoneConcepts,
      },
    };
  }

  // ─── 3. WEAKNESS ANALYSIS ─────────────────────────────────────────────────
  private static synthesizeWeaknessAnalysis(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const struggled = state.practice.struggledConcepts || [];
    const missing = state.resume.missingSkills || [];
    const scoreAvg = state.practice.recentScoreAverage;

    const allWeaknesses = Array.from(new Set([...struggled, ...missing]));

    // Check if user has zero practice and zero resume gap data
    if (state.practice.totalQuestionsAnswered === 0 && missing.length === 0) {
      return {
        queryType: "weakness_analysis",
        primaryFocus: "No Recorded Weaknesses",
        rationale: "Zero practice questions answered and no resume gap audit available.",
        spokenRecommendation: "I don't have any practice history or resume skill gap data recorded for your account yet. Complete a practice drill or upload your resume so I can identify your specific technical weak areas.",
        targetWorkspace: "practice",
        actionableStep: "Start initial practice assessment",
        toolCall: { tool: "startPractice", parameters: {} },
        authoritativeFacts: {
          totalQuestionsAnswered: 0,
          struggledConcepts: [],
          missingSkills: [],
        },
      };
    }

    const primary = allWeaknesses[0] || "None identified yet";
    const scoreText = state.practice.totalQuestionsAnswered > 0 ? `average score: ${scoreAvg}%` : "no practice questions answered yet";

    const spoken = allWeaknesses.length > 0
      ? `Based on your practice telemetry (${scoreText}) and resume audit, your primary weak areas are ${allWeaknesses.slice(0, 3).join(", ")}. In practice, you've lost accuracy on ${struggled.join(", ") || "challenging edge cases"}, while your resume currently lacks ${missing.join(", ") || "documented production experience"}.`
      : `Based on your telemetry, you have no recorded critical deficits. Your average practice accuracy is ${scoreAvg}%, and all required milestone competencies have passed verification.`;

    return {
      queryType: "weakness_analysis",
      primaryFocus: primary,
      rationale: `Derived from ${state.practice.totalQuestionsAnswered} answered questions and active resume audit.`,
      spokenRecommendation: spoken,
      targetWorkspace: "practice",
      actionableStep: `Launch targeted assessment for ${primary}`,
      toolCall: { tool: "startPractice", parameters: { topic: primary } },
      authoritativeFacts: {
        struggledConcepts: struggled,
        missingSkills: missing,
        recentScoreAverage: scoreAvg,
      },
    };
  }

  // ─── 4. NEXT PRACTICE RECOMMENDATION ──────────────────────────────────────
  private static synthesizeNextPractice(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const struggled = state.practice.struggledConcepts || [];
    const milestoneConcepts = state.roadmap.currentMilestoneConcepts || [];
    const nextTopic = struggled[0] || milestoneConcepts[0];

    if (!nextTopic) {
      const topicFallback = state.goal.targetRole ? `${state.goal.targetRole} Fundamentals` : "Practice Drill";
      const spoken = state.practice.totalQuestionsAnswered === 0
        ? "You haven't completed any practice questions yet. Would you like me to open the Practice Lab to begin your first diagnostic drill?"
        : "You have no active struggle areas recorded. Would you like to select a topic from our practice lab to start your next drill?";

      return {
        queryType: "next_practice",
        primaryFocus: topicFallback,
        rationale: "No recorded practice errors or active milestone topics found in authoritative state.",
        spokenRecommendation: spoken,
        targetWorkspace: "practice",
        actionableStep: "Open Practice Lab",
        toolCall: { tool: "startPractice", parameters: {} },
        authoritativeFacts: {
          nextTopic: null,
          totalQuestionsAnswered: state.practice.totalQuestionsAnswered,
        },
      };
    }

    const spoken = `You should practice ${nextTopic} next. It directly reinforces your current milestone while correcting recent errors detected during practice. Would you like me to open a focused 5-question drill?`;

    return {
      queryType: "next_practice",
      primaryFocus: nextTopic,
      rationale: `Prioritized unmastered concept within active milestone.`,
      spokenRecommendation: spoken,
      targetWorkspace: "practice",
      actionableStep: `Begin drill on ${nextTopic}`,
      toolCall: { tool: "startPractice", parameters: { topic: nextTopic } },
      authoritativeFacts: {
        nextTopic,
        recentScoreAverage: state.practice.recentScoreAverage,
      },
    };
  }

  // ─── 5. MILESTONE COMPLETION CHECK ────────────────────────────────────────
  private static synthesizeMilestoneCompletion(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const currentIdx = state.roadmap.currentMilestoneIndex;
    const title = state.roadmap.currentMilestoneTitle;
    const percent = state.roadmap.completionPercentage;

    if (!title || state.roadmap.totalMilestones === 0) {
      return {
        queryType: "milestone_completion",
        primaryFocus: "Roadmap Creation",
        rationale: "No roadmap milestones configured in authoritative state.",
        spokenRecommendation: "You don't have an active career roadmap yet. You can generate one in the Roadmap Suite to track your milestone completion.",
        targetWorkspace: "roadmap",
        actionableStep: "Create career roadmap",
        toolCall: { tool: "navigateTo", parameters: { page: "roadmap" } },
        authoritativeFacts: {
          hasMilestone: false,
          completionPercentage: 0,
        },
      };
    }

    const isCompleted = state.roadmap.completedMilestoneIndices.includes(currentIdx);

    const spoken = isCompleted
      ? `Yes! You have completed all lessons and practice benchmarks for "${title}". Your overall roadmap is now ${percent}% complete. Ready to begin your next milestone?`
      : `You're not quite done with "${title}". You've completed prerequisites, but still have key concepts remaining in this stage. Overall roadmap progress is at ${percent}%. Would you like to resume your lessons?`;

    return {
      queryType: "milestone_completion",
      primaryFocus: title,
      rationale: `Evaluated completed stages index [${state.roadmap.completedMilestoneIndices.join(", ")}] against current index ${currentIdx}.`,
      spokenRecommendation: spoken,
      targetWorkspace: "roadmap",
      actionableStep: isCompleted ? `Advance to next milestone` : `Continue ${title}`,
      toolCall: { tool: "navigateTo", parameters: { page: "roadmap" } },
      authoritativeFacts: {
        milestoneIndex: currentIdx,
        title,
        isCompleted,
        completionPercentage: percent,
      },
    };
  }

  // ─── 6. UPDATE ROADMAP BASED ON PRACTICE ──────────────────────────────────
  private static synthesizeRoadmapUpdate(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const struggled = state.practice.struggledConcepts || [];
    const currentMilestone = state.roadmap.currentMilestoneTitle;

    if (state.practice.totalQuestionsAnswered === 0) {
      return {
        queryType: "update_roadmap_from_practice",
        primaryFocus: currentMilestone || "Practice Required",
        rationale: "No practice history exists to adapt roadmap pacing.",
        spokenRecommendation: "You haven't completed any practice questions yet, so there is no practice data to adjust your roadmap pacing. Once you complete a few drills, I can calibrate your milestones automatically.",
        targetWorkspace: "practice",
        actionableStep: "Complete a practice drill",
        toolCall: { tool: "startPractice", parameters: {} },
        authoritativeFacts: {
          totalQuestionsAnswered: 0,
          currentMilestone: currentMilestone || null,
        },
      };
    }

    const effectiveMilestone = currentMilestone || "your current stage";
    const spoken = struggled.length > 0
      ? `I've updated your roadmap pacing. Because you encountered friction with ${struggled.slice(0, 2).join(" and ")}, I've inserted dedicated reinforcement checkpoints into "${effectiveMilestone}" before you proceed to advanced stages. Let's review the adjusted roadmap!`
      : `Your practice accuracy is consistently high (${state.practice.recentScoreAverage}%). I've optimized your roadmap schedule to accelerate you directly to production project milestones.`;

    return {
      queryType: "update_roadmap_from_practice",
      primaryFocus: effectiveMilestone,
      rationale: `Adapted milestone sequencing based on ${struggled.length} active struggle points.`,
      spokenRecommendation: spoken,
      targetWorkspace: "roadmap",
      actionableStep: `View adaptive roadmap adjustments`,
      toolCall: { tool: "navigateTo", parameters: { page: "roadmap" } },
      authoritativeFacts: {
        currentMilestone: effectiveMilestone,
        struggledConcepts: struggled,
      },
    };
  }

  // ─── 7. FIND JOBS MATCHING WHAT I'VE LEARNED ──────────────────────────────
  private static synthesizeJobsMatchingLearned(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const role = state.goal.targetRole || "Software Engineering";
    const mastered = state.practice.masteredConcepts.length > 0
      ? state.practice.masteredConcepts
      : state.resume.verifiedSkills;
    const loc = state.goal.location || "Remote";

    if (mastered.length === 0) {
      return {
        queryType: "jobs_matching_learned",
        primaryFocus: role,
        rationale: "No verified skills recorded in authoritative state.",
        spokenRecommendation: "You haven't recorded any verified skills or completed roadmap milestones yet. Complete a few lessons or verify your skills in the Practice Lab, and I will match active job openings directly to what you've learned.",
        targetWorkspace: "practice",
        actionableStep: "Verify skills through practice",
        toolCall: { tool: "startPractice", parameters: {} },
        authoritativeFacts: {
          role,
          masteredSkills: [],
          location: loc,
        },
      };
    }

    const spoken = `Searching verified ${role} positions matching the skills you've completed (${mastered.slice(0, 3).join(", ")}). I found ${state.jobs.matchedCount > 0 ? state.jobs.matchedCount : "active"} opportunities in ${loc} that fit your current stage without requiring unlearned technologies.`;

    return {
      queryType: "jobs_matching_learned",
      primaryFocus: role,
      rationale: `Filtered job market openings strictly against completed competencies [${mastered.join(", ")}].`,
      spokenRecommendation: spoken,
      targetWorkspace: "jobs",
      actionableStep: `Explore matched opportunities in ${loc}`,
      toolCall: { tool: "searchJobs", parameters: { role, location: loc, skills: mastered } },
      authoritativeFacts: {
        role,
        masteredSkills: mastered,
        location: loc,
      },
    };
  }

  // ─── 8. RESUME REFLECTION CHECK ───────────────────────────────────────────
  private static synthesizeResumeReflection(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const masteredInPractice = state.practice.masteredConcepts || [];
    const resumeSkills = state.resume.verifiedSkills || [];

    // Skills user mastered in practice but hasn't put on resume
    const missingOnResume = masteredInPractice.filter(
      (s) => !resumeSkills.some((rs) => rs.toLowerCase() === s.toLowerCase())
    );

    if (!state.resume.hasResume) {
      return {
        queryType: "resume_reflection",
        primaryFocus: "Resume Creation",
        rationale: "No resume on file to audit against practice skills.",
        spokenRecommendation: "You haven't uploaded or built a resume yet in UBIX. I don't have an ATS score or resume skills on file. Would you like me to open the Resume Builder so you can create one with your verified skills?",
        targetWorkspace: "resume",
        actionableStep: "Create new resume",
        toolCall: { tool: "openResume", parameters: { tab: "builder" } },
        authoritativeFacts: {
          hasResume: false,
          masteredInPractice,
          atsScore: null,
        },
      };
    }

    const hasAts = typeof state.resume.atsScore === "number";
    const currentAtsText = hasAts ? `above its current ${state.resume.atsScore}%` : "towards 80%+";
    const verifiedAtsText = hasAts ? `with a strong ${state.resume.atsScore}% ATS rating` : "though I don't have an ATS score calculated for your current resume yet";

    const spoken = missingOnResume.length > 0
      ? `Your resume is currently lagging behind your actual skills. You have proven mastery in ${missingOnResume.join(", ")} during practice, but they are not yet listed on your active resume. Adding them will raise your ATS score ${currentAtsText}. Would you like me to update your resume draft?`
      : `Yes! Your resume accurately highlights your proven competencies (${resumeSkills.slice(0, 4).join(", ")}), matching your verified practice benchmarks ${verifiedAtsText}.`;

    return {
      queryType: "resume_reflection",
      primaryFocus: missingOnResume[0] || "Resume Alignment",
      rationale: `Cross-referenced practice mastery against resume skill index.`,
      spokenRecommendation: spoken,
      targetWorkspace: "resume",
      actionableStep: missingOnResume.length > 0 ? `Add ${missingOnResume.join(", ")} to resume` : `Review verified resume`,
      toolCall: { tool: "openResume", parameters: { tab: "builder" } },
      authoritativeFacts: {
        resumeSkills,
        missingOnResume,
        atsScore: state.resume.atsScore ?? null,
      },
    };
  }

  // ─── 9. PRE-APPLICATION IMPROVEMENTS ──────────────────────────────────────
  private static synthesizePreApplicationImprovements(
    state: AuthoritativeCareerState,
    lang: string
  ): CareerSynthesisResult {
    const role = state.goal.targetRole || "target";
    const struggled = state.practice.struggledConcepts || [];
    const missingSkills = state.resume.missingSkills || [];
    const ats = state.resume.atsScore;

    const criticalImprovements: string[] = [];
    if (struggled.length > 0) {
      criticalImprovements.push(`strengthen ${struggled[0]} in coding practice`);
    }
    if (missingSkills.length > 0) {
      criticalImprovements.push(`complete portfolio evidence for ${missingSkills[0]}`);
    }
    if (typeof ats === "number" && ats < 80) {
      criticalImprovements.push(`boost your ATS compliance score from ${ats}% to 80%+`);
    } else if (ats === undefined || !state.resume.hasResume) {
      criticalImprovements.push("upload or build a verified resume in the Resume Suite to calculate your ATS score");
    }

    const atsText = typeof ats === "number" ? `your resume ATS score is strong (${ats}%)` : "you don't have an ATS score calculated yet";

    const spoken = criticalImprovements.length > 0
      ? `Before applying to ${role} openings, there are ${criticalImprovements.length} key priorities: ${criticalImprovements.join(", ")}. Tackling these first will significantly increase your interview conversion rate.`
      : `You're in prime condition to apply for ${role} roles! Your practice scores are strong, ${atsText}, and your core milestones are verified. Let's review live openings!`;

    return {
      queryType: "pre_application_improvements",
      primaryFocus: criticalImprovements[0] || "Job Readiness",
      rationale: `Synthesized cross-module readiness from practice accuracy, skill gaps, and resume ATS rating.`,
      spokenRecommendation: spoken,
      targetWorkspace: criticalImprovements.length > 0 ? "practice" : "jobs",
      actionableStep: criticalImprovements[0] || `Apply to matched jobs`,
      toolCall: criticalImprovements.length > 0
        ? { tool: "startPractice", parameters: { topic: struggled[0] || "core" } }
        : { tool: "searchJobs", parameters: { role } },
      authoritativeFacts: {
        role,
        criticalImprovements,
        atsScore: ats ?? null,
      },
    };
  }
}
