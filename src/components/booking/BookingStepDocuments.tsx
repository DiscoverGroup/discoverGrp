import React from "react";
import { Link } from "react-router-dom";
import type { Tour } from "../../types";

interface BookingStepDocumentsProps {
  tour: Tour;
  passportFile: File | null;
  setPassportFile: (file: File | null) => void;
  visaFile: File | null;
  setVisaFile: (file: File | null) => void;
  hasVisa: boolean | null;
  setHasVisa: (value: boolean) => void;
  visaType: string;
  setVisaType: (value: string) => void;
  visaExpiry: string;
  setVisaExpiry: (value: string) => void;
  needsVisaAssistance: boolean;
  setNeedsVisaAssistance: (value: boolean) => void;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onBack: () => void;
  onNext: () => void;
}

export default function BookingStepDocuments({
  tour,
  passportFile,
  setPassportFile,
  visaFile,
  setVisaFile,
  hasVisa,
  setHasVisa,
  visaType,
  setVisaType,
  visaExpiry,
  setVisaExpiry,
  needsVisaAssistance,
  setNeedsVisaAssistance,
  customerName,
  customerEmail,
  customerPhone,
  onBack,
  onNext,
}: BookingStepDocumentsProps) {
  return (
    <section aria-labelledby="passport-visa-heading">
      <div className="flex items-center gap-3 mb-6 section-header">
        <div className="p-3 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-xl">
          <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 id="passport-visa-heading" className="text-2xl font-bold text-gray-900">Passport & Visa Verification</h2>
          <p className="text-gray-700 text-sm">Upload your travel documents</p>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Passport Information</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Upload Passport Copy *
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              onChange={(e) => setPassportFile(e.target.files?.[0] || null)}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              required
            />
            {passportFile && (
              <div className="flex items-center gap-2 mt-2 text-green-600">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-sm">Passport uploaded: {passportFile.name}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Visa Status</h3>
        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-700 mb-3">
              Do you have a valid visa for your destination countries?
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="hasVisa"
                  value="yes"
                  checked={hasVisa === true}
                  onChange={() => setHasVisa(true)}
                  className="text-blue-600"
                />
                <div>
                  <span className="font-medium text-green-600">Yes, I have a valid visa</span>
                  <p className="text-sm text-gray-600">Upload your visa document</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="radio"
                  name="hasVisa"
                  value="no"
                  checked={hasVisa === false}
                  onChange={() => setHasVisa(false)}
                  className="text-blue-600"
                />
                <div>
                  <span className="font-medium text-red-600">No, I need visa assistance</span>
                  <p className="text-sm text-gray-600">We can help you with visa application</p>
                </div>
              </label>
            </div>
          </div>

          {hasVisa === true && (
            <div className="space-y-4 bg-green-50 p-4 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload Visa Copy *
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setVisaFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                  required
                />
                {visaFile && (
                  <div className="flex items-center gap-2 mt-2 text-green-600">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-sm">Visa uploaded: {visaFile.name}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visa Type</label>
                  <select
                    value={visaType}
                    onChange={(e) => setVisaType(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select visa type</option>
                    <option value="tourist">Tourist Visa</option>
                    <option value="business">Business Visa</option>
                    <option value="schengen">Schengen Visa</option>
                    <option value="transit">Transit Visa</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Visa Expiry Date *</label>
                  <input
                    type="date"
                    value={visaExpiry}
                    onChange={(e) => setVisaExpiry(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {hasVisa === false && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div className="flex-1">
                  <h4 className="text-blue-900 font-semibold mb-2">Visa Assistance Available</h4>
                  <p className="text-blue-800 text-sm mb-3">
                    Don't worry! Our visa specialists can help you obtain the required visa for your destination countries.
                    We handle the entire process from document preparation to embassy appointments.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Link
                      to="/visa-assistance"
                      state={{
                        tourCountries: tour?.additionalInfo?.countriesVisited || [],
                        customerName,
                        customerEmail,
                        customerPhone
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                      Get Visa Assistance
                    </Link>
                    <button
                      onClick={() => setNeedsVisaAssistance(true)}
                      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
                    >
                      Continue Without Visa (I'll apply later)
                    </button>
                  </div>
                  {needsVisaAssistance && (
                    <div className="mt-3 p-3 bg-yellow-100 border border-yellow-300 rounded-lg">
                      <p className="text-yellow-800 text-sm">
                        <strong>Important:</strong> You'll need to obtain your visa before your travel date.
                        We strongly recommend getting professional assistance to avoid delays or rejections.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-6">
        <button onClick={onBack} className="px-4 py-2 btn-secondary rounded">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!passportFile || (hasVisa === true && (!visaFile || !visaExpiry)) || hasVisa === null}
          className="px-4 py-2 btn-primary rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </section>
  );
}
