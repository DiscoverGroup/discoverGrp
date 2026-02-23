/**
 * formSecurity.ts — admin panel copy
 * Client-side form sanitization helpers (defence-in-depth layer).
 * The backend already sanitizes; this stops garbage reaching the wire.
 */

const MAX_FIELD_LENGTH = 10_000;

export function sanitizeText(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .replace(/data\s*:/gi, '')
    .normalize('NFKC')
    .slice(0, MAX_FIELD_LENGTH);
}

export function sanitizeEmail(value: string): string {
  return sanitizeText(value).toLowerCase().trim();
}

export function sanitizeUrl(value: string): string {
  const clean = sanitizeText(value).trim();
  if (clean && !/^https?:\/\//i.test(clean)) return '';
  return clean;
}

export function isCanaryTripped(form: HTMLFormElement): boolean {
  const website = (form.querySelector('input[name="website"]') as HTMLInputElement | null)?.value;
  const phone2  = (form.querySelector('input[name="phone_number_2"]') as HTMLInputElement | null)?.value;
  return !!(website || phone2);
}
