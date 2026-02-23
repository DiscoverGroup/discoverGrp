/**
 * formSecurity.ts
 * Client-side form sanitization helpers — defence-in-depth layer
 * (backend already sanitizes; this stops garbage reaching the wire)
 */

const MAX_FIELD_LENGTH = 10_000; // 10 KB hard cap per field

/**
 * Strip HTML/script injection patterns, collapse unicode homoglyphs,
 * and cap length.  Safe for text / email / textarea onChange handlers.
 */
export function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')           // strip HTML tags
    .replace(/javascript\s*:/gi, '')   // strip JS: protocol
    .replace(/on\w+\s*=/gi, '')        // strip inline event handlers
    .replace(/data\s*:/gi, '')         // strip data: URIs
    .normalize('NFKC')                 // collapse unicode homoglyphs
    .slice(0, MAX_FIELD_LENGTH);
}

/** Lower-case + trim on top of sanitizeText — for email fields */
export function sanitizeEmail(value: string): string {
  return sanitizeText(value).toLowerCase().trim();
}

/** Only pass through http/https URLs; everything else becomes '' */
export function sanitizeUrl(value: string): string {
  const clean = sanitizeText(value).trim();
  if (clean && !/^https?:\/\//i.test(clean)) return '';
  return clean;
}

/**
 * Returns true when a bot has filled one of the hidden canary fields.
 * Call this inside handleSubmit — if true, silently abort.
 */
export function isCanaryTripped(form: HTMLFormElement): boolean {
  const website = (form.querySelector('input[name="website"]') as HTMLInputElement | null)?.value;
  const phone2  = (form.querySelector('input[name="phone_number_2"]') as HTMLInputElement | null)?.value;
  return !!(website || phone2);
}
