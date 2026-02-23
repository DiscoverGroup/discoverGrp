/**
 * SecureForm.tsx — admin panel
 * Drop-in replacement for <form>. Adds:
 *  1. Canary / honeypot check
 *  2. Submission rate-limit (800 ms debounce)
 *  3. Oversized payload guard (10 KB per field)
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

    if (isCanaryTripped(form)) {
      e.preventDefault();
      return;
    }

    const now = Date.now();
    if (now - lastSubmit.current < MIN_SUBMIT_INTERVAL_MS) {
      e.preventDefault();
      return;
    }
    lastSubmit.current = now;

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
