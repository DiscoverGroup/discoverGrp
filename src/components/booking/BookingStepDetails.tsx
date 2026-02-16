import React from "react";

interface BookingStepDetailsProps {
  customerName: string;
  setCustomerName: (value: string) => void;
  customerEmail: string;
  setCustomerEmail: (value: string) => void;
  customerPhone: string;
  setCustomerPhone: (value: string) => void;
  customerPassport: string;
  setCustomerPassport: (value: string) => void;
  passportError: string;
  setPassportError: (value: string) => void;
  handlePassportChange: (value: string) => void;
  validatePassport: (value: string) => boolean;
  onBack: () => void;
  onNext: () => void;
}

export default function BookingStepDetails({
  customerName,
  setCustomerName,
  customerEmail,
  setCustomerEmail,
  customerPhone,
  setCustomerPhone,
  customerPassport,
  setCustomerPassport,
  passportError,
  setPassportError,
  handlePassportChange,
  validatePassport,
  onBack,
  onNext,
}: BookingStepDetailsProps) {
  return (
    <section aria-labelledby="lead-heading">
      <div className="flex items-center gap-3 mb-6 section-header">
        <div className="p-3 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
          <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <div>
          <h2 id="lead-heading" className="text-2xl font-bold text-gray-900">Your Information</h2>
          <p className="text-gray-700 text-sm">Tell us about the lead passenger</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="form-field">
          <input
            placeholder="Full name"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full rounded-xl px-4 py-3"
            required
          />
        </div>
        <div className="form-field">
          <input
            placeholder="Email address"
            type="email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="w-full rounded-xl px-4 py-3"
            required
          />
        </div>
        <div className="form-field">
          <input
            placeholder="Phone (optional)"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="w-full rounded-xl px-4 py-3"
          />
        </div>
        <div className="form-field">
          <input
            placeholder="Philippine Passport (e.g., P1234567A)"
            value={customerPassport}
            onChange={(e) => handlePassportChange(e.target.value)}
            onBlur={(e) => validatePassport(e.target.value)}
            className={`w-full rounded-xl px-4 py-3 ${passportError ? "border-2 border-red-500 focus:border-red-500" : ""}`}
            maxLength={9}
          />
          {passportError && (
            <div className="mt-2 text-red-400 text-sm flex items-start gap-2">
              <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{passportError}</span>
            </div>
          )}
        </div>
      </div>
      <div className="mt-6 flex justify-between">
        <button onClick={onBack} className="px-4 py-2 btn-secondary rounded">Back</button>
        <div className="flex gap-3">
          <button
            onClick={() => {
              setCustomerName("");
              setCustomerEmail("");
              setCustomerPhone("");
              setCustomerPassport("");
              setPassportError("");
            }}
            className="px-4 py-2 btn-secondary rounded"
          >
            Reset
          </button>
          <button
            onClick={onNext}
            disabled={!customerName.trim() || !customerEmail.trim() || !!passportError}
            className="px-4 py-2 btn-primary rounded disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Continue
          </button>
        </div>
      </div>
    </section>
  );
}
