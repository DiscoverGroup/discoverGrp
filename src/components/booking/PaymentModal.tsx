import React, { useState, Suspense, lazy, useEffect, useMemo, useCallback } from "react";
import type { Booking, InstallmentPayment } from "../../types";
import type { PaymentMethod } from "../../lib/payment-gateway";
import type { PaymentProvider } from "../../types/payment";
import {
  performSecurityCheck,
  validatePaymentIntentId,
  preventDuplicatePayment,
  generatePaymentFingerprint,
  logSecurityEvent,
} from "../../utils/paymentSecurity";
import { paymentService } from "../../services/paymentService";
import { getProviderStatus } from "../../services/providers";

const PaymentMethodSelector = lazy(async () => {
  const mod = await import("../../lib/payment-gateway");
  return { default: mod.PaymentMethodSelector };
});

const PayMongoMockup = lazy(async () => {
  const mod = await import("../PaymentMockup");
  return { default: mod.PayMongoMockup };
});

const DragonpayMockup = lazy(async () => {
  const mod = await import("../PaymentMockup");
  return { default: mod.DragonpayMockup };
});

const GATEWAY_PAYMONGO = "paymongo" as const;
const GATEWAY_DRAGONPAY = "dragonpay" as const;

function formatCurrencyPHP(amount: number) {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface PaymentModalProps {
  booking: Booking;
  installmentPayment?: InstallmentPayment;
  customAmount?: number;
  onClose: () => void;
  onSuccess: (paymentId: string) => void;
}

export default function PaymentModal({
  booking,
  installmentPayment,
  customAmount,
  onClose,
  onSuccess,
}: PaymentModalProps) {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentMethod["gateway"] | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [step, setStep] = useState<"select" | "pay">("select");
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get provider status
  const providerStatus = useMemo(() => getProviderStatus(), []);
  const isRealPaymentMode = useMemo(() => providerStatus.mode !== "demo", [providerStatus.mode]);

  // Memoize calculations to prevent unnecessary re-renders
  const remainingBalance = useMemo(() => booking.totalAmount - booking.paidAmount, [booking.totalAmount, booking.paidAmount]);
  const paymentAmount = useMemo(() => customAmount || installmentPayment?.amount || remainingBalance, [customAmount, installmentPayment?.amount, remainingBalance]);
  
  // Get current user email from storage
  const userEmail = useMemo(() => {
    try {
      const stored = localStorage.getItem("currentUser");
      if (stored) {
        const user = JSON.parse(stored);
        return user.email;
      }
    } catch (err) {
      console.error("Error getting user email:", err);
    }
    return undefined;
  }, []);
  
  // Generate security fingerprint on mount
  useEffect(() => {
    const timestamp = Date.now();
    const fingerprint = generatePaymentFingerprint(booking.bookingId, paymentAmount, timestamp);
    setPaymentFingerprint(fingerprint);
  }, [booking.bookingId, paymentAmount]);
  
  // Perform initial security check
  useEffect(() => {
    const securityCheck = performSecurityCheck(
      booking,
      paymentAmount,
      userEmail,
      installmentPayment
    );
    
    if (!securityCheck.passed) {
      setError(securityCheck.error || "Security check failed");
      logSecurityEvent("SECURITY_CHECK_FAILED", booking.bookingId, {
        error: securityCheck.error,
        amount: paymentAmount,
        userEmail,
      });
    }
  }, [booking, paymentAmount, userEmail, installmentPayment]);

  const handlePaymentSuccess = useCallback((paymentId: string) => {
    // Validate payment intent ID format
    if (!validatePaymentIntentId(paymentId)) {
      setError("Invalid payment confirmation. Please contact support.");
      logSecurityEvent("INVALID_PAYMENT_ID", booking.bookingId, { paymentId });
      return;
    }
    
    // Prevent duplicate submissions
    const duplicateCheck = preventDuplicatePayment(booking.bookingId, paymentId);
    if (!duplicateCheck.allowed) {
      setError(duplicateCheck.error || "Duplicate payment detected");
      return;
    }
    
    // Log successful payment
    logSecurityEvent("PAYMENT_SUCCESS", booking.bookingId, {
      paymentId,
      amount: paymentAmount,
      userEmail,
    });
    
    onSuccess(paymentId);
    onClose();
  }, [booking.bookingId, paymentAmount, userEmail, onSuccess, onClose]);
  
  const handleProceedToPayment = useCallback(async () => {
    setError(null);
    
    // Re-validate before proceeding
    const securityCheck = performSecurityCheck(
      booking,
      paymentAmount,
      userEmail,
      installmentPayment
    );
    
    if (!securityCheck.passed) {
      setError(securityCheck.error || "Security validation failed");
      logSecurityEvent("PAYMENT_BLOCKED", booking.bookingId, {
        reason: securityCheck.error,
        amount: paymentAmount,
      });
      return;
    }
    
    // If real payment mode, create payment intent
    if (isRealPaymentMode) {
      try {
        setIsProcessing(true);
        
        // Determine provider based on selected gateway
        let provider: PaymentProvider = providerStatus.defaultProvider as PaymentProvider;
        if (selectedGateway === GATEWAY_PAYMONGO) {
          provider = "paymongo";
        } else if (selectedGateway === GATEWAY_DRAGONPAY) {
          provider = "dragonpay";
        }
        
        // Create payment intent
        const paymentIntent = await paymentService.createPayment(
          {
            amount: paymentAmount,
            currency: "PHP",
            description: `Payment for Booking #${booking.bookingId}`,
            metadata: {
              bookingId: booking.bookingId,
              tourId: booking.tour.id,
              tourTitle: booking.tour.title,
              customerEmail: userEmail || booking.customerEmail || "",
              customerName: booking.customerName,
              installmentId: installmentPayment?.id || "",
              paymentType: installmentPayment ? "installment" : "full",
            },
          },
          provider
        );
        
        // If payment has redirect URL, redirect user
        if (paymentIntent.redirectUrl) {
          setPaymentRedirectUrl(paymentIntent.redirectUrl);
          logSecurityEvent("PAYMENT_REDIRECT", booking.bookingId, {
            paymentId: paymentIntent.id,
            provider,
          });
          
          // Open redirect in new window or redirect current page
          window.location.href = paymentIntent.redirectUrl;
          return;
        }
        
        // If no redirect, move to payment step
        setStep("pay");
      } catch (err) {
        console.error("Payment creation failed:", err);
        setError(err instanceof Error ? err.message : "Failed to create payment");
        logSecurityEvent("PAYMENT_ERROR", booking.bookingId, {
          error: err instanceof Error ? err.message : "Unknown error",
        });
      } finally {
        setIsProcessing(false);
      }
    } else {
      // Demo mode - just proceed to mockup
      setStep("pay");
    }
  }, [booking, paymentAmount, userEmail, installmentPayment, isRealPaymentMode, providerStatus.defaultProvider, selectedGateway]);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-6 py-5 rounded-t-3xl flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Make Payment</h2>
            <p className="text-blue-100 text-sm mt-1">Booking #{booking.bookingId}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isProcessing}
            className="p-2 hover:bg-white/20 rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Payment Summary */}
          <div className="bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-2xl p-6 mb-6">
            <h3 className="font-bold text-gray-900 text-lg mb-4">Payment Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Tour Package:</span>
                <span className="font-semibold text-gray-900">{booking.tour.title}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Total Booking Amount:</span>
                <span className="font-semibold text-gray-900">{formatCurrencyPHP(booking.totalAmount)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700">Already Paid:</span>
                <span className="font-semibold text-green-600">{formatCurrencyPHP(booking.paidAmount)}</span>
              </div>
              <div className="flex justify-between items-center pt-3 border-t-2 border-gray-200">
                <span className="text-gray-700">Remaining Balance:</span>
                <span className="font-semibold text-orange-600">{formatCurrencyPHP(remainingBalance)}</span>
              </div>
              {installmentPayment && (
                <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold text-blue-900">Installment Payment</span>
                  </div>
                  <div className="text-sm text-blue-800">
                    Due Date: {new Date(installmentPayment.dueDate).toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })}
                  </div>
                </div>
              )}
              <div className="flex justify-between items-center pt-4 border-t-2 border-blue-300 bg-blue-50 -mx-6 px-6 py-4 -mb-6 rounded-b-2xl">
                <span className="text-xl font-bold text-gray-900">Amount to Pay:</span>
                <span className="text-3xl font-bold text-blue-600">{formatCurrencyPHP(paymentAmount)}</span>
              </div>
            </div>
          </div>
          
          {/* Security Warning */}
          {error && (
            <div className="mb-4 p-4 bg-red-50 border-2 border-red-200 rounded-xl flex items-start gap-3">
              <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div>
                <div className="font-semibold text-red-900 mb-1">Payment Error</div>
                <p className="text-sm text-red-800">{error}</p>
              </div>
            </div>
          )}

          {step === "select" && (
            <>
              {/* Payment Method Selection */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-900 text-lg mb-4">Select Payment Method</h3>
                <Suspense fallback={<div className="py-6 text-center text-gray-700">Loading payment methods...</div>}>
                  <PaymentMethodSelector
                    onSelect={(method) => {
                      setSelectedPaymentMethod(method);
                      setSelectedGateway(method.gateway);
                    }}
                    selectedMethod={selectedPaymentMethod || undefined}
                  />
                </Suspense>
              </div>

              {/* Payment Terms */}
              <div className="mb-6 p-5 bg-gray-50 border-2 border-gray-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="payment-terms"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                    disabled={isProcessing || !!error}
                    className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                  />
                  <label htmlFor="payment-terms" className="text-sm text-gray-900 cursor-pointer">
                    <span className="font-semibold">I agree to process this payment</span>
                    <div className="mt-2 space-y-1 text-gray-700">
                      <p>• Payment will be processed securely through our payment partner</p>
                      <p>• This payment is non-refundable once processed</p>
                      <p>• Payment confirmation will be sent to your email</p>
                      <p>• I verify that all payment details are correct</p>
                    </div>
                  </label>
                </div>
              </div>
              
              {/* Security Notice */}
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
                <div className="text-sm text-green-900">
                  <div className="font-semibold mb-1">🔒 Secure Payment</div>
                  <p className="text-green-800">Your payment is protected with bank-level encryption. We never store your card details.</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  disabled={isProcessing}
                  className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-900 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleProceedToPayment}
                  disabled={!selectedPaymentMethod || !acceptedTerms || isProcessing || !!error}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Processing...
                    </>
                  ) : (
                    "Proceed to Payment"
                  )}
                </button>
              </div>
            </>
          )}

          {step === "pay" && selectedPaymentMethod && (
            <>
              {/* Payment Mode Notice */}
              <div className={`mb-6 p-4 border rounded-xl flex items-start gap-3 ${
                isRealPaymentMode 
                  ? "bg-green-50 border-green-200" 
                  : "bg-blue-500/10 border-blue-500/30"
              }`}>
                <svg className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                  isRealPaymentMode ? "text-green-600" : "text-blue-400"
                }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isRealPaymentMode ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  )}
                </svg>
                <div className="text-sm">
                  <div className={`font-semibold mb-1 ${
                    isRealPaymentMode ? "text-green-900" : "text-blue-300"
                  }`}>
                    {isRealPaymentMode ? "🔒 Live Payment Mode" : "Demo Payment Gateway"}
                  </div>
                  <p className={isRealPaymentMode ? "text-green-800" : "text-blue-200/80"}>
                    {isRealPaymentMode 
                      ? `Processing real payment through ${providerStatus.defaultProvider}. Your payment will be charged.`
                      : "This is a simulated payment. Click \"Complete Payment\" to process. No real charges will occur."
                    }
                  </p>
                </div>
              </div>

              {/* Payment Gateway */}
              <Suspense fallback={<div className="py-6 text-center text-gray-700">Loading payment gateway...</div>}>
                {selectedGateway === GATEWAY_PAYMONGO && (
                  <PayMongoMockup
                    amount={paymentAmount}
                    paymentMethod={selectedPaymentMethod}
                    onComplete={() => {
                      setIsProcessing(true);
                      const paymentId = `pm_${selectedPaymentMethod.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                      setTimeout(() => {
                        handlePaymentSuccess(paymentId);
                      }, 500);
                    }}
                    onBack={() => {
                      setStep("select");
                      setError(null);
                    }}
                  />
                )}

                {selectedGateway === GATEWAY_DRAGONPAY && (
                  <DragonpayMockup
                    amount={paymentAmount}
                    paymentMethod={selectedPaymentMethod}
                    onComplete={() => {
                      setIsProcessing(true);
                      const paymentId = `dp_${selectedPaymentMethod.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                      setTimeout(() => {
                        handlePaymentSuccess(paymentId);
                      }, 500);
                    }}
                    onBack={() => {
                      setStep("select");
                      setError(null);
                    }}
                  />
                )}
              </Suspense>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
