import React, { useState } from "react";
import { buildApiUrl } from "../../config/apiBase";

export interface InsurancePax {
  name: string;
  birthday: string;
}

interface BookingStepDocumentsProps {
  passengers: number;
  passportFile: File | null;
  setPassportFile: (file: File | null) => void;
  passportUrl: string | null;
  setPassportUrl: (url: string | null) => void;
  visaFile: File | null;
  setVisaFile: (file: File | null) => void;
  visaUrl: string | null;
  setVisaUrl: (url: string | null) => void;
  hasVisa: boolean | null;
  setHasVisa: (value: boolean) => void;
  visaType: string;
  setVisaType: (value: string) => void;
  visaExpiry: string;
  setVisaExpiry: (value: string) => void;
  needsVisaAssistance: boolean;
  setNeedsVisaAssistance: (value: boolean) => void;
  visaPaxDetails: InsurancePax[];
  setVisaPaxDetails: (value: InsurancePax[]) => void;
  needsTravelInsurance: boolean;
  setNeedsTravelInsurance: (value: boolean) => void;
  insurancePaxDetails: InsurancePax[];
  setInsurancePaxDetails: (value: InsurancePax[]) => void;
  needsPassportAssistance: boolean;
  setNeedsPassportAssistance: (value: boolean) => void;
  passportPaxDetails: InsurancePax[];
  setPassportPaxDetails: (value: InsurancePax[]) => void;
  visaFeePerPax: number;
  visaOriginalPerPax: number;
  insuranceFeePerPax: number;
  insuranceOriginalPerPax: number;
  passportFeePerPax: number;
  passportOriginalPerPax: number;
  onBack: () => void;
  onNext: () => void;
}

export default function BookingStepDocuments({
  passengers,
  passportFile,
  setPassportFile,
  passportUrl,
  setPassportUrl,
  visaFile,
  setVisaFile,
  visaUrl,
  setVisaUrl,
  hasVisa,
  setHasVisa,
  visaType,
  setVisaType,
  visaExpiry,
  setVisaExpiry,
  needsVisaAssistance,
  setNeedsVisaAssistance,
  visaPaxDetails,
  setVisaPaxDetails,
  needsTravelInsurance,
  setNeedsTravelInsurance,
  insurancePaxDetails,
  setInsurancePaxDetails,
  needsPassportAssistance,
  setNeedsPassportAssistance,
  passportPaxDetails,
  setPassportPaxDetails,
  visaFeePerPax,
  visaOriginalPerPax,
  insuranceFeePerPax,
  insuranceOriginalPerPax,
  passportFeePerPax,
  passportOriginalPerPax,
  onBack,
  onNext,
}: BookingStepDocumentsProps) {
  const paxCount = Math.max(1, passengers);
  const [passportUploading, setPassportUploading] = useState(false);
  const [passportUploadError, setPassportUploadError] = useState<string | null>(null);
  const [visaUploading, setVisaUploading] = useState(false);
  const [visaUploadError, setVisaUploadError] = useState<string | null>(null);

  async function uploadDocument(file: File, type: 'passport' | 'visa'): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('type', type);
    const token = localStorage.getItem('token');
    const res = await fetch(buildApiUrl('/api/upload/document'), {
      method: 'POST',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error((err as { message?: string }).message || 'Upload failed');
    }
    const data = await res.json() as { url: string };
    return data.url;
  }

  async function handlePassportChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setPassportFile(file);
    setPassportUrl(null);
    setPassportUploadError(null);
    if (!file) return;
    setPassportUploading(true);
    try {
      const url = await uploadDocument(file, 'passport');
      setPassportUrl(url);
    } catch (err) {
      setPassportUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setPassportUploading(false);
    }
  }

  async function handleVisaChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] || null;
    setVisaFile(file);
    setVisaUrl(null);
    setVisaUploadError(null);
    if (!file) return;
    setVisaUploading(true);
    try {
      const url = await uploadDocument(file, 'visa');
      setVisaUrl(url);
    } catch (err) {
      setVisaUploadError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setVisaUploading(false);
    }
  }

  function updateVisaPax(index: number, field: keyof InsurancePax, value: string) {
    const updated = [...visaPaxDetails];
    updated[index] = { ...updated[index], [field]: value };
    setVisaPaxDetails(updated);
  }

  function handleVisaToggle(checked: boolean) {
    setNeedsVisaAssistance(checked);
    if (checked && visaPaxDetails.length !== paxCount) {
      setVisaPaxDetails(
        Array.from({ length: paxCount }, (_, i) =>
          visaPaxDetails[i] ?? { name: "", birthday: "" }
        )
      );
    }
  }

  function updateInsurancePax(index: number, field: keyof InsurancePax, value: string) {
    const updated = [...insurancePaxDetails];
    updated[index] = { ...updated[index], [field]: value };
    setInsurancePaxDetails(updated);
  }

  function updatePassportPax(index: number, field: keyof InsurancePax, value: string) {
    const updated = [...passportPaxDetails];
    updated[index] = { ...updated[index], [field]: value };
    setPassportPaxDetails(updated);
  }

  function handleInsuranceToggle(checked: boolean) {
    setNeedsTravelInsurance(checked);
    if (checked && insurancePaxDetails.length !== paxCount) {
      // Pre-fill first pax name if available
      setInsurancePaxDetails(
        Array.from({ length: paxCount }, (_, i) =>
          insurancePaxDetails[i] ?? { name: "", birthday: "" }
        )
      );
    }
  }

  function handlePassportAssistanceToggle(checked: boolean) {
    setNeedsPassportAssistance(checked);
    if (checked && passportPaxDetails.length !== paxCount) {
      setPassportPaxDetails(
        Array.from({ length: paxCount }, (_, i) =>
          passportPaxDetails[i] ?? { name: "", birthday: "" }
        )
      );
    }
  }

  const visaComplete =
    !needsVisaAssistance ||
    visaPaxDetails.slice(0, paxCount).every((p) => p.name.trim() && p.birthday);

  const insuranceComplete =
    !needsTravelInsurance ||
    insurancePaxDetails.slice(0, paxCount).every((p) => p.name.trim() && p.birthday);

  const passportAssistanceComplete =
    !needsPassportAssistance ||
    passportPaxDetails.slice(0, paxCount).every((p) => p.name.trim() && p.birthday);

  const canContinue =
    !!passportUrl &&
    !passportUploading &&
    !visaUploading &&
    (hasVisa === true ? !!visaUrl && !!visaExpiry : hasVisa !== null) &&
    visaComplete &&
    insuranceComplete &&
    passportAssistanceComplete;

  return (
    <section aria-labelledby="passport-visa-heading">
      <div className="flex items-center gap-3 mb-6 section-header">
        <div className="p-3 bg-gradient-to-br from-green-500/20 to-blue-500/20 rounded-xl">
          <svg className="w-8 h-8 text-gray-900" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <h2 id="passport-visa-heading" className="text-2xl font-bold text-gray-900">Travel Documents</h2>
          <p className="text-gray-700 text-sm">Upload documents &amp; select add-ons</p>
        </div>
      </div>

      {/* ── Passport ── */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Passport Information</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Upload Passport Copy *</label>
          <input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png"
            onChange={handlePassportChange}
            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            required
          />
          {passportUploading && (
            <div className="flex items-center gap-2 mt-2 text-blue-600">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <span className="text-sm">Uploading to secure storage…</span>
            </div>
          )}
          {passportUploadError && (
            <div className="flex items-center gap-2 mt-2 text-red-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              <span className="text-sm">{passportUploadError}</span>
            </div>
          )}
          {passportUrl && !passportUploading && (
            <div className="flex items-center gap-2 mt-2 text-green-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
              <span className="text-sm">Passport uploaded: {passportFile?.name}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Passport Assistance Add-on (always visible) ── */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Passport Assistance <span className="text-sm font-normal text-gray-500">(Optional)</span></h3>
        <div className={`rounded-xl border-2 p-5 transition-all ${needsPassportAssistance ? "border-orange-500 bg-orange-50" : "border-gray-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🛂</span>
              <div>
                <div className="font-bold text-gray-900 text-base">Passport Processing Assistance</div>
                <p className="text-sm text-gray-600 mt-0.5">
                  We handle your passport application or renewal — forms, requirements, appointments &amp; follow-ups.
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-xl font-bold text-orange-700">
                    PHP {passportFeePerPax.toLocaleString()}
                  </span>
                  {passportOriginalPerPax > passportFeePerPax && (
                    <span className="text-sm text-gray-400 line-through">
                      PHP {passportOriginalPerPax.toLocaleString()}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">/ pax</span>
                  {passportOriginalPerPax > passportFeePerPax && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                      {Math.round((1 - passportFeePerPax / passportOriginalPerPax) * 100)}% OFF
                    </span>
                  )}
                </div>
                {paxCount > 1 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Total for {paxCount} pax: PHP {(passportFeePerPax * paxCount).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer flex-shrink-0 mt-1">
              <input
                type="checkbox"
                checked={needsPassportAssistance}
                onChange={(e) => handlePassportAssistanceToggle(e.target.checked)}
                className="w-5 h-5 rounded accent-orange-600"
              />
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Add to booking</span>
            </label>
          </div>
          {needsPassportAssistance && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Passenger details for passport assistance:</p>
              {Array.from({ length: paxCount }).map((_, i) => (
                <div key={i} className="p-3 bg-white border border-orange-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Passenger {i + 1}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                      <input
                        type="text"
                        placeholder="Full legal name"
                        value={passportPaxDetails[i]?.name ?? ""}
                        onChange={(e) => updatePassportPax(i, "name", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        value={passportPaxDetails[i]?.birthday ?? ""}
                        onChange={(e) => updatePassportPax(i, "birthday", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Visa Status ── */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Visa Status</h3>
        <p className="text-sm font-medium text-gray-700 mb-3">Do you have a valid visa for your destination countries?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="hasVisa" checked={hasVisa === true} onChange={() => { setHasVisa(true); setNeedsVisaAssistance(false); }} className="text-blue-600" />
            <div>
              <span className="font-medium text-green-600">Yes, I have a valid visa</span>
              <p className="text-sm text-gray-600">Upload your visa document</p>
            </div>
          </label>
          <label className="flex items-center gap-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50">
            <input type="radio" name="hasVisa" checked={hasVisa === false} onChange={() => setHasVisa(false)} className="text-blue-600" />
            <div>
              <span className="font-medium text-red-600">No — I need visa assistance</span>
              <p className="text-sm text-gray-600">Add our visa assistance service</p>
            </div>
          </label>
        </div>

        {hasVisa === true && (
          <div className="space-y-4 bg-green-50 p-4 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Upload Visa Copy *</label>
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleVisaChange}
                className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100"
                required
              />
              {visaUploading && (
                <div className="flex items-center gap-2 mt-2 text-blue-600">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span className="text-sm">Uploading to secure storage…</span>
                </div>
              )}
              {visaUploadError && (
                <div className="flex items-center gap-2 mt-2 text-red-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  <span className="text-sm">{visaUploadError}</span>
                </div>
              )}
              {visaUrl && !visaUploading && (
                <div className="flex items-center gap-2 mt-2 text-green-600">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  <span className="text-sm">Visa uploaded: {visaFile?.name}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Visa Type</label>
                <select value={visaType} onChange={(e) => setVisaType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
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
                <input type="date" value={visaExpiry} onChange={(e) => setVisaExpiry(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" required />
              </div>
            </div>
          </div>
        )}

        {/* ── Visa Assistance Add-on ── */}
        {hasVisa === false && (
          <div className={`rounded-xl border-2 p-5 transition-all ${needsVisaAssistance ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white"}`}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🛂</span>
                <div>
                  <div className="font-bold text-gray-900 text-base">Visa Assistance Service</div>
                  <p className="text-sm text-gray-600 mt-0.5">
                    Our specialists handle the entire process — documents, embassy appointments &amp; follow-ups.
                  </p>
                  <div className="flex items-baseline gap-2 mt-2">
                    <span className="text-xl font-bold text-blue-700">
                      PHP {visaFeePerPax.toLocaleString()}
                    </span>
                    {visaOriginalPerPax > visaFeePerPax && (
                      <span className="text-sm text-gray-400 line-through">
                        PHP {visaOriginalPerPax.toLocaleString()}
                      </span>
                    )}
                    <span className="text-sm text-gray-500">/ pax</span>
                    {visaOriginalPerPax > visaFeePerPax && (
                      <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                        {Math.round((1 - visaFeePerPax / visaOriginalPerPax) * 100)}% OFF
                      </span>
                    )}
                  </div>
                  {paxCount > 1 && (
                    <p className="text-xs text-gray-500 mt-1">
                      Total for {paxCount} pax: PHP {(visaFeePerPax * paxCount).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>
              <label className="flex items-center gap-2 cursor-pointer flex-shrink-0 mt-1">
                <input
                  type="checkbox"
                  checked={needsVisaAssistance}
                  onChange={(e) => handleVisaToggle(e.target.checked)}
                  className="w-5 h-5 rounded accent-blue-600"
                />
                <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Add to booking</span>
              </label>
            </div>
            {needsVisaAssistance && (
              <div className="mt-4 space-y-3">
                <p className="text-sm font-medium text-gray-700">Passenger details for visa application:</p>
                {Array.from({ length: paxCount }).map((_, i) => (
                  <div key={i} className="p-3 bg-white border border-blue-200 rounded-lg">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Passenger {i + 1}</p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                        <input
                          type="text"
                          placeholder="Full legal name"
                          value={visaPaxDetails[i]?.name ?? ""}
                          onChange={(e) => updateVisaPax(i, "name", e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-600 mb-1">Date of Birth *</label>
                        <input
                          type="date"
                          value={visaPaxDetails[i]?.birthday ?? ""}
                          onChange={(e) => updateVisaPax(i, "birthday", e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          required
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {!needsVisaAssistance && (
              <button
                type="button"
                onClick={() => setNeedsVisaAssistance(false)}
                className="mt-3 text-xs text-gray-500 hover:underline"
              >
                Continue without visa assistance (I'll apply on my own)
              </button>
            )}
          </div>
        )}
      </div>

      {/* ── Travel Insurance Add-on (always visible) ── */}
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-3">Travel Insurance <span className="text-sm font-normal text-gray-500">(Optional)</span></h3>
        <div className={`rounded-xl border-2 p-5 transition-all ${needsTravelInsurance ? "border-emerald-500 bg-emerald-50" : "border-gray-200 bg-white"}`}>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">🛡️</span>
              <div>
                <div className="font-bold text-gray-900 text-base">Travel Insurance Coverage</div>
                <p className="text-sm text-gray-600 mt-0.5">
                  Comprehensive coverage for trip cancellation, medical emergencies, lost baggage &amp; delays.
                </p>
                <div className="flex items-baseline gap-2 mt-2">
                  <span className="text-xl font-bold text-emerald-700">
                    PHP {insuranceFeePerPax.toLocaleString()}
                  </span>
                  {insuranceOriginalPerPax > insuranceFeePerPax && (
                    <span className="text-sm text-gray-400 line-through">
                      PHP {insuranceOriginalPerPax.toLocaleString()}
                    </span>
                  )}
                  <span className="text-sm text-gray-500">/ pax</span>
                  {insuranceOriginalPerPax > insuranceFeePerPax && (
                    <span className="ml-1 px-2 py-0.5 text-xs font-semibold bg-red-100 text-red-700 rounded-full">
                      {Math.round((1 - insuranceFeePerPax / insuranceOriginalPerPax) * 100)}% OFF
                    </span>
                  )}
                </div>
                {paxCount > 1 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Total for {paxCount} pax: PHP {(insuranceFeePerPax * paxCount).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer flex-shrink-0 mt-1">
              <input
                type="checkbox"
                checked={needsTravelInsurance}
                onChange={(e) => handleInsuranceToggle(e.target.checked)}
                className="w-5 h-5 rounded accent-emerald-600"
              />
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Add to booking</span>
            </label>
          </div>

          {needsTravelInsurance && (
            <div className="mt-4 space-y-3">
              <p className="text-sm font-medium text-gray-700">Passenger details for insurance:</p>
              {Array.from({ length: paxCount }).map((_, i) => (
                <div key={i} className="p-3 bg-white border border-emerald-200 rounded-lg">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Passenger {i + 1}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Full Name *</label>
                      <input
                        type="text"
                        placeholder="Full legal name"
                        value={insurancePaxDetails[i]?.name ?? ""}
                        onChange={(e) => updateInsurancePax(i, "name", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-600 mb-1">Date of Birth *</label>
                      <input
                        type="date"
                        value={insurancePaxDetails[i]?.birthday ?? ""}
                        onChange={(e) => updateInsurancePax(i, "birthday", e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                        required
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-between items-center pt-6">
        <button onClick={onBack} className="px-4 py-2 btn-secondary rounded">Back</button>
        <button
          onClick={onNext}
          disabled={!canContinue}
          className="px-4 py-2 btn-primary rounded disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Continue
        </button>
      </div>
    </section>
  );
}

