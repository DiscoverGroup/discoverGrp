import React from "react";
import type { Tour } from "../../types";

type PaymentType = "full" | "downpayment" | "cash-appointment";

type BookingStepSelectionTour = Pick<Tour, "title" | "summary" | "departureDates" | "travelWindow" | "allowsDownpayment">;

interface BookingStepSelectionProps {
  tour: BookingStepSelectionTour;
  selectedDate: string | null;
  setSelectedDate: (value: string) => void;
  passengers: number;
  setPassengers: (value: number) => void;
  perPerson: number;
  total: number;
  paymentType: PaymentType;
  setPaymentType: (value: PaymentType) => void;
  customPaymentTerms: string;
  setCustomPaymentTerms: (value: string) => void;
  downpaymentPercentage: number;
  setDownpaymentPercentage: (value: number) => void;
  downpaymentAmount: number;
  remainingBalance: number;
  paymentAmount: number;
  error: string | null;
  formatCurrencyPHP: (amount: number) => string;
  onBack: () => void;
  onNext: () => void;
  installmentMonths?: number;
  setInstallmentMonths?: (value: number) => void;
  customInstallmentAmount?: number | null;
  setCustomInstallmentAmount?: (value: number | null) => void;
}

export default function BookingStepSelection({
  tour,
  selectedDate,
  setSelectedDate,
  passengers,
  setPassengers,
  perPerson,
  total,
  paymentType,
  setPaymentType,
  customPaymentTerms,
  setCustomPaymentTerms,
  downpaymentPercentage,
  setDownpaymentPercentage,
  downpaymentAmount,
  remainingBalance,
  paymentAmount,
  error,
  formatCurrencyPHP,
  onBack,
  onNext,
  installmentMonths = 12,
  setInstallmentMonths,
  customInstallmentAmount,
  setCustomInstallmentAmount,
}: BookingStepSelectionProps) {
  return (
    <section aria-labelledby="review-heading">
      <div className="flex items-center gap-3 mb-6 section-header">
        <div className="p-3 bg-green-100 rounded-xl">
          <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <div>
          <h2 id="review-heading" className="text-2xl font-bold text-gray-900">Review Your Selection</h2>
          <p className="text-gray-700 text-sm">Confirm your tour details and travel date</p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="info-card form-field">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg flex-shrink-0">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs text-gray-600 uppercase tracking-wider mb-1">Tour Package</div>
              <div className="font-bold text-gray-900 text-lg break-words">{tour.title}</div>
              <div className="text-sm text-gray-700 mt-2">{tour.summary}</div>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 form-field">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-gray-600 uppercase tracking-wider">Travel Date</div>
            {selectedDate && (
              <div className="flex items-center gap-1 text-xs text-green-600 font-medium">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Pre-selected
              </div>
            )}
          </div>
          <select
            value={selectedDate ?? ""}
            onChange={(e) => setSelectedDate(e.target.value)}
            className={`mt-1 w-full rounded-xl px-4 py-3 bg-white border-2 text-gray-900 focus:ring-2 focus:ring-blue-500/20 font-medium transition-all ${
              selectedDate
                ? "border-green-400 focus:border-green-500"
                : "border-gray-300 focus:border-blue-500"
            }`}
          >
            <option value="" className="bg-white text-gray-500">Select departure date</option>
            {tour.departureDates && tour.departureDates.length > 0 ? (
              tour.departureDates.map((dateRange, index) => {
                const value =
                  typeof dateRange === "string"
                    ? dateRange
                    : `${dateRange.start} - ${dateRange.end}`;
                const label =
                  typeof dateRange === "string"
                    ? dateRange
                    : `${new Date(dateRange.start).toLocaleDateString()} - ${new Date(dateRange.end).toLocaleDateString()}`;
                return (
                  <option key={index} value={value} className="bg-white text-gray-900 font-medium">
                    {label}
                  </option>
                );
              })
            ) : tour.travelWindow ? (
              <option value={`${tour.travelWindow.start} - ${tour.travelWindow.end}`} className="bg-white text-gray-900 font-medium">
                {`${new Date(tour.travelWindow.start).toLocaleDateString()} - ${new Date(tour.travelWindow.end).toLocaleDateString()}`}
              </option>
            ) : (
              <option value="" disabled className="bg-slate-800 text-slate-400">No departure dates available</option>
            )}
          </select>
          {!selectedDate && (
            <div className="mt-2 flex items-center gap-2 text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-lg px-3 py-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Please select a departure date to continue
            </div>
          )}
          <div className="text-xs text-gray-600 uppercase tracking-wider mt-4 mb-2">Number of Passengers</div>
          <input
            type="number"
            min={1}
            value={passengers}
            onChange={(e) => setPassengers(Math.max(1, Number(e.target.value)))}
            className="mt-1 w-full md:w-40 rounded-xl px-4 py-3 bg-white border-2 border-gray-300 text-gray-900 font-bold text-lg text-center focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
      </div>
      <div className="mt-6 p-5 bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border-2 border-purple-200">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm text-gray-700">Price per person</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrencyPHP(perPerson)}</div>
        </div>
        <div className="flex items-center justify-between pt-3 border-t-2 border-purple-200">
          <div className="text-base font-semibold text-gray-900">Total Amount</div>
          <div className="text-2xl font-bold price-highlight">{formatCurrencyPHP(total)}</div>
        </div>
      </div>

      <div className="mt-8 p-6 info-card">
        <div className="flex items-center gap-3 mb-5">
          <div className="p-2 bg-yellow-100 rounded-lg">
            <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-900">Choose Payment Method</h3>
        </div>
        <div className="space-y-4">
          <label className="payment-option flex items-start gap-4 cursor-pointer p-4 rounded-xl border-2 border-white/20 hover:border-white/40 transition-all bg-white/5 hover:bg-white/10 group">
            <input
              type="radio"
              name="paymentType"
              value="full"
              checked={paymentType === "full"}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="mt-1 w-5 h-5 text-blue-600 focus:ring-blue-500 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <svg className="w-5 h-5 text-green-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="text-gray-900 font-bold text-lg">Full Payment (Online)</div>
              </div>
              <div className="text-sm text-gray-700 break-words">
                Pay the complete amount now: <span className="font-bold text-green-600">{formatCurrencyPHP(total)}</span>
              </div>
              <div className="mt-2 text-xs text-gray-600">✓ Instant confirmation</div>
            </div>
          </label>

          {tour.allowsDownpayment && (
            <div className="space-y-4">
              <label className="payment-option flex items-start gap-4 cursor-pointer p-4 rounded-xl border-2 border-white/20 hover:border-white/40 transition-all bg-white/5 hover:bg-white/10 group">
                <input
                  type="radio"
                  name="paymentType"
                  value="downpayment"
                  checked={paymentType === "downpayment"}
                  onChange={(e) => setPaymentType(e.target.value as PaymentType)}
                  className="mt-1 w-5 h-5 text-blue-600 focus:ring-blue-500 flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div className="text-gray-900 font-bold text-lg">Downpayment (Online Payment)</div>
                  </div>
                  <div className="text-sm text-gray-700">
                    Pay partial amount now, remaining before departure
                  </div>
                  <div className="mt-2 text-xs text-gray-600">✓ Flexible payment terms</div>
                </div>
              </label>
              {paymentType === "downpayment" && (
                <div className="ml-8 p-4 bg-gray-50 border-2 border-gray-200 rounded-lg space-y-4">
                  <div>
                    <label className="block text-gray-700 text-sm font-medium mb-2">Select Payment Terms</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                      {[
                        { value: "30", label: "30%" },
                        { value: "50", label: "50%" },
                        { value: "70", label: "70%" }
                      ].map((term) => (
                        <button
                          key={term.value}
                          type="button"
                          onClick={() => {
                            setCustomPaymentTerms(term.value);
                            setDownpaymentPercentage(Number(term.value));
                          }}
                          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                            customPaymentTerms === term.value
                              ? "bg-blue-500 text-white"
                              : "bg-slate-800 text-slate-300 hover:bg-slate-700"
                          }`}
                        >
                          {term.label}
                        </button>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <label className="text-gray-700 font-medium text-sm">Custom:</label>
                      <input
                        type="number"
                        min="10"
                        max="90"
                        value={customPaymentTerms === "30" || customPaymentTerms === "50" || customPaymentTerms === "70" ? "" : customPaymentTerms}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "" || (Number(value) >= 10 && Number(value) <= 90)) {
                            setCustomPaymentTerms(value);
                            if (value !== "") {
                              setDownpaymentPercentage(Number(value));
                            }
                          }
                        }}
                        placeholder="10-90"
                        className="w-20 rounded px-3 py-2 bg-white border-2 border-gray-300 text-gray-900 text-sm"
                      />
                      <span className="text-gray-600 text-sm">%</span>
                    </div>
                  </div>                    
                    {/* Installment Plan Configuration */}
                    <div className="pt-4 border-t-2 border-gray-300">
                      <label className="block text-gray-700 text-sm font-bold mb-3">➡ Configure Payment Schedule</label>
                      
                      <div className="space-y-3">
                        <div>
                          <label className="block text-gray-700 text-sm font-medium mb-2">Number of Monthly Installments</label>
                          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                            {[3, 6, 9, 12, 18, 24].map((months) => (
                              <button
                                key={months}
                                type="button"
                                onClick={() => setInstallmentMonths?.(months)}
                                className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors ${
                                  installmentMonths === months
                                    ? "bg-blue-600 text-white"
                                    : "bg-white border-2 border-gray-300 text-gray-900 hover:border-blue-400"
                                }`}
                              >
                                {months}mo
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <label className="block text-gray-700 text-sm font-medium mb-2">Custom Monthly Amount (Optional)</label>
                          <div className="flex items-center gap-2">
                            <span className="text-gray-600 text-sm">PHP</span>
                            <input
                              type="number"
                              min="0"
                              max={remainingBalance}
                              value={customInstallmentAmount || ""}
                              onChange={(e) => {
                                const value = e.target.value ? Number(e.target.value) : null;
                                setCustomInstallmentAmount?.(value);
                              }}
                              placeholder={`Auto: ${formatCurrencyPHP(Math.ceil(remainingBalance / installmentMonths))}`}
                              className="flex-1 rounded-lg px-4 py-2 bg-white border-2 border-gray-300 text-gray-900 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
                            />
                          </div>
                          <div className="mt-1 text-xs text-gray-600">
                            Leave blank for automatic calculation
                          </div>
                        </div>
                        
                        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-start gap-2">
                            <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <div className="flex-1 text-xs text-blue-900">
                              <strong>Payment Schedule:</strong>
                              <div className="mt-1">
                                • Downpayment: {formatCurrencyPHP(downpaymentAmount)} (Pay now)<br/>
                                • Monthly Payment: {formatCurrencyPHP(customInstallmentAmount || Math.ceil(remainingBalance / installmentMonths))}<br/>
                                • Duration: {installmentMonths} months<br/>
                                • First installment due: Next month
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  <div className="pt-3 border-t border-slate-700 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Total Amount:</span>
                      <span className="text-gray-900 font-semibold">{formatCurrencyPHP(total)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Downpayment ({downpaymentPercentage}%):</span>
                      <span className="text-gray-900 font-semibold">{formatCurrencyPHP(downpaymentAmount)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-700">Remaining Balance:</span>
                      <span className="text-gray-900 font-semibold">{formatCurrencyPHP(remainingBalance)}</span>
                    </div>
                    <div className="mt-4 p-3 bg-orange-900/30 border-2 border-orange-600 rounded-lg">
                      <div className="flex items-start gap-2 mb-2">
                        <svg className="w-4 h-4 text-orange-300 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1">
                          <div className="text-sm font-semibold text-orange-200 mb-1">Payment Terms</div>
                          <ul className="text-xs text-gray-700 space-y-1 list-disc list-inside">
                            <li>Pay downpayment now to secure your booking</li>
                            <li>Remaining balance due <strong>30 days before departure</strong></li>
                            <li>Payment reminders will be sent via email & SMS</li>
                            <li>Flexible payment options for remaining balance</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                    <div className="text-xs text-slate-400 mt-2 flex items-start gap-1">
                      <svg className="w-3 h-3 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Remaining balance must be paid at least 7 days before departure</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <label className="payment-option flex items-start gap-4 cursor-pointer p-4 rounded-xl border-2 border-white/20 hover:border-white/40 transition-all bg-white/5 hover:bg-white/10 group">
            <input
              type="radio"
              name="paymentType"
              value="cash-appointment"
              checked={paymentType === "cash-appointment"}
              onChange={(e) => setPaymentType(e.target.value as PaymentType)}
              className="mt-1 w-5 h-5 text-blue-600 focus:ring-blue-500 flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <svg className="w-5 h-5 text-gray-900 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                <div className="text-gray-900 font-bold text-lg">Cash on Hand (Office Visit)</div>
              </div>
              <div className="text-sm text-gray-700 break-words">
                Pay in person at our office: <span className="font-bold text-gray-900">{formatCurrencyPHP(total)}</span>
              </div>
              <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Requires scheduling an office appointment
              </div>
            </div>
          </label>
        </div>

        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-700">
              {paymentType === "cash-appointment" ? "To Pay at Office" : paymentType === "full" ? "Total Amount" : "Amount to Pay Now"}
            </div>
            <div className="text-lg font-bold text-gray-900">
              {formatCurrencyPHP(paymentType === "cash-appointment" ? total : paymentAmount)}
            </div>
          </div>
          {paymentType === "cash-appointment" && (
            <div className="mt-2 text-xs text-gray-600 flex items-center gap-1">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              No online payment required - pay when you visit our office
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-6 p-4 bg-red-500/10 border-2 border-red-500/30 rounded-xl flex items-center gap-3">
          <svg className="w-6 h-6 text-red-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-red-200 font-medium">{error}</div>
        </div>
      )}

      <div className="mt-8 flex justify-between items-center gap-4">
        <button onClick={onBack} className="px-6 py-3 btn-secondary rounded-xl font-semibold flex items-center gap-2">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back
        </button>
        <button onClick={onNext} className="px-8 py-3 btn-primary rounded-xl font-bold flex items-center gap-2">
          Continue
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </button>
      </div>
    </section>
  );
}
