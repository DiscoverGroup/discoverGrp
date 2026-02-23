/**
 * SecureForm.tsx
 * Drop-in replacement for <form> that adds three layers of client-side protection:
 *
 *  1. Canary / honeypot check — hidden fields filled ↔ bot detected → silent drop
 *  2. Submission rate-limit  — debounces rapid-fire bot submits (≥ 800 ms)
 *  3. Oversized payload guard — rejects any single field > 10 KB
 *
 * Usage:  <SecureForm onSubmit={handler} className="...">
 *           ...your fields...
 *         </SecureForm>
 */

import React, { useRef } from 'react';
import { isCanaryTripped } from '../utils/formSecurity';

const MIN_SUBMIT_INTERVAL_MS = 800;
const MAX_FIELD_LENGTH = 10_000;

export interface SecureFormProps extends React.FormHTMLAttributes<HTMLFormElement> {
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => void;
  children: React.ReactNode;
}

const SecureForm: React.FC<SecureFormProps> = ({ onSubmit, children, ...rest }) => {
  const lastSubmit = useRef<number>(0);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    const form = e.currentTarget;

    // 1. Canary honeypot — bots auto-fill hidden fields, humans don't
    if (isCanaryTripped(form)) {
      e.preventDefault();
      return; // silent drop — never tell the bot it was blocked
    }

    // 2. Rate-limit — stop rapid-fire bot retries
    const now = Date.now();
    if (now - lastSubmit.current < MIN_SUBMIT_INTERVAL_MS) {
      e.preventDefault();
      return;
    }
    lastSubmit.current = now;

    // 3. Oversized payload guard — prevent memory-exhaustion via huge inputs
    const inputs = form.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      'input[type="text"], input[type="email"], input[type="password"], input[type="search"], input:not([type]), textarea'
    );
    for (const field of Array.from(inputs)) {
      if (field.value.length > MAX_FIELD_LENGTH) {
        e.preventDefault();
        return;
      }
    }

    onSubmit(e);
  };

  return (
    <form {...rest} onSubmit={handleSubmit}>
      {children}
    </form>
  );
};

export default SecureForm;
