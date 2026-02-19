import React, { Suspense, lazy, useEffect, useMemo, useState, type JSX } from "react";
import { Link, useNavigate, useParams, useLocation, Navigate } from "react-router-dom";
import { useAuth } from "../context/useAuth";
import type { Tour, CustomRoute, InstallmentPlan, InstallmentPayment } from "../types";
import { fetchTourBySlug } from "../api/tours";
import type { PaymentMethod } from "../lib/payment-gateway";
import { createBooking } from "../api/bookings";
import { buildApiUrl } from "../config/apiBase";
import ProgressIndicator from "../components/ProgressIndicator";
import BackToTop from "../components/BackToTop";
import { logSecurityEvent, validatePaymentIntentId } from "../utils/paymentSecurity";
import "./Booking.css";

function formatCurrencyPHP(amount: number) {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const GATEWAY_PAYMONGO = "paymongo" as const;
const GATEWAY_DRAGONPAY = "dragonpay" as const;

const themeStyle: React.CSSProperties = {
  background: "linear-gradient(180deg, rgba(249,250,251,1) 0%, rgba(243,244,246,1) 35%, rgba(255,255,255,1) 100%)",
  ["--accent-yellow" as string]: "#FFD24D",
  ["--accent-yellow-600" as string]: "#FFC107",
  ["--muted-slate" as string]: "#94a3b8",
};

const bookingSteps = [
  { id: 1, title: "Review", description: "Tour details" },
  { id: 2, title: "Details", description: "Your information" },
  { id: 3, title: "Passport & Visa", description: "Travel documents" },
  { id: 4, title: "Appointment", description: "Office visit (optional)" },
  { id: 5, title: "Payment", description: "Secure checkout" }
];

const PaymentMethodSelector = lazy(async () => {
  const mod = await import("../lib/payment-gateway");
  return { default: mod.PaymentMethodSelector };
});

const PayMongoMockup = lazy(async () => {
  const mod = await import("../components/PaymentMockup");
  return { default: mod.PayMongoMockup };
});

const DragonpayMockup = lazy(async () => {
  const mod = await import("../components/PaymentMockup");
  return { default: mod.DragonpayMockup };
});

const BookingStepSelection = lazy(() => import("../components/booking/BookingStepSelection"));
const BookingStepDetails = lazy(() => import("../components/booking/BookingStepDetails"));
const BookingStepDocuments = lazy(() => import("../components/booking/BookingStepDocuments"));

const TrustSignals = lazy(async () => {
  const mod = await import("../components/TrustSignals");
  return { default: mod.TrustSignals };
});

const UrgencyIndicators = lazy(async () => {
  const mod = await import("../components/TrustSignals");
  return { default: mod.UrgencyIndicators };
});

const BookingProtection = lazy(async () => {
  const mod = await import("../components/TrustSignals");
  return { default: mod.BookingProtection };
});

// Define an extended type that includes the new fields from TourForm
type ExtendedTour = Tour & {
  regularPricePerPerson?: number;
  promoPricePerPerson?: number;
  basePricePerDay?: number;
  durationDays?: number;
  itinerary?: unknown[];
  isSaleEnabled?: boolean;
  saleEndDate?: string | null;
  allowsDownpayment?: boolean;
};

function getEffectivePriceForTour(tourData: ExtendedTour): number {
  const saleDate = tourData.saleEndDate ? new Date(tourData.saleEndDate) : null;
  const isSaleActive = tourData.isSaleEnabled &&
                       typeof tourData.promoPricePerPerson === 'number' &&
                       (!saleDate || saleDate > new Date());

  const regular = typeof tourData.regularPricePerPerson === "number" ? tourData.regularPricePerPerson : undefined;
  const promo = typeof tourData.promoPricePerPerson === "number" ? tourData.promoPricePerPerson : undefined;
  const days = tourData.durationDays ?? (tourData.itinerary?.length ?? 0);
  const computed = Math.round((tourData.basePricePerDay ?? 0) * days);

  if (isSaleActive && promo !== undefined) {
    return promo;
  }
  if (regular !== undefined) {
    return regular;
  }
  if (promo !== undefined) {
    return promo;
  }
  return computed;
}

export default function Booking(): JSX.Element {
  const { user } = useAuth();
  const location = useLocation();
  const { slug } = useParams<{ slug: string }>();
  const navState = (location.state ?? {}) as {
    tour?: ExtendedTour; // Use extended type
    selectedDate?: string;
    passengers?: number;
    perPerson?: number;
    inlineInsert?: { tour: Tour; insertAfterIndex: number } | null;
  } | undefined;
  const navigate = useNavigate();

  const [tour, setTour] = useState<ExtendedTour | null>(() => navState?.tour ?? null);
  const [loading, setLoading] = useState<boolean>(tour === null);
  const [selectedDate, setSelectedDate] = useState<string | null>(() => navState?.selectedDate ?? null);
  const [passengers, setPassengers] = useState<number>(() => navState?.passengers ?? 1);
  const [perPerson, setPerPerson] = useState<number>(() => navState?.perPerson ?? 0);
  
  // Custom routes state (from TourBuilder inlineInsert) - computed directly, no setter needed
  const customRoutes: CustomRoute[] = useMemo(() => {
    if (navState?.inlineInsert) {
      const insertedTour = navState.inlineInsert.tour;
      return [{
        tourSlug: insertedTour.slug,
        tourTitle: insertedTour.title,
        tourLine: insertedTour.line,
        durationDays: insertedTour.durationDays,
        pricePerPerson: getEffectivePriceForTour(insertedTour as ExtendedTour),
        insertAfterDay: navState.inlineInsert.insertAfterIndex + 1
      }];
    }
    return [];
  }, [navState?.inlineInsert]);

  // Booking flow state
  const [step, setStep] = useState<number>(0); // 0: review, 1: details, 2: passport/visa, 3: appointment, 4: payment
  const [error, setError] = useState<string | null>(null);

  // Customer information state
  const [customerName, setCustomerName] = useState<string>("");
  const [customerEmail, setCustomerEmail] = useState<string>("");
  const [customerPhone, setCustomerPhone] = useState<string>("");
  const [customerPassport, setCustomerPassport] = useState<string>("");
  const [passportError, setPassportError] = useState<string>("");
  
  // Passport and visa document states
  const [passportFile, setPassportFile] = useState<File | null>(null);
  const [visaFile, setVisaFile] = useState<File | null>(null);
  const [hasVisa, setHasVisa] = useState<boolean | null>(null);
  const [visaType, setVisaType] = useState<string>("");
  const [visaExpiry, setVisaExpiry] = useState<string>("");
  const [needsVisaAssistance, setNeedsVisaAssistance] = useState<boolean>(false);

  // Philippine passport validation
  const validatePassport = (value: string): boolean => {
    if (!value.trim()) {
      setPassportError("");
      return true; // Optional field
    }

    const cleaned = value.trim().toUpperCase();
    
    // Most recent format (after Aug 15, 2016): 1 letter + 7 digits + 1 letter (e.g., P1234567A)
    const recentFormat = /^[A-Z]\d{7}[A-Z]$/;
    
    // 2005-2016 format: 2 letters + 7 digits (e.g., AB1234567)
    const oldFormat = /^[A-Z]{2}\d{7}$/;
    
    // Pre-2005 format: 2 letters + 6 digits (e.g., AB123456)
    const oldestFormat = /^[A-Z]{2}\d{6}$/;
    
    if (recentFormat.test(cleaned) || oldFormat.test(cleaned) || oldestFormat.test(cleaned)) {
      setPassportError("");
      return true;
    }
    
    setPassportError("Invalid Philippine passport format. Expected: 1 letter + 7 digits + 1 letter (e.g., P1234567A) or 2 letters + 7 digits (e.g., AB1234567)");
    return false;
  };

  const handlePassportChange = (value: string) => {
    setCustomerPassport(value);
    if (value.trim()) {
      validatePassport(value);
    } else {
      setPassportError("");
    }
  };

  // Office appointment state
  const [wantsAppointment, setWantsAppointment] = useState<boolean>(false);
  const [appointmentDate, setAppointmentDate] = useState<string>("");
  const [appointmentTime, setAppointmentTime] = useState<string>("");
  const [appointmentPurpose, setAppointmentPurpose] = useState<string>("consultation");

  // Payment options state
  const [paymentType, setPaymentType] = useState<"full" | "downpayment" | "cash-appointment">("full");
  const [downpaymentPercentage, setDownpaymentPercentage] = useState<number>(30); // 30% default
  const [customPaymentTerms, setCustomPaymentTerms] = useState<string>("30"); // "30", "50", "70", or custom

  // Payment Gateway state (PayMongo & Dragonpay)
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod | null>(null);
  const [selectedGateway, setSelectedGateway] = useState<PaymentMethod["gateway"] | null>(null);
  
  // Payment terms acceptance
  const [acceptedTerms, setAcceptedTerms] = useState<boolean>(false);
  
  // Installment plan configuration
  const [installmentMonths, setInstallmentMonths] = useState<number>(12); // Default 12 months
  const [customInstallmentAmount, setCustomInstallmentAmount] = useState<number | null>(null);
  
  // Payment attempt tracking
  const [paymentAttempts, setPaymentAttempts] = useState<number>(0);
  const MAX_PAYMENT_ATTEMPTS = 3;

  // Auto-check appointment if cash-appointment payment is selected
  useEffect(() => {
    if (paymentType === "cash-appointment" && !wantsAppointment) {
      setWantsAppointment(true);
    }
  }, [paymentType, wantsAppointment]);

  // Reset to default payment terms when switching away from downpayment
  useEffect(() => {
    if (paymentType !== "downpayment") {
      setCustomPaymentTerms("30");
      setDownpaymentPercentage(30);
    }
  }, [paymentType]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // If tour data is passed via state, use it
      if (navState?.tour) {
        setPerPerson((prev) => prev || getEffectivePriceForTour(navState.tour));
        setLoading(false);
        return;
      }

      // If no tour data and no slug, we can't do anything
      if (!slug) {
        setLoading(false);
        return;
      }

      // Fetch tour data by slug
      setLoading(true);
      try {
        const fetched = (await fetchTourBySlug(slug)) as ExtendedTour;
        if (!cancelled) {
          setTour(fetched);
          setPerPerson((prev) => prev || getEffectivePriceForTour(fetched));
          // Set other details from navState if they exist
          if (navState?.selectedDate) setSelectedDate(navState.selectedDate);
          if (navState?.passengers) setPassengers(navState.passengers);
        }
      } catch (err) {
        console.error("fetchTourBySlug failed", err);
        if (!cancelled) setTour(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [navState?.passengers, navState?.selectedDate, navState?.tour, slug]);

  // Calculate custom routes total price per person
  const customRoutesTotalPerPerson = useMemo(
    () => customRoutes.reduce((sum, route) => sum + route.pricePerPerson, 0),
    [customRoutes]
  );
  
  // Combined price per person (base tour + custom routes)
  const combinedPerPerson = useMemo(
    () => (perPerson ?? 0) + customRoutesTotalPerPerson,
    [perPerson, customRoutesTotalPerPerson]
  );
  
  // Total for all passengers
  const total = useMemo(
    () => combinedPerPerson * Math.max(1, passengers),
    [combinedPerPerson, passengers]
  );
  
  // Calculate payment amounts based on payment type with safety checks
  const safePercentage = Math.max(10, Math.min(90, downpaymentPercentage)); // Clamp between 10-90%
  const downpaymentAmount = useMemo(() => Math.round(total * (safePercentage / 100)), [safePercentage, total]);
  const remainingBalance = useMemo(() => Math.max(0, total - downpaymentAmount), [total, downpaymentAmount]); // Ensure non-negative
  const paymentAmount = useMemo(
    () => (paymentType === "cash-appointment" ? 0 : paymentType === "downpayment" ? downpaymentAmount : total),
    [paymentType, downpaymentAmount, total]
  );
  
  // Validate payment amounts
  if (total < 0 || isNaN(total)) {
    console.error('Invalid total amount:', total);
  }
  if (paymentType === "downpayment" && (downpaymentAmount <= 0 || downpaymentAmount >= total)) {
    console.warn('Invalid downpayment amount:', downpaymentAmount, 'Total:', total);
  }

  function validateStep(current: number): string | null {
    if (current === 0) {
      if (!selectedDate) return "Please choose a travel date before continuing.";
      if (!passengers || passengers < 1) return "Please enter number of passengers.";
      if (!paymentType) return "Please select a payment option before continuing.";
      if (paymentType === "downpayment" && (downpaymentPercentage < 10 || downpaymentPercentage > 90)) {
        return "Downpayment percentage must be between 10% and 90%.";
      }
      // Allow proceeding to next step - appointment will be validated in step 2
      return null;
    }
    if (current === 1) {
      return null;
    }
    if (current === 2) {
      // Appointment step - validate if user wants appointment OR if cash payment is selected
      if (paymentType === "cash-appointment" && !wantsAppointment) {
        return "Please schedule an appointment to pay cash on hand at our office.";
      }
      if (wantsAppointment && !appointmentDate) return "Please select an appointment date.";
      if (wantsAppointment && !appointmentTime) return "Please select an appointment time.";
      if (paymentType === "cash-appointment" && !appointmentDate) return "Please select an appointment date for cash payment.";
      if (paymentType === "cash-appointment" && !appointmentTime) return "Please select an appointment time for cash payment.";
      return null;
    }
    if (current === 3) {
      // Payment step - Skip validation if cash-appointment is selected
      if (paymentType === "cash-appointment") {
        return null; // No online payment needed
      }
      // Payment method must be selected for online payment
      if (!selectedPaymentMethod) {
        return "Please select a payment method to continue.";
      }
      // Payment terms must be accepted
      if (!acceptedTerms) {
        return "Please accept the payment terms and conditions to continue.";
      }
      // Check payment attempts limit
      if (paymentAttempts >= MAX_PAYMENT_ATTEMPTS) {
        return "Too many payment attempts. Please refresh the page and try again.";
      }
      return null;
    }
    return null;
  }

  async function handleNext() {
    setError(null);
    const v = validateStep(step);
    if (v) {
      setError(v);
      return;
    }
    
    // Skip payment step if cash-appointment is selected
    if (step === 3 && paymentType === "cash-appointment") {
      setStep(5); // Jump directly to review (step 5)
    } else if (step < 5) {
      setStep((s) => s + 1);
    }
  }

  function handleBack() {
    setError(null);
    // Skip payment step when going back if cash-appointment is selected
    if (step === 5 && paymentType === "cash-appointment") {
      setStep(3); // Jump back to appointment (step 3)
    } else if (step > 0) {
      setStep((s) => s - 1);
    }
  }

  function handlePaymentSuccess(confirmationId: string) {
    // Validate payment ID format for security
    if (!validatePaymentIntentId(confirmationId)) {
      setError("Invalid payment confirmation. Please contact support.");
      logSecurityEvent("INVALID_PAYMENT_ID_BOOKING", confirmationId, {
        tourSlug: tour?.slug,
        customerEmail,
      });
      return;
    }
    
    const bookingId = confirmationId || `BK-${Math.random().toString(36).slice(2, 9).toUpperCase()}`;
    
    console.log('🎉 Payment successful! Booking details:', {
      bookingId,
      customerName,
      customerEmail,
      tourTitle: tour?.title
    });
    
    // Log successful payment
    logSecurityEvent("BOOKING_PAYMENT_SUCCESS", bookingId, {
      tourSlug: tour?.slug,
      customerEmail,
      amount: paymentAmount,
      paymentType,
    });

    // Generate installment plan if downpayment is selected
    let installmentPlan: InstallmentPlan | undefined;
    if (paymentType === "downpayment") {
      const remainingBalance = total - paymentAmount;
      const monthlyAmount = customInstallmentAmount || Math.ceil(remainingBalance / installmentMonths);
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() + 1); // Start next month
      
      const payments: InstallmentPayment[] = [];
      let remainingToPay = remainingBalance;
      
      for (let i = 0; i < installmentMonths; i++) {
        const dueDate = new Date(startDate);
        dueDate.setMonth(dueDate.getMonth() + i);
        
        // Last payment gets any remaining balance
        const paymentAmount = i === installmentMonths - 1 
          ? remainingToPay 
          : Math.min(monthlyAmount, remainingToPay);
        
        payments.push({
          id: `inst_${bookingId}_${i + 1}`,
          dueDate: dueDate.toISOString(),
          amount: paymentAmount,
          status: 'pending',
        });
        
        remainingToPay -= paymentAmount;
      }
      
      installmentPlan = {
        totalMonths: installmentMonths,
        monthlyAmount,
        startDate: startDate.toISOString(),
        payments,
      };
      
      console.log('📅 Generated installment plan:', installmentPlan);
    }

    // Save booking to our database/storage
    if (tour && customerName && customerEmail && selectedDate) {
      console.log('🔄 Attempting to save booking to MongoDB...');
      console.log('📋 Booking data:', {
        tourSlug: tour.slug,
        customerName,
        customerEmail,
        selectedDate,
        passengers,
        perPerson: combinedPerPerson,
        total,
        paymentType,
        paymentIntentId: confirmationId,
        customRoutes: customRoutes.length > 0 ? customRoutes : undefined
      });
      
      createBooking({
        tour,
        customerName,
        customerEmail,
        customerPhone,
        customerPassport,
        selectedDate,
        passengers,
        perPerson: combinedPerPerson, // Combined price with custom routes
        paymentType,
        paymentIntentId: confirmationId,
        customRoutes: customRoutes.length > 0 ? customRoutes : undefined,
        installmentPlan, // Add installment plan
        // Include appointment details if user requested one
        ...(wantsAppointment && {
          appointmentDate,
          appointmentTime,
          appointmentPurpose,
        }),
      }).then((savedBooking) => {
        console.log('✅ Booking saved successfully to MongoDB:', savedBooking.bookingId);
        console.log('💾 Saved booking details:', savedBooking);
      }).catch((error) => {
        console.error('❌ Failed to save booking to MongoDB:', error);
        console.error('🔍 Error details:', error.message);
        // Still continue with navigation even if save fails
      });
    } else {
      console.warn('⚠️ Cannot save booking - missing required data:', {
        hasTour: !!tour,
        hasCustomerName: !!customerName,
        hasCustomerEmail: !!customerEmail,
        hasSelectedDate: !!selectedDate
      });
    }
    
    // Navigate immediately - don't wait for email
    // Use both URL parameter and state for better reliability
    navigate(`/booking/confirmation/${bookingId}`, {
      state: {
        bookingId,
        tourTitle: tour?.title ?? slug,
        country: tour?.additionalInfo?.countriesVisited?.[0] ?? "",
        date: selectedDate,
        passengers,
        perPerson,
        total,
        customerEmail: customerEmail || undefined,
        appointmentDate: wantsAppointment ? appointmentDate : undefined,
        appointmentTime: wantsAppointment ? appointmentTime : undefined,
        appointmentPurpose: wantsAppointment ? appointmentPurpose : undefined,
        customRoutes: customRoutes.length > 0 ? customRoutes : undefined,
      },
    });
    
    // Send confirmation email via backend API (non-blocking)
    if (customerName && customerEmail && tour) {
      console.log('📧 Sending confirmation email to:', customerEmail);
      
      // Fire and forget - don't block the UI or user experience
      setTimeout(async () => {
        try {
          console.log('📡 Using API URL:', buildApiUrl(''));
          
          const response = await fetch(buildApiUrl('/api/send-booking-email'), {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              bookingId,
              customerName,
              customerEmail,
              tourTitle: tour.title,
              tourDate: selectedDate || '',
              passengers,
              pricePerPerson: perPerson,
              totalAmount: total,
              downpaymentAmount: paymentType === "downpayment" ? downpaymentAmount : undefined,
              remainingBalance: paymentType === "downpayment" ? remainingBalance : undefined,
              isDownpaymentOnly: paymentType === "downpayment",
              country: tour.additionalInfo?.countriesVisited?.[0] || '',
              // Include custom routes for combined tours
              ...(customRoutes.length > 0 && {
                customRoutes: customRoutes.map(route => ({
                  tourSlug: route.tourSlug,
                  tourTitle: route.tourTitle,
                  tourLine: route.tourLine,
                  durationDays: route.durationDays,
                  pricePerPerson: route.pricePerPerson,
                  insertAfterDay: route.insertAfterDay,
                })),
              }),
              // Include payment method details
              ...(selectedPaymentMethod && {
                paymentMethod: selectedPaymentMethod.name,
                paymentMethodIcon: selectedPaymentMethod.icon,
                paymentMethodDescription: selectedPaymentMethod.description,
                paymentGateway: selectedGateway === GATEWAY_PAYMONGO ? 'PayMongo' : 'Dragonpay',
              }),
              // Include appointment details if scheduled
              ...(wantsAppointment && {
                appointmentDate,
                appointmentTime,
                appointmentPurpose,
              }),
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Backend API email sending failed:', response.status, errorText);
            console.warn('⚠️ Email delivery failed, but booking was saved successfully');
            return;
          }

          const result = await response.json();

          if (result.success) {
            console.log('✅ Booking confirmation email sent successfully via backend API');
            console.log('✅ Message ID:', result.messageId);
            if (result.previewUrl) {
              console.log('📧 Email preview:', result.previewUrl);
            }
          } else {
            console.error('❌ Backend API email sending failed:', result.error);
            console.warn('⚠️ Email delivery failed, but booking was saved successfully');
          }
        } catch (error) {
          console.error('❌ Failed to send email via backend API:', error);
          console.warn('⚠️ Email service unavailable, but booking was saved successfully');
          console.info('💡 The booking team will contact you via email or phone shortly');
        }
      }, 100); // Small delay to ensure navigation happens first
    } else {
      console.warn('⚠️ Email not sent - missing customer details:', {
        hasCustomerName: !!customerName,
        hasCustomerEmail: !!customerEmail,
        hasTour: !!tour
      });
    }
  }

  // (stepLabels removed — it was unused)

  if (loading) return <div className="container mx-auto px-5 py-12 text-center text-gray-900">Loading booking details…</div>;

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (!tour) {
    return (
      <main style={themeStyle} className="min-h-screen">
        <div className="container mx-auto px-5 py-12">
          <div className="text-center text-gray-900">
            <p className="text-gray-700 mb-4">We couldn't find that tour. Go back to browse other routes.</p>
            <Link to="/routes" className="inline-block px-4 py-2 bg-rose-600 text-white rounded">Browse routes</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main style={themeStyle} className="booking-page min-h-screen py-12 relative">

      <div className="container mx-auto px-5 relative z-10">
        {/* Page Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-3">
            Complete Your Booking
          </h1>
          <p className="text-lg text-gray-700 max-w-2xl mx-auto">
            You're just a few steps away from your dream European adventure!
          </p>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <div className="space-y-6">
            <div className="rounded-3xl card-glass p-3 md:p-5 shadow-sm overflow-x-auto">
              <ProgressIndicator 
                steps={bookingSteps}
                currentStep={step + 1}
                className="mb-0 min-w-max"
              />
            </div>
            <div className="rounded-3xl card-glass p-6 md:p-8 shadow-sm">{/* Step 3: Payment Method Selection */}
              {/* Step 3: Payment Method Selection */}
              {step === 4 && paymentType !== "cash-appointment" && (
                <section aria-labelledby="payment-heading">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-blue-600 rounded-xl">
                      <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                      </svg>
                    </div>
                    <div>
                      <h2 id="payment-heading" className="text-2xl font-bold text-gray-900">Select Payment Method</h2>
                      <p className="text-gray-700 text-sm">Choose how you'd like to complete your booking</p>
                    </div>
                  </div>

                  {/* Demo Mode Notice */}
                  <div className="mb-6 p-4 bg-yellow-50 border-2 border-yellow-400 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-yellow-700 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm">
                      <div className="font-semibold text-yellow-900 mb-1">Demo Mode Active</div>
                      <p className="text-gray-900">This is a demonstration booking flow. No actual payment will be processed. Select any method to see how the payment experience works!</p>
                    </div>
                  </div>
                  
                  {/* Trust signals before payment form */}
                  <div className="mb-6 space-y-4">
                    <Suspense fallback={<div className="py-2 text-center text-gray-700">Loading trust details...</div>}>
                      <TrustSignals />
                      <UrgencyIndicators />
                      <BookingProtection />
                    </Suspense>
                  </div>
                  
                  <Suspense fallback={<div className="py-6 text-center text-gray-700">Loading payment methods...</div>}>
                    <PaymentMethodSelector 
                      onSelect={(method) => {
                        setSelectedPaymentMethod(method);
                        setSelectedGateway(method.gateway);
                      }}
                      selectedMethod={selectedPaymentMethod || undefined}
                    />
                  </Suspense>
                  
                  {/* Payment Terms and Conditions */}
                  <div className="mt-6 p-5 bg-gray-50 border-2 border-gray-200 rounded-xl">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        id="accept-terms"
                        checked={acceptedTerms}
                        onChange={(e) => setAcceptedTerms(e.target.checked)}
                        className="mt-1 w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                      />
                      <label htmlFor="accept-terms" className="text-sm text-gray-900 cursor-pointer">
                        <span className="font-semibold">I agree to the payment terms and conditions</span>
                        <div className="mt-2 space-y-1 text-gray-700">
                          <p>• All payments are processed securely through our payment partners</p>
                          <p>• Full payment bookings are confirmed immediately upon successful payment</p>
                          <p>• Downpayment bookings require balance payment at least 30 days before departure</p>
                          <p>• Cancellations made 60+ days before departure receive 50% refund</p>
                          <p>• Cancellations made 30-59 days before departure receive 25% refund</p>
                          <p>• No refunds for cancellations within 30 days of departure</p>
                          <p>• Prices are in Philippine Peso (PHP) and include applicable taxes</p>
                        </div>
                      </label>
                    </div>
                  </div>
                  
                  {/* Security Notice */}
                  <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                    <div className="text-sm text-green-900">
                      <div className="font-semibold mb-1">🔒 Secure Payment Processing</div>
                      <p className="text-green-800">Your payment is protected with bank-level encryption and fraud detection. We never store your card details.</p>
                    </div>
                  </div>
                  
                  {error && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-3">
                      <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="text-sm text-red-700">{error}</div>
                    </div>
                  )}
                  
                  <div className="mt-6 flex justify-between items-center">
                    <button onClick={handleBack} className="px-5 py-3 btn-secondary rounded-xl flex items-center gap-2 font-semibold">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <button
                      onClick={() => {
                        setPaymentAttempts(prev => prev + 1);
                        handleNext();
                      }}
                      className="px-6 py-3 btn-primary rounded-xl flex items-center gap-2 font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                      disabled={!selectedPaymentMethod || !acceptedTerms || paymentAttempts >= MAX_PAYMENT_ATTEMPTS}
                    >
                      Continue to Payment
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </button>
                  </div>
                </section>
              )}

              {/* Step 4: Review Booking */}
              {step === 4 && (
                <section aria-labelledby="review-confirm-heading">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-green-600 rounded-xl">
                      <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div>
                      <h2 id="review-confirm-heading" className="text-2xl font-bold text-gray-900">Review Your Booking</h2>
                      <p className="text-gray-700 text-sm">Double-check everything before proceeding</p>
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">Tour Package</div>
                        <div className="font-bold text-gray-900 text-lg">{tour.title}</div>
                        <div className="text-sm text-gray-700 mt-2">{tour.summary}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">Departure Date</div>
                        <div className="font-semibold text-gray-900">{selectedDate || "—"}</div>
                        <div className="text-xs text-gray-600 uppercase tracking-wider mt-3 mb-1">Passengers</div>
                        <div className="font-semibold text-gray-900">{passengers} {passengers === 1 ? 'person' : 'people'}</div>
                      </div>
                    </div>
                    {wantsAppointment && (
                      <div className="mt-6 pt-6 border-t border-gray-300">
                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Office Appointment</div>
                        <div className="flex items-center gap-2 text-sm text-gray-900 font-medium">
                          <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span>{new Date(appointmentDate).toLocaleDateString()} at {appointmentTime}</span>
                        </div>
                        <div className="text-xs text-gray-600 mt-1">Purpose: {appointmentPurpose.replace('-', ' ')}</div>
                      </div>
                    )}
                    {selectedPaymentMethod && (
                      <div className="mt-6 pt-6 border-t border-gray-300">
                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-3">Selected Payment Method</div>
                        <div className="flex items-center gap-3 p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
                          <span className="text-3xl">{selectedPaymentMethod.icon}</span>
                          <div className="flex-1">
                            <div className="font-bold text-gray-900 text-lg">{selectedPaymentMethod.name}</div>
                            <div className="text-sm text-gray-700">{selectedPaymentMethod.description}</div>
                            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600 font-medium">
                              <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              {selectedPaymentMethod.processingTime}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                    <div className="mt-6 pt-6 border-t border-gray-300">
                      <div className="flex justify-between items-center mb-3">
                        <div className="text-sm text-gray-700 font-medium">Per person</div>
                        <div className="font-semibold text-gray-900 text-lg">{formatCurrencyPHP(perPerson)}</div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-base text-gray-900 font-semibold">Total Amount</div>
                        <div className="text-3xl font-bold price-highlight">{formatCurrencyPHP(total)}</div>
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-between items-center">
                    <button onClick={handleBack} className="px-5 py-3 btn-secondary rounded-xl flex items-center gap-2 font-semibold">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Back
                    </button>
                    <button
                      onClick={() => setStep(5)}
                      className="px-6 py-3 btn-accent rounded-xl flex items-center gap-2 font-bold shadow-lg hover:shadow-xl transition-all"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Proceed to Payment
                    </button>
                  </div>
                </section>
              )}

              {/* Step 5: Payment Gateway Mockup */}
              {step === 5 && selectedPaymentMethod && (
                <section aria-labelledby="confirm-heading">
                  <div className="flex items-center gap-3 mb-6 section-header">
                    <div className="p-3 bg-gradient-to-br from-blue-500/20 to-indigo-500/20 rounded-xl">
                      <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <h2 id="confirm-heading" className="text-2xl font-bold text-gray-900">Complete Your Payment</h2>
                      <p className="text-gray-700 text-sm">Secure demo payment - No actual charges will be made</p>
                    </div>
                  </div>

                  {/* Demo Payment Notice */}
                  <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-3">
                    <svg className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-sm">
                      <div className="font-semibold text-blue-300 mb-1">Demo Payment Gateway</div>
                      <p className="text-blue-200/80">This is a simulated payment interface. Click "Complete Payment" to see a successful booking confirmation. No real transactions will occur.</p>
                    </div>
                  </div>
                  
                  <Suspense fallback={<div className="py-6 text-center text-gray-700">Loading payment gateway...</div>}>
                    {selectedGateway === GATEWAY_PAYMONGO && (
                      <PayMongoMockup 
                        amount={total}
                        paymentMethod={selectedPaymentMethod}
                        onComplete={() => {
                          const paymentId = `pm_${selectedPaymentMethod.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                          console.log('✅ PayMongo mockup payment completed:', paymentId);
                          handlePaymentSuccess(paymentId);
                        }}
                        onBack={handleBack}
                      />
                    )}
                    
                    {selectedGateway === GATEWAY_DRAGONPAY && (
                      <DragonpayMockup 
                        amount={total}
                        paymentMethod={selectedPaymentMethod}
                        onComplete={() => {
                          const paymentId = `dp_${selectedPaymentMethod.type}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
                          console.log('✅ Dragonpay mockup payment completed:', paymentId);
                          handlePaymentSuccess(paymentId);
                        }}
                        onBack={handleBack}
                      />
                    )}
                  </Suspense>
                </section>
              )}
              
              {/* Regular booking steps for early steps or cash payment */}
              {(step < 4 || paymentType === "cash-appointment") && (
                <>
                  {step === 0 && (
                    <Suspense fallback={<div className="py-6 text-center text-gray-700">Loading booking step...</div>}>
                      <BookingStepSelection
                        tour={tour}
                        selectedDate={selectedDate}
                        setSelectedDate={setSelectedDate}
                        passengers={passengers}
                        setPassengers={setPassengers}
                        perPerson={perPerson}
                        total={total}
                        paymentType={paymentType}
                        setPaymentType={setPaymentType}
                        customPaymentTerms={customPaymentTerms}
                        setCustomPaymentTerms={setCustomPaymentTerms}
                        downpaymentPercentage={downpaymentPercentage}
                        setDownpaymentPercentage={setDownpaymentPercentage}
                        downpaymentAmount={downpaymentAmount}
                        remainingBalance={remainingBalance}
                        paymentAmount={paymentAmount}
                        error={error}
                        formatCurrencyPHP={formatCurrencyPHP}
                        onBack={() => navigate(-1)}
                        onNext={handleNext}
                        installmentMonths={installmentMonths}
                        setInstallmentMonths={setInstallmentMonths}
                        customInstallmentAmount={customInstallmentAmount}
                        setCustomInstallmentAmount={setCustomInstallmentAmount}
                      />
                    </Suspense>
                  )}

                  {step === 1 && (
                    <Suspense fallback={<div className="py-6 text-center text-gray-700">Loading details step...</div>}>
                      <BookingStepDetails
                        customerName={customerName}
                        setCustomerName={setCustomerName}
                        customerEmail={customerEmail}
                        setCustomerEmail={setCustomerEmail}
                        customerPhone={customerPhone}
                        setCustomerPhone={setCustomerPhone}
                        customerPassport={customerPassport}
                        setCustomerPassport={setCustomerPassport}
                        passportError={passportError}
                        setPassportError={setPassportError}
                        handlePassportChange={handlePassportChange}
                        validatePassport={validatePassport}
                        onBack={handleBack}
                        onNext={handleNext}
                      />
                    </Suspense>
                  )}

                  {step === 2 && (
                    <Suspense fallback={<div className="py-6 text-center text-gray-700">Loading documents step...</div>}>
                      <BookingStepDocuments
                        tour={tour}
                        passportFile={passportFile}
                        setPassportFile={setPassportFile}
                        visaFile={visaFile}
                        setVisaFile={setVisaFile}
                        hasVisa={hasVisa}
                        setHasVisa={setHasVisa}
                        visaType={visaType}
                        setVisaType={setVisaType}
                        visaExpiry={visaExpiry}
                        setVisaExpiry={setVisaExpiry}
                        needsVisaAssistance={needsVisaAssistance}
                        setNeedsVisaAssistance={setNeedsVisaAssistance}
                        customerName={customerName}
                        customerEmail={customerEmail}
                        customerPhone={customerPhone}
                        onBack={handleBack}
                        onNext={handleNext}
                      />
                    </Suspense>
                  )}

                  {step === 4 && (
                    <section aria-labelledby="appointment-heading">
                      <div className="mb-6">
                        <h2 id="appointment-heading" className="text-lg font-semibold mb-2 text-gray-900">
                          Schedule an Office Visit
                        </h2>
                        <p className="text-gray-700 text-sm">
                          {paymentType === "cash-appointment" 
                            ? "You selected 'Cash on Hand' payment. Please schedule your office visit below to complete your payment."
                            : "Would you like to visit our office for a consultation? This is optional."}
                        </p>
                      </div>
                      
                      {paymentType === "cash-appointment" && (
                        <div className="mb-6 p-4 bg-yellow-900/30 border border-yellow-700/50 rounded-lg">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                              <div className="text-yellow-200 font-semibold mb-1">Cash Payment Required</div>
                              <div className="text-yellow-100 text-sm">
                                Please bring <strong className="font-bold">{formatCurrencyPHP(total)}</strong> cash to your scheduled appointment. 
                                Our office accepts Philippine Peso only. Credit/debit cards are also available at the office.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Office Information Card */}
                      <div className="bg-blue-900/30 border border-blue-700/50 rounded-lg p-5 mb-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-blue-500/20 rounded-lg p-3">
                            <svg className="w-6 h-6 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-gray-900 font-semibold mb-2">Discover Group Office</h3>
                            <div className="space-y-1 text-sm text-gray-700">
                              <p className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                                22nd floor, The Upper Class Tower, on the corner of Quezon Avenue and Sct. Reyes St. in Diliman, Quezon City
                              </p>
                              <p className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                +63 02 8526 8404
                              </p>
                              <p className="flex items-center gap-2">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Mon-Fri: 9:00 AM - 6:00 PM | Sat: 10:00 AM - 4:00 PM
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Appointment Toggle */}
                      {paymentType !== "cash-appointment" && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-5 mb-6">
                          <label className="flex items-center gap-3 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={wantsAppointment}
                              onChange={(e) => setWantsAppointment(e.target.checked)}
                              className="w-5 h-5 rounded border-2 border-white/20 bg-white/5 checked:bg-blue-500 checked:border-blue-500 cursor-pointer"
                            />
                            <div className="flex-1">
                              <div className="text-white font-medium">Yes, I'd like to schedule an office visit</div>
                              <div className="text-slate-400 text-sm mt-1">
                                Meet with our travel experts for personalized consultation
                              </div>
                            </div>
                          </label>
                        </div>
                      )}

                      {/* Appointment Details (shown when checkbox is checked OR cash-appointment is selected) */}
                      {(wantsAppointment || paymentType === "cash-appointment") && (
                        <div className="space-y-4 mb-6 p-5 bg-white/5 border border-white/10 rounded-lg">
                          <h3 className="text-gray-900 font-semibold mb-3">
                            {paymentType === "cash-appointment" ? "Schedule Your Payment Appointment" : "Select Your Preferred Date & Time"}
                          </h3>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-gray-700 font-medium text-sm mb-2">Appointment Date</label>
                              <input
                                type="date"
                                value={appointmentDate}
                                onChange={(e) => setAppointmentDate(e.target.value)}
                                min={new Date().toISOString().split('T')[0]}
                                className="w-full rounded px-3 py-2 bg-white border-2 border-gray-300 text-gray-900"
                                required
                              />
                            </div>
                            
                            <div>
                              <label className="block text-gray-700 font-medium text-sm mb-2">Preferred Time</label>
                              <select
                                value={appointmentTime}
                                onChange={(e) => setAppointmentTime(e.target.value)}
                                className="w-full rounded px-3 py-2 bg-white border-2 border-gray-300 text-gray-900"
                                required
                              >
                                <option value="" className="bg-gray-800 text-white">Select a time</option>
                
                                <option value="10:00" className="bg-gray-800 text-white">10:00 AM</option>
                                <option value="11:00" className="bg-gray-800 text-white">11:00 AM</option>
                                <option value="13:00" className="bg-gray-800 text-white">1:00 PM</option>
                                <option value="14:00" className="bg-gray-800 text-white">2:00 PM</option>
                                <option value="15:00" className="bg-gray-800 text-white">3:00 PM</option>
                                <option value="16:00" className="bg-gray-800 text-white">4:00 PM</option>
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-gray-700 font-medium text-sm mb-2">Purpose of Visit</label>
                            <select
                              value={appointmentPurpose}
                              onChange={(e) => setAppointmentPurpose(e.target.value)}
                              className="w-full rounded px-3 py-2 bg-white border-2 border-gray-300 text-gray-900"
                            >
                              <option value="consultation" className="bg-gray-800 text-white">General Consultation</option>
                              <option value="tour-details" className="bg-gray-800 text-white">Discuss Tour Details</option>
                              <option value="payment" className="bg-gray-800 text-white">Payment & Documentation</option>
                              <option value="customization" className="bg-gray-800 text-white">Customize Itinerary</option>
                              <option value="group-booking" className="bg-gray-800 text-white">Group Booking</option>
                            </select>
                          </div>

                          <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4 mt-4">
                            <div className="flex gap-3">
                              <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <div className="text-sm text-yellow-200">
                                <strong className="font-semibold">Note:</strong> Your appointment will be confirmed within 24 hours via email or phone. Please ensure your contact information is correct.
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Benefits of Office Visit */}
                      {!wantsAppointment && (
                        <div className="bg-white/5 border border-white/10 rounded-lg p-5 mb-6">
                          <h3 className="text-gray-900 font-semibold mb-3">Benefits of an Office Visit:</h3>
                          <ul className="space-y-2 text-gray-700 text-sm">
                            <li className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Face-to-face consultation with travel experts</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>View photo albums and videos of destinations</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Discuss customization options for your tour</span>
                            </li>
                            <li className="flex items-start gap-2">
                              <svg className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              <span>Get special deals and exclusive offers</span>
                            </li>
                          </ul>
                        </div>
                      )}

                      <div className="mt-6 flex justify-between">
                        <button onClick={handleBack} className="px-4 py-2 btn-secondary rounded">Back</button>
                        <button 
                          onClick={handleNext}
                          disabled={wantsAppointment && (!appointmentDate || !appointmentTime)}
                          className="px-4 py-2 btn-primary rounded disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {paymentType === "cash-appointment" ? "Continue to Review" : "Continue to Payment"}
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Step 3: Skip for cash-appointment (no online payment needed) - automatically proceed */}
                  
                  {/* Step 4: Review Booking (for cash-appointment) */}
                  {step === 5 && paymentType === "cash-appointment" && (
                    <section aria-labelledby="review-confirm-heading">
                      <h2 id="review-confirm-heading" className="text-lg font-semibold mb-3 text-gray-900">
                        Review & Confirm Your Booking
                      </h2>
                      
                      <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6 space-y-4">
                        <div className="pb-4 border-b border-white/10">
                          <h3 className="text-gray-900 font-semibold mb-2">Tour Details</h3>
                          <div className="text-gray-700 text-sm space-y-1">
                            <div><strong className="text-gray-900">Tour:</strong> {tour.title}</div>
                            <div><strong className="text-gray-900">Departure:</strong> {(() => {
                              if (!selectedDate) return "—";
                              
                              // Handle date ranges (e.g., "2025-05-13 - 2025-05-27")
                              if (selectedDate.includes(' - ')) {
                                const [startDate, endDate] = selectedDate.split(' - ').map(d => d.trim());
                                const start = new Date(startDate);
                                const end = new Date(endDate);
                                
                                if (isNaN(start.getTime()) || isNaN(end.getTime())) return "—";
                                
                                return `${start.toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric'
                                })} - ${end.toLocaleDateString('en-US', { 
                                  month: 'short', 
                                  day: 'numeric',
                                  year: 'numeric'
                                })}`;
                              }
                              
                              // Handle single dates
                              const date = new Date(selectedDate);
                              return isNaN(date.getTime()) ? "—" : date.toLocaleDateString();
                            })()}</div>
                            <div><strong className="text-gray-900">Passengers:</strong> {passengers}</div>
                          </div>
                        </div>

                        {wantsAppointment && appointmentDate && (
                          <div className="pb-4 border-b border-white/10">
                            <h3 className="text-gray-900 font-semibold mb-2">Office Appointment</h3>
                            <div className="text-gray-700 text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span><strong className="text-gray-900">Date:</strong> {new Date(appointmentDate).toLocaleDateString()}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg className="w-4 h-4 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                <span><strong className="text-gray-900">Time:</strong> {appointmentTime}</span>
                              </div>
                              <div><strong className="text-gray-900">Purpose:</strong> {appointmentPurpose.replace('-', ' ')}</div>
                            </div>
                          </div>
                        )}

                        <div className="pb-4 border-b border-white/10">
                          <h3 className="text-gray-900 font-semibold mb-2">Contact Information</h3>
                          <div className="text-gray-700 text-sm space-y-1">
                            <div><strong className="text-gray-900">Name:</strong> {customerName || "—"}</div>
                            <div><strong className="text-gray-900">Email:</strong> {customerEmail || "—"}</div>
                            <div><strong className="text-gray-900">Phone:</strong> {customerPhone || "—"}</div>
                          </div>
                        </div>

                        <div className="bg-yellow-900/30 border border-yellow-700/50 rounded-lg p-4">
                          <div className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1">
                              <div className="text-yellow-200 font-semibold mb-1">Payment Method: Cash on Hand</div>
                              <div className="text-yellow-100 text-sm">
                                Total Amount Due: <strong className="font-bold">{formatCurrencyPHP(total)}</strong>
                              </div>
                              <div className="text-yellow-100 text-sm mt-1">
                                Please bring cash to your scheduled appointment at our office. Credit/debit cards are also accepted.
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 border-t border-white/10">
                          <div className="flex justify-between items-center">
                            <span className="text-gray-700">Base tour per person:</span>
                            <span className="text-gray-900 font-semibold">{formatCurrencyPHP(perPerson)}</span>
                          </div>
                          
                          {/* Display custom routes if any */}
                          {customRoutes.length > 0 && (
                            <>
                              {customRoutes.map((route, index) => (
                                <div key={index} className="flex justify-between items-center mt-2 pl-4 border-l-2 border-purple-500/50">
                                  <div className="flex flex-col">
                                    <span className="text-purple-300 text-sm">+{route.tourTitle}</span>
                                    <span className="text-xs text-slate-400">{route.durationDays} days • {route.tourLine || 'Additional route'}</span>
                                  </div>
                                  <span className="text-purple-300 font-semibold text-sm">{formatCurrencyPHP(route.pricePerPerson)}</span>
                                </div>
                              ))}  
                              <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/10">
                                <span className="text-gray-900 font-semibold">Combined per person:</span>
                                <span className="text-gray-900 font-bold">{formatCurrencyPHP(combinedPerPerson)}</span>
                              </div>
                            </>
                          )}
                          
                          <div className="flex justify-between items-center mt-2">
                            <span className="text-gray-900 font-semibold">Total Amount:</span>
                            <span className="text-2xl font-bold text-blue-400">{formatCurrencyPHP(total)}</span>
                          </div>
                        </div>
                      </div>

                      {error && <div className="mt-3 text-rose-400">{error}</div>}
                      
                      <div className="mt-6 flex justify-between">
                        <button onClick={handleBack} className="px-4 py-2 btn-secondary rounded">Back</button>
                        <button 
                          onClick={handleNext}
                          className="px-4 py-2 btn-primary rounded"
                        >
                          Confirm Booking
                        </button>
                      </div>
                    </section>
                  )}

                  {/* Step 5: Confirmation (for cash-appointment) */}
                  {step === 5 && paymentType === "cash-appointment" && (
                    <section aria-labelledby="final-confirm-heading">
                      <h2 id="final-confirm-heading" className="text-lg font-semibold mb-3 text-gray-900">
                        Complete Your Booking
                      </h2>
                      
                      <div className="bg-gradient-to-br from-green-900/30 to-blue-900/30 border border-green-700/50 rounded-lg p-6 mb-6">
                        <div className="flex items-start gap-4">
                          <div className="bg-green-500/20 rounded-full p-3">
                            <svg className="w-6 h-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-gray-900 font-bold text-lg mb-2">You're Almost Done!</h3>
                            <p className="text-gray-700 text-sm">
                              Click "Complete Booking" below to finalize your reservation. You will receive a confirmation email with your appointment details.
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="bg-white/5 border border-white/10 rounded-lg p-6 mb-6">
                        <h3 className="text-gray-900 font-semibold mb-3">What happens next?</h3>
                        <ol className="space-y-3 text-gray-700 text-sm">
                          <li className="flex items-start gap-3">
                            <span className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-semibold">1</span>
                            <span>You'll receive a confirmation email with your booking ID and appointment details</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-semibold">2</span>
                            <span>Our team will confirm your appointment within 24 hours</span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-semibold">3</span>
                            <span>Visit our office on <strong>{appointmentDate ? new Date(appointmentDate).toLocaleDateString() : 'your scheduled date'}</strong> at <strong>{appointmentTime}</strong></span>
                          </li>
                          <li className="flex items-start gap-3">
                            <span className="bg-blue-500/20 text-blue-400 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0 font-semibold">4</span>
                            <span>Bring <strong className="text-gray-900">{formatCurrencyPHP(total)}</strong> cash (or use credit/debit card at office)</span>
                          </li>
                        </ol>
                      </div>

                      {error && <div className="mt-3 text-rose-400">{error}</div>}
                      
                      <div className="mt-6 flex justify-between">
                        <button onClick={handleBack} className="px-4 py-2 btn-secondary rounded">Back</button>
                        <button 
                          onClick={() => {
                            // Generate booking ID and complete the booking
                            const bookingId = `BK-${Date.now()}-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
                            handlePaymentSuccess(bookingId);
                          }}
                          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded transition-colors"
                        >
                          Complete Booking
                        </button>
                      </div>
                    </section>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
      <BackToTop />
    </main>
  );
}