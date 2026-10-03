/**
 * lib/integrations/github.ts
 *
 * UBIX Server-Side GitHub Integration & Evidence Extractor
 *
 * Securely analyzes authorized repository metadata to extract objective
 * technical evidence without conflating raw commit volume into skill mastery.
 *
 * Invariants:
 * 1. Server-side only (never expose tokens to client).
 * 2. Scoped permissions: Reads only public or explicitly authorized repositories.
 * 3. Objective extraction: Flags languages, documentation, tests, and CI workflows.
 * 4. Provenance: Tagged as SOURCE_VERIFIED with verifiable commit/repo references.
 */

import { SkillEvidence } from "../career/evidenceWallet";

export interface GitHubRepoSummary {
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  primaryLanguage: string | null;
  languages: Record<string, number>; // byte counts
  stargazersCount: number;
  forksCount: number;
  isFork: boolean;
  hasReadme: boolean;
  hasTests: boolean;
  hasCiWorkflow: boolean;
  lastPushedAt: string;
}

export interface ExtractedGitHubEvidence {
  repoSummaries: GitHubRepoSummary[];
  detectedSkills: string[];
  evidenceItems: SkillEvidence[];
  warnings: string[];
}

/**
 * Normalizes raw GitHub repository data and extracts objective evidence.
 * Does not artificially inflate mastery; evidence confidence is bounded (e.g., 0.65-0.80)
 * based on concrete artifacts (README, tests, CI).
 */
export function extractEvidenceFromGitHubRepos(
  repos: Array<{
    name: string;
    fullName: string;
    description?: string | null;
    htmlUrl: string;
    primaryLanguage?: string | null;
    languages?: Record<string, number>;
    stargazersCount?: number;
    forksCount?: number;
    isFork?: boolean;
    hasReadme?: boolean;
    hasTests?: boolean;
    hasCiWorkflow?: boolean;
    pushedAt?: string;
  }>,
  userId = "user_default"
): ExtractedGitHubEvidence {
  const repoSummaries: GitHubRepoSummary[] = [];
  const detectedSkillsSet = new Set<string>();
  const evidenceItems: SkillEvidence[] = [];
  const warnings: string[] = [];

  for (const r of repos) {
    // Skip forks unless user specifically contributed (flag warning)
    if (r.isFork) {
      warnings.push(`Repository ${r.fullName} is a fork; skipping automatic evidence attribution.`);
      continue;
    }

    const summary: GitHubRepoSummary = {
      name: r.name,
      fullName: r.fullName,
      description: r.description || null,
      htmlUrl: r.htmlUrl,
      primaryLanguage: r.primaryLanguage || null,
      languages: r.languages || {},
      stargazersCount: r.stargazersCount || 0,
      forksCount: r.forksCount || 0,
      isFork: false,
      hasReadme: r.hasReadme ?? true,
      hasTests: r.hasTests ?? false,
      hasCiWorkflow: r.hasCiWorkflow ?? false,
      lastPushedAt: r.pushedAt || new Date().toISOString(),
    };
    repoSummaries.push(summary);

    // Identify languages that represent significant code share
    const totalBytes = Object.values(summary.languages).reduce((acc, b) => acc + b, 0);
    const significantLanguages: string[] = [];

    if (totalBytes > 0) {
      for (const [lang, bytes] of Object.entries(summary.languages)) {
        if (bytes / totalBytes > 0.1) {
          significantLanguages.push(lang);
          detectedSkillsSet.add(lang);
        }
      }
    } else if (summary.primaryLanguage) {
      significantLanguages.push(summary.primaryLanguage);
      detectedSkillsSet.add(summary.primaryLanguage);
    }

    // Determine confidence based on concrete engineering artifacts
    let confidence = 0.65;
    if (summary.hasReadme) confidence += 0.05;
    if (summary.hasTests) confidence += 0.10;
    if (summary.hasCiWorkflow) confidence += 0.05;
    confidence = Math.min(confidence, 0.85); // Cap evidence from automated repo scan

    for (const lang of significantLanguages) {
      evidenceItems.push({
        id: `gh_ev_${r.name.toLowerCase().replace(/[^a-z0-9]/g, "_")}_${lang.toLowerCase()}`,
        userId,
        skillId: lang.toLowerCase(),
        skillName: lang,
        source: "GITHUB_REPOSITORY",
        title: `GitHub Repo: ${summary.name} (${lang})`,
        confidence,
        provenance: "SOURCE_VERIFIED",
        status: "CONFIRMED",
        createdAt: new Date().toISOString(),
        description: `Authored repository ${summary.fullName} with verified ${lang} codebase${summary.hasTests ? " and automated test suite" : ""}.`,
        artifactUrl: summary.htmlUrl,
        verificationMetadata: {
          repoName: summary.fullName,
          hasTests: summary.hasTests,
          hasCi: summary.hasCiWorkflow,
          lastActive: summary.lastPushedAt,
        },
      });
    }
  }

  return {
    repoSummaries,
    detectedSkills: Array.from(detectedSkillsSet),
    evidenceItems,
    warnings,
  };
}
