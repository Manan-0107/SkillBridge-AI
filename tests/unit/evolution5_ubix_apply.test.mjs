/**
 * tests/unit/evolution5_ubix_apply.test.mjs
 *
 * Unit tests verifying Evolution 5:
 * - "Why is UBIX asking this?" Radical Transparency
 * - Privacy-Preserving Field Mapping & Minimization
 * - UBIX Apply Review-First Application Lifecycle
 * - Non-Negotiable Protection against Silent Submissions
 * - Verified Provider Receipt Verification
 */

import test from "node:test";
import assert from "node:assert/strict";

import { explainWhyAsking } from "../../lib/apply/whyAsking.ts";
import { mapAndMinimizeProfileFields } from "../../lib/apply/fieldMapping.ts";
import {
  prepareApplicationDraft,
  requestUserConfirmation,
  submitConfirmedApplication,
} from "../../lib/apply/ubixApply.ts";

test("WhyAsking: returns transparent explanations and skip controls for sensitive fields", () => {
  const nameExpl = explainWhyAsking("fullName");
  assert.equal(nameExpl.isOptional, false);
  assert.ok(nameExpl.purpose.includes("address your application"));
  assert.ok(nameExpl.whoReceivesIt.includes("ATS portal"));

  const accomExpl = explainWhyAsking("disabilityAccommodationNotes");
  assert.equal(accomExpl.isOptional, true);
  assert.equal(accomExpl.canSkip, true);
  assert.ok(accomExpl.whereUsed.includes("Accommodations"));
});

test("FieldMapping: minimizes payload and prunes unrequested information", () => {
  const profile = {
    userId: "u123",
    fullName: "Alex Mercer",
    email: "alex@example.com",
    phone: "+1-555-0199",
    locationCity: "New York",
    locationCountry: "USA",
    resumeBulletPoints: ["Built scalable services"],
    confirmedSkills: ["TypeScript", "Docker"],
    workAuthorizationStatus: "CITIZEN",
    eeoDisclosures: {
      gender: "Non-binary",
    },
  };

  const { mappedFields, missingRequired, prunedUnnecessary } = mapAndMinimizeProfileFields(
    profile,
    "greenhouse"
  );

  assert.equal(missingRequired.length, 0);
  assert.ok(mappedFields.some((f) => f.externalFieldKey === "first_name" && f.mappedValue === "Alex Mercer"));
  assert.ok(mappedFields.some((f) => f.externalFieldKey === "email" && f.mappedValue === "alex@example.com"));

  // EEO should be pruned because Greenhouse harvest basic form does not request it
  assert.ok(prunedUnnecessary.some((p) => p.includes("EEO Disclosures")));
});

test("UbixApply: enforces REVIEW FIRST and rejects silent submission without confirmation token", async () => {
  const profile = {
    userId: "u123",
    fullName: "Alex Mercer",
    email: "alex@example.com",
    locationCity: "New York",
    locationCountry: "USA",
    resumeBulletPoints: [],
    confirmedSkills: [],
    workAuthorizationStatus: "CITIZEN",
  };

  const draft = prepareApplicationDraft({
    userId: "u123",
    jobId: "job_gh_456",
    jobTitle: "Senior Platform Engineer",
    company: "Stripe",
    sourceProvider: "greenhouse",
    candidateProfile: profile,
  });

  // 1. Initial draft is READY_FOR_REVIEW, NOT submitted
  assert.equal(draft.status, "READY_FOR_REVIEW");
  assert.equal(draft.userConfirmationToken, undefined);

  // 2. Attempting to submit without confirmation must fail
  await assert.rejects(
    async () => {
      await submitConfirmedApplication(draft, "forged_token");
    },
    /REJECTED: Application must be in WAITING_FOR_CONFIRMATION state/
  );

  // 3. User reviews and generates confirmation token
  const confirmedDraft = requestUserConfirmation(draft);
  assert.equal(confirmedDraft.status, "WAITING_FOR_CONFIRMATION");
  assert.ok(confirmedDraft.userConfirmationToken?.startsWith("CONFIRM_APPLY_"));

  // 4. Submitting with wrong token must fail
  await assert.rejects(
    async () => {
      await submitConfirmedApplication(confirmedDraft, "wrong_token");
    },
    /REJECTED: Invalid or forged confirmation token/
  );

  // 5. Submitting with the exact token succeeds and returns provider receipt
  const { draft: submittedDraft, result } = await submitConfirmedApplication(
    confirmedDraft,
    confirmedDraft.userConfirmationToken
  );

  assert.equal(submittedDraft.status, "SUBMITTED");
  assert.ok(submittedDraft.providerSubmissionConfirmationId?.startsWith("gh_app_"));
  assert.equal(result.success, true);
});
