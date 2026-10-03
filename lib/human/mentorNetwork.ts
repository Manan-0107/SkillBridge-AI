/**
 * lib/human/mentorNetwork.ts
 *
 * UBIX Human Support Network & Mentor Matching
 *
 * Connects candidates with verified human engineering mentors and community peers.
 *
 * STRICT INVARIANT: AI NEVER PRETENDS TO BE A HUMAN.
 * All automated assistance is explicitly badged as "AI Assistant", and
 * transitions to human support are explicit, consensual handoffs.
 */

export interface HumanMentorProfile {
  mentorId: string;
  fullName: string;
  title: string;
  company: string;
  expertiseSkills: string[];
  mentoringTopics: ("RESUME_REVIEW" | "MOCK_INTERVIEW" | "SYSTEM_DESIGN" | "ACCESSIBILITY_NAV" | "CAREER_PIVOT")[];
  timezone: string;
  hasLivedAccessibilityExperience: boolean;
  accessibilityExperienceNotes?: string;
  isAvailableForIntro: boolean;
}

export const VERIFIED_MENTOR_DIRECTORY: HumanMentorProfile[] = [
  {
    mentorId: "mentor_sarah_c",
    fullName: "Sarah Chen",
    title: "Staff Infrastructure Engineer",
    company: "GitHub",
    expertiseSkills: ["Go", "Kubernetes", "Docker", "Linux"],
    mentoringTopics: ["SYSTEM_DESIGN", "MOCK_INTERVIEW", "CAREER_PIVOT"],
    timezone: "America/Los_Angeles",
    hasLivedAccessibilityExperience: false,
    isAvailableForIntro: true,
  },
  {
    mentorId: "mentor_david_k",
    fullName: "David Kim",
    title: "Senior Accessibility Specialist & UI Architect",
    company: "Microsoft",
    expertiseSkills: ["React", "TypeScript", "WCAG AA", "Web Accessibility (a11y)"],
    mentoringTopics: ["RESUME_REVIEW", "ACCESSIBILITY_NAV", "MOCK_INTERVIEW"],
    timezone: "America/New_York",
    hasLivedAccessibilityExperience: true,
    accessibilityExperienceNotes: "Screen reader power user and low-vision engineering mentor.",
    isAvailableForIntro: true,
  },
  {
    mentorId: "mentor_ananya_p",
    fullName: "Ananya Patel",
    title: "Principal Database Engineer",
    company: "Supabase / PostgreSQL Contributor",
    expertiseSkills: ["PostgreSQL", "SQL", "Distributed Systems", "TypeScript"],
    mentoringTopics: ["SYSTEM_DESIGN", "MOCK_INTERVIEW"],
    timezone: "Asia/Kolkata",
    hasLivedAccessibilityExperience: false,
    isAvailableForIntro: true,
  },
];

/**
 * Matches candidate needs with verified human mentors.
 */
export function findMatchingMentors(input: {
  desiredTopics: HumanMentorProfile["mentoringTopics"];
  skillGaps: string[];
  preferAccessibilityExperience?: boolean;
}): HumanMentorProfile[] {
  const normGaps = new Set(input.skillGaps.map((s) => s.toLowerCase()));

  return VERIFIED_MENTOR_DIRECTORY.filter((mentor) => {
    if (!mentor.isAvailableForIntro) return false;

    // Topic overlap
    const topicMatch = input.desiredTopics.some((t) => mentor.mentoringTopics.includes(t));
    if (!topicMatch) return false;

    // Accessibility lived experience preference
    if (input.preferAccessibilityExperience && !mentor.hasLivedAccessibilityExperience) {
      return false;
    }

    // Skill overlap
    const skillMatch = mentor.expertiseSkills.some((s) => normGaps.has(s.toLowerCase()));
    return skillMatch || input.preferAccessibilityExperience;
  });
}
