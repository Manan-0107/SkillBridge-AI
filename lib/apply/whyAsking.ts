/**
 * lib/apply/whyAsking.ts
 *
 * UBIX "Why is UBIX asking this?" Explanation Engine
 *
 * Delivers radical transparency for every profile attribute, job application field,
 * and sensitive demographic question.
 *
 * Contract:
 * - Purpose: Exactly why the data is being requested.
 * - Whether Optional: Clear boolean flag.
 * - Where used: Specific screen, document, or API payload.
 * - Whether stored: Local transient memory vs encrypted database.
 * - Who receives it: UBIX internal vs external ATS employer.
 * - Whether user can skip: Guarantees user sovereignty.
 */

export interface FieldExplanation {
  fieldKey: string;
  fieldLabel: string;
  purpose: string;
  isOptional: boolean;
  canSkip: boolean;
  whereUsed: string;
  isStored: boolean;
  storageRetentionPolicy: string;
  whoReceivesIt: string;
  sensitiveCategory?: "DEMOGRAPHIC" | "FINANCIAL" | "LEGAL_STATUS" | "CONTACT";
}

const KNOWN_FIELD_EXPLANATIONS: Record<string, Omit<FieldExplanation, "fieldKey">> = {
  fullName: {
    fieldLabel: "Full Name",
    purpose: "Required by employers to address your application and identify you on interview correspondence.",
    isOptional: false,
    canSkip: false,
    whereUsed: "Job application header and resume top section.",
    isStored: true,
    storageRetentionPolicy: "Stored in your encrypted user profile until account deletion.",
    whoReceivesIt: "The hiring company's ATS portal.",
    sensitiveCategory: "CONTACT",
  },
  email: {
    fieldLabel: "Email Address",
    purpose: "Used by employers for automated confirmation receipts, status updates, and interview invites.",
    isOptional: false,
    canSkip: false,
    whereUsed: "Employer ATS contact record.",
    isStored: true,
    storageRetentionPolicy: "Encrypted at rest.",
    whoReceivesIt: "Target employer ATS.",
    sensitiveCategory: "CONTACT",
  },
  phone: {
    fieldLabel: "Phone Number",
    purpose: "Secondary contact method for recruiters seeking quick phone screens.",
    isOptional: true,
    canSkip: true,
    whereUsed: "Application contact fields.",
    isStored: true,
    storageRetentionPolicy: "Encrypted at rest.",
    whoReceivesIt: "Target employer ATS (if provided).",
    sensitiveCategory: "CONTACT",
  },
  workAuthorizationStatus: {
    fieldLabel: "Work Authorization",
    purpose: "Mandatory compliance question asked by employers to verify legal right to work.",
    isOptional: false,
    canSkip: false,
    whereUsed: "ATS legal questionnaire.",
    isStored: true,
    storageRetentionPolicy: "Encrypted at rest.",
    whoReceivesIt: "Target employer HR & immigration compliance teams.",
    sensitiveCategory: "LEGAL_STATUS",
  },
  disabilityAccommodationNotes: {
    fieldLabel: "Accommodation Request",
    purpose: "Allows UBIX and the employer to provide accessible interview formats (e.g. ASL, captions, screen-reader assessments).",
    isOptional: true,
    canSkip: true,
    whereUsed: "Accommodations field on supported ATS portals.",
    isStored: true,
    storageRetentionPolicy: "Stored strictly in your client-controlled Accessibility Passport.",
    whoReceivesIt: "Employer accommodations coordinator only with your explicit permission.",
    sensitiveCategory: "DEMOGRAPHIC",
  },
  eeoGender: {
    fieldLabel: "Gender Disclosure (EEO)",
    purpose: "Voluntary US government compliance reporting for equal opportunity monitoring. Never used in hiring decisions.",
    isOptional: true,
    canSkip: true,
    whereUsed: "Separate anonymized EEO section of ATS submission.",
    isStored: false,
    storageRetentionPolicy: "Not retained permanently unless explicitly saved in profile.",
    whoReceivesIt: "Aggregated anonymized employer compliance report.",
    sensitiveCategory: "DEMOGRAPHIC",
  },
  eeoDisability: {
    fieldLabel: "Disability Status (EEO Form CC-305)",
    purpose: "Voluntary federal self-identification under Section 503 of the Rehabilitation Act.",
    isOptional: true,
    canSkip: true,
    whereUsed: "Voluntary federal self-identification form.",
    isStored: false,
    storageRetentionPolicy: "Transient only; never displayed on public profile.",
    whoReceivesIt: "Federal EEO compliance repository (anonymized).",
    sensitiveCategory: "DEMOGRAPHIC",
  },
};

/**
 * Returns a factual explanation for why a given field is requested.
 */
export function explainWhyAsking(fieldKey: string): FieldExplanation {
  const known = KNOWN_FIELD_EXPLANATIONS[fieldKey];
  if (known) {
    return {
      fieldKey,
      ...known,
    };
  }

  return {
    fieldKey,
    fieldLabel: fieldKey,
    purpose: "Requested by the target employer's specific application form.",
    isOptional: true,
    canSkip: true,
    whereUsed: "Application form payload.",
    isStored: false,
    storageRetentionPolicy: "Transient application draft.",
    whoReceivesIt: "The employer receiving your application.",
  };
}
