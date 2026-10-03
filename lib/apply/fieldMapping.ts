/**
 * lib/apply/fieldMapping.ts
 *
 * UBIX Privacy-Preserving Field Mapping & Minimization Engine
 *
 * Maps candidate profile data to target ATS schema while pruning unnecessary,
 * intrusive, or unverified attributes before external submission.
 *
 * Invariant: Never exports unrequested or unnecessary fields to external portals.
 */

import { CandidateApplyProfile, MappedApplicationField, FieldNecessity } from "./schemas";
import { explainWhyAsking } from "./whyAsking";

export interface TargetFormSpecification {
  portal: "greenhouse" | "lever" | "workday" | "generic_direct";
  requiredFieldKeys: string[];
  optionalFieldKeys: string[];
}

/**
 * Standard schemas for major ATS portals
 */
export const TARGET_PORTAL_SPECS: Record<string, TargetFormSpecification> = {
  greenhouse: {
    portal: "greenhouse",
    requiredFieldKeys: ["first_name", "last_name", "email"],
    optionalFieldKeys: ["phone", "resume", "linkedin_url", "github_url", "accommodations"],
  },
  lever: {
    portal: "lever",
    requiredFieldKeys: ["name", "email"],
    optionalFieldKeys: ["phone", "resume", "urls", "comments"],
  },
  workday: {
    portal: "workday",
    requiredFieldKeys: ["legal_name", "email", "address_city", "country", "work_auth"],
    optionalFieldKeys: ["phone", "resume", "diversity_survey"],
  },
  generic_direct: {
    portal: "generic_direct",
    requiredFieldKeys: ["full_name", "email"],
    optionalFieldKeys: ["phone", "portfolio_url"],
  },
};

/**
 * Maps a candidate profile against target ATS requirements with privacy minimization.
 */
export function mapAndMinimizeProfileFields(
  profile: CandidateApplyProfile,
  portal: "greenhouse" | "lever" | "workday" | "generic_direct"
): {
  mappedFields: MappedApplicationField[];
  missingRequired: string[];
  prunedUnnecessary: string[];
} {
  const spec = TARGET_PORTAL_SPECS[portal] || TARGET_PORTAL_SPECS.generic_direct;
  const mappedFields: MappedApplicationField[] = [];
  const missingRequired: string[] = [];
  const prunedUnnecessary: string[] = [];

  // Helper to determine necessity
  const checkNecessity = (portalKey: string): FieldNecessity => {
    if (spec.requiredFieldKeys.includes(portalKey)) return "REQUIRED";
    if (spec.optionalFieldKeys.includes(portalKey)) return "OPTIONAL";
    return "UNNECESSARY";
  };

  // Full Name handling
  const nameNecessity = checkNecessity("first_name") !== "UNNECESSARY" || checkNecessity("name") !== "UNNECESSARY" || checkNecessity("legal_name") !== "UNNECESSARY" || checkNecessity("full_name") !== "UNNECESSARY" ? "REQUIRED" : "OPTIONAL";
  if (!profile.fullName) {
    missingRequired.push("Full Name");
  } else {
    mappedFields.push({
      externalFieldKey: portal === "greenhouse" ? "first_name" : "name",
      externalFieldLabel: "Full Name",
      mappedValue: profile.fullName,
      necessity: nameNecessity,
      isSensitive: false,
      purposeRationale: explainWhyAsking("fullName").purpose,
      userApproved: true,
    });
  }

  // Email handling
  if (!profile.email) {
    missingRequired.push("Email");
  } else {
    mappedFields.push({
      externalFieldKey: "email",
      externalFieldLabel: "Email Address",
      mappedValue: profile.email,
      necessity: "REQUIRED",
      isSensitive: false,
      purposeRationale: explainWhyAsking("email").purpose,
      userApproved: true,
    });
  }

  // Phone handling
  const phoneNec = checkNecessity("phone");
  if (phoneNec !== "UNNECESSARY" && profile.phone) {
    mappedFields.push({
      externalFieldKey: "phone",
      externalFieldLabel: "Phone Number",
      mappedValue: profile.phone,
      necessity: phoneNec,
      isSensitive: false,
      purposeRationale: explainWhyAsking("phone").purpose,
      userApproved: true,
    });
  } else if (profile.phone && phoneNec === "UNNECESSARY") {
    prunedUnnecessary.push("Phone (not requested by portal)");
  }

  // Work Authorization
  const workAuthNec = checkNecessity("work_auth");
  if (workAuthNec !== "UNNECESSARY") {
    if (profile.workAuthorizationStatus === "UNKNOWN") {
      missingRequired.push("Work Authorization");
    } else {
      mappedFields.push({
        externalFieldKey: "work_auth",
        externalFieldLabel: "Work Authorization",
        mappedValue: profile.workAuthorizationStatus,
        necessity: workAuthNec,
        isSensitive: true,
        purposeRationale: explainWhyAsking("workAuthorizationStatus").purpose,
        userApproved: true,
      });
    }
  }

  // Accommodations (Strictly opt-in)
  if (profile.disabilityAccommodationNotes) {
    mappedFields.push({
      externalFieldKey: "accommodations",
      externalFieldLabel: "Interview Accommodations Request",
      mappedValue: profile.disabilityAccommodationNotes,
      necessity: "OPTIONAL",
      isSensitive: true,
      purposeRationale: explainWhyAsking("disabilityAccommodationNotes").purpose,
      userApproved: true,
    });
  }

  // Pruning demo/financial attributes if portal doesn't ask
  if (profile.eeoDisclosures && !spec.optionalFieldKeys.includes("diversity_survey")) {
    prunedUnnecessary.push("EEO Disclosures (portal does not support or request)");
  }

  return {
    mappedFields,
    missingRequired,
    prunedUnnecessary,
  };
}
