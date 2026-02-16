/**
 * Payment Security Utilities
 * Handles validation, verification, and security checks for payment operations
 */

import type { Booking, InstallmentPayment } from "../types";

// Rate limiting map to track payment attempts
const paymentAttempts = new Map<string, { count: number; lastAttempt: number }>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute
const MAX_ATTEMPTS = 3;

/**
 * Validates payment amount against booking details
 */
export function validatePaymentAmount(
  booking: Booking,
  requestedAmount: number,
  installmentPayment?: InstallmentPayment
): { valid: boolean; error?: string } {
  // Check if amount is positive
  if (requestedAmount <= 0) {
    return { valid: false, error: "Payment amount must be greater than zero" };
  }

  // Check if amount has suspicious precision (potential tampering)
  if (!Number.isFinite(requestedAmount) || requestedAmount.toString().includes('e')) {
    return { valid: false, error: "Invalid payment amount format" };
  }

  const remainingBalance = booking.totalAmount - booking.paidAmount;

  // For installment payments, verify the amount matches
  if (installmentPayment) {
    const tolerance = 0.01; // Allow 1 cent tolerance for rounding
    if (Math.abs(requestedAmount - installmentPayment.amount) > tolerance) {
      return { valid: false, error: "Payment amount does not match installment due" };
    }

    // Verify installment hasn't been paid already
    if (installmentPayment.status === "paid") {
      return { valid: false, error: "This installment has already been paid" };
    }
  } else {
    // For balance payments, verify amount doesn't exceed remaining balance
    if (requestedAmount > remainingBalance + 0.01) {
      return { valid: false, error: "Payment amount exceeds remaining balance" };
    }
  }

  return { valid: true };
}

/**
 * Verifies booking ownership and payment eligibility
 */
export function verifyPaymentEligibility(
  booking: Booking,
  userEmail?: string
): { eligible: boolean; error?: string } {
  // Verify booking exists
  if (!booking || !booking.id) {
    return { eligible: false, error: "Invalid booking reference" };
  }

  // Verify booking is not cancelled
  if (booking.status === "cancelled") {
    return { eligible: false, error: "Cannot make payment on cancelled booking" };
  }

  // Verify booking is not already fully paid
  if (booking.paidAmount >= booking.totalAmount) {
    return { eligible: false, error: "This booking is already fully paid" };
  }

  // Verify user owns this booking (if email provided)
  if (userEmail && booking.customerEmail.toLowerCase() !== userEmail.toLowerCase()) {
    return { eligible: false, error: "Unauthorized: This booking belongs to another user" };
  }

  // Verify travel date hasn't passed
  const travelDate = new Date(booking.selectedDate);
  const today = new Date();
  if (travelDate < today) {
    return { eligible: false, error: "Cannot make payment for past travel dates" };
  }

  return { eligible: true };
}

/**
 * Rate limiting for payment attempts
 */
export function checkRateLimit(bookingId: string): { allowed: boolean; error?: string } {
  const now = Date.now();
  const attempt = paymentAttempts.get(bookingId);

  if (attempt) {
    // Reset if outside window
    if (now - attempt.lastAttempt > RATE_LIMIT_WINDOW) {
      paymentAttempts.set(bookingId, { count: 1, lastAttempt: now });
      return { allowed: true };
    }

    // Check if exceeded limit
    if (attempt.count >= MAX_ATTEMPTS) {
      const timeLeft = Math.ceil((RATE_LIMIT_WINDOW - (now - attempt.lastAttempt)) / 1000);
      return {
        allowed: false,
        error: `Too many payment attempts. Please try again in ${timeLeft} seconds`,
      };
    }

    // Increment attempt count
    paymentAttempts.set(bookingId, { count: attempt.count + 1, lastAttempt: now });
  } else {
    // First attempt
    paymentAttempts.set(bookingId, { count: 1, lastAttempt: now });
  }

  return { allowed: true };
}

/**
 * Sanitize and validate payment intent ID
 */
export function validatePaymentIntentId(paymentIntentId: string): boolean {
  if (!paymentIntentId || typeof paymentIntentId !== "string") {
    return false;
  }

  // Payment intent ID should follow a specific format
  const validPatterns = [
    /^pm_[a-z]+_\d+_[a-z0-9]{7}$/i, // PayMongo format
    /^dp_[a-z]+_\d+_[a-z0-9]{7}$/i, // Dragonpay format
  ];

  return validPatterns.some((pattern) => pattern.test(paymentIntentId));
}

/**
 * Generate secure payment fingerprint for verification
 */
export function generatePaymentFingerprint(
  bookingId: string,
  amount: number,
  timestamp: number
): string {
  // In production, use a proper HMAC with secret key
  const data = `${bookingId}:${amount}:${timestamp}`;
  // Simple hash for demo (use crypto.subtle.digest in production)
  let hash = 0;
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * Verify payment fingerprint
 */
export function verifyPaymentFingerprint(
  bookingId: string,
  amount: number,
  timestamp: number,
  fingerprint: string
): boolean {
  const expectedFingerprint = generatePaymentFingerprint(bookingId, amount, timestamp);
  return fingerprint === expectedFingerprint;
}

/**
 * Prevent duplicate payment submissions
 */
const recentPayments = new Map<string, number>();
const DUPLICATE_WINDOW = 5000; // 5 seconds

export function preventDuplicatePayment(
  bookingId: string,
  paymentIntentId: string
): { allowed: boolean; error?: string } {
  const key = `${bookingId}:${paymentIntentId}`;
  const lastPayment = recentPayments.get(key);
  const now = Date.now();

  if (lastPayment && now - lastPayment < DUPLICATE_WINDOW) {
    return { allowed: false, error: "Duplicate payment detected. Please wait." };
  }

  recentPayments.set(key, now);

  // Cleanup old entries
  setTimeout(() => recentPayments.delete(key), DUPLICATE_WINDOW);

  return { allowed: true };
}

/**
 * Comprehensive payment security check
 */
export function performSecurityCheck(
  booking: Booking,
  requestedAmount: number,
  userEmail?: string,
  installmentPayment?: InstallmentPayment
): { passed: boolean; error?: string } {
  // 1. Rate limiting
  const rateCheck = checkRateLimit(booking.bookingId);
  if (!rateCheck.allowed) {
    return { passed: false, error: rateCheck.error };
  }

  // 2. Payment eligibility
  const eligibilityCheck = verifyPaymentEligibility(booking, userEmail);
  if (!eligibilityCheck.eligible) {
    return { passed: false, error: eligibilityCheck.error };
  }

  // 3. Amount validation
  const amountCheck = validatePaymentAmount(booking, requestedAmount, installmentPayment);
  if (!amountCheck.valid) {
    return { passed: false, error: amountCheck.error };
  }

  return { passed: true };
}

/**
 * Log security event for audit trail
 */
export function logSecurityEvent(
  event: string,
  bookingId: string,
  details: Record<string, unknown>
): void {
  const timestamp = new Date().toISOString();
  console.warn(`🔒 [SECURITY] ${timestamp} - ${event}:`, {
    bookingId,
    ...details,
  });

  // In production, send to security monitoring service
}
