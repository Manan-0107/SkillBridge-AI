/**
 * lib/emails/jobAlert.ts — the job-alert email template, isolated so it can be
 * unit-tested and so EVERY interpolated value is forced through `escapeHtml`.
 *
 * Audit finding C2: the route interpolated `name`, `job.*` and `applyUrl`
 * straight into an HTML string sent via Resend → HTML/content injection and
 * (via `href="${applyUrl}"`) link spoofing from CareerForge's sending domain.
 */

/** Escape the five HTML-significant characters. Safe for text and double-quoted attribute contexts. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Only allow http(s) links in `href`; anything else (javascript:, data:, …) collapses to "#". */
export function safeUrl(value: unknown): string {
  const raw = String(value ?? "").trim();
  try {
    const u = new URL(raw);
    if (u.protocol === "http:" || u.protocol === "https:") return raw;
  } catch {
    /* not an absolute URL */
  }
  return "#";
}

export interface JobAlertJob {
  title?: string;
  company?: string;
  location?: string;
  salary?: { formatted?: string };
  applyUrl?: string;
  url?: string;
  descriptionSnippet?: string;
  jobType?: string;
}

export interface JobAlertParams {
  /** Display name for the greeting — free text, escaped. */
  recipientName: string;
  role?: string;
  location?: string;
  job?: JobAlertJob;
}

export function renderJobAlertEmail(params: JobAlertParams): { subject: string; html: string } {
  const { job } = params;

  // Resolve every value, then escape. `applyLink` also gets a scheme check.
  const name = escapeHtml(params.recipientName || "there");
  const jobTitle = escapeHtml(job?.title || `${params.role || "Software Engineering"} Opportunity`);
  const company = escapeHtml(job?.company || "a hiring company");
  const jobLoc = escapeHtml(job?.location || params.location || "your area");
  const jobType = escapeHtml(job?.jobType || "Full-Time");
  const salary = escapeHtml(job?.salary?.formatted || "Competitive market compensation");
  const snippet = escapeHtml(
    job?.descriptionSnippet ||
      "Work with leading engineering teams on scalable architectures and modern interfaces."
  );
  const applyLink = escapeHtml(safeUrl(job?.applyUrl || job?.url || "https://www.linkedin.com/jobs/"));

  const subject = `New opening in ${jobLoc}: ${jobTitle} at ${company}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 16px; background-color: #ffffff; color: #111827;">
      <div style="border-bottom: 2px solid #0066cc; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #111827; font-size: 20px;">CareerForge Job Alert</h2>
      </div>

      <p style="font-size: 15px; line-height: 1.5; color: #374151;">Hello <strong>${name}</strong>,</p>
      <p style="font-size: 14px; line-height: 1.5; color: #4b5563;">
        A new position matching your tracked location (<strong>${jobLoc}</strong>) and target role has opened up:
      </p>

      <div style="background-color: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 18px; margin: 20px 0;">
        <h3 style="margin: 0 0 6px 0; color: #111827; font-size: 17px;">${jobTitle}</h3>
        <p style="margin: 0 0 10px 0; color: #4b5563; font-size: 13px; font-weight: 600;">
          ${company} &nbsp;&middot;&nbsp; ${jobLoc} &nbsp;&middot;&nbsp; ${jobType}
        </p>
        <p style="margin: 0 0 12px 0; color: #059669; font-size: 13px; font-weight: 700;">Compensation: ${salary}</p>
        <p style="margin: 0; color: #6b7280; font-size: 12px; line-height: 1.5;">${snippet}</p>
      </div>

      <div style="text-align: center; margin: 28px 0;">
        <a href="${applyLink}" target="_blank" rel="noopener noreferrer" style="background-color: #111827; color: #ffffff; padding: 12px 28px; font-size: 14px; font-weight: 600; text-decoration: none; border-radius: 8px; display: inline-block;">
          Open the job posting
        </a>
      </div>

      <p style="font-size: 12px; color: #6b7280; text-align: center; margin-top: 24px; border-top: 1px solid #f3f4f6; padding-top: 16px;">
        Direct link: <a href="${applyLink}" target="_blank" rel="noopener noreferrer" style="color: #0066cc; word-break: break-all;">${applyLink}</a>
      </p>
      <p style="font-size: 11px; color: #9ca3af; text-align: center; margin-top: 12px;">
        You received this because job alerts are active on your CareerForge account.
      </p>
    </div>
  `;

  return { subject, html };
}
