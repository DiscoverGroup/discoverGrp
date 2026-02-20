import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, Globe, Phone, Mail, Clock } from 'lucide-react';

interface VisaAssistanceProps {
  tourCountries?: string[];
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
}

export default function VisaAssistance() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as VisaAssistanceProps | null;

  const [formData, setFormData] = useState({
    completeName: state?.customerName || '',
    passportNumber: '',
    civilStatus: '',
    companyName: '',
    jobTitle: '',
    companyLocation: '',
    dateHiredOrStarted: '',
    contactNumber: state?.customerPhone || '',
    emailAddress: state?.customerEmail || '',
    presentAddress: '',
    travelHistory: '',
  });

  const tourCountries = state?.tourCountries || [];

  const handleChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmitApplication = async () => {
    console.log('Visa assistance application:', formData);
    alert('Visa assistance application submitted! We will contact you within 24 hours.');
    navigate(-1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-white hover:shadow-sm rounded-lg transition-all mb-6"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Booking</span>
          </button>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center gap-4 mb-4">
              <div className="bg-blue-100 p-3 rounded-xl">
                <Globe className="text-blue-600" size={32} />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Visa Assistance</h1>
                <p className="text-gray-600">Let us help you secure your travel visa</p>
              </div>
            </div>

            {state?.tourCountries && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-blue-800">
                  <strong>For your tour to:</strong> {tourCountries.join(', ')}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Application Form */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Visa Assistance Application</h2>

          <div className="space-y-5">
            {/* Complete Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Complete Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.completeName}
                onChange={(e) => handleChange('completeName', e.target.value)}
                placeholder="Enter your complete name"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Passport Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Passport Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.passportNumber}
                onChange={(e) => handleChange('passportNumber', e.target.value)}
                placeholder="Enter your passport number"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Civil Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Civil Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.civilStatus}
                onChange={(e) => handleChange('civilStatus', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              >
                <option value="">Select civil status</option>
                <option value="Single">Single</option>
                <option value="Married">Married</option>
                <option value="Widowed">Widowed</option>
                <option value="Separated">Separated</option>
                <option value="Divorced">Divorced</option>
              </select>
            </div>

            {/* Name of Business/Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Name of Business/Company You Are Working For
              </label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => handleChange('companyName', e.target.value)}
                placeholder="Enter business or company name"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Position/Job Title */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Position/Job Title
              </label>
              <input
                type="text"
                value={formData.jobTitle}
                onChange={(e) => handleChange('jobTitle', e.target.value)}
                placeholder="Enter your position or job title"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Location of Business/Company */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Location of Business/Company
              </label>
              <input
                type="text"
                value={formData.companyLocation}
                onChange={(e) => handleChange('companyLocation', e.target.value)}
                placeholder="Enter business or company location"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Date Hired / Business Started */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Date When You Were Hired / Business Started
              </label>
              <input
                type="date"
                value={formData.dateHiredOrStarted}
                onChange={(e) => handleChange('dateHiredOrStarted', e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Contact Number */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={(e) => handleChange('contactNumber', e.target.value)}
                placeholder="Enter your contact number"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.emailAddress}
                onChange={(e) => handleChange('emailAddress', e.target.value)}
                placeholder="Enter your email address"
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
              />
            </div>

            {/* Present Address */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Present Address <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.presentAddress}
                onChange={(e) => handleChange('presentAddress', e.target.value)}
                placeholder="Enter your present address"
                rows={3}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white resize-none"
              />
            </div>

            {/* Travel History */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Travel History
              </label>
              <p className="text-xs text-gray-500 mb-2">List the countries you have visited</p>
              <textarea
                value={formData.travelHistory}
                onChange={(e) => handleChange('travelHistory', e.target.value)}
                placeholder="e.g. Japan (2022), South Korea (2023), Singapore (2024)"
                rows={4}
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white resize-none"
              />
            </div>
          </div>
        </div>

        {/* Contact Information */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Need Help?</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="flex items-center gap-3">
              <Phone className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold text-gray-900">Call Us</p>
                <p className="text-gray-600">+63 123 456 7890</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold text-gray-900">Email Us</p>
                <p className="text-gray-600">visa@discovergroup.com</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Clock className="text-blue-600" size={24} />
              <div>
                <p className="font-semibold text-gray-900">Office Hours</p>
                <p className="text-gray-600">Mon-Fri 9AM-6PM</p>
              </div>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-between items-center">
          <button
            onClick={() => navigate(-1)}
            className="px-6 py-3 border border-gray-300 rounded-lg text-gray-700 font-semibold hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmitApplication}
            className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors"
          >
            Submit Application
          </button>
        </div>
      </div>
    </div>
  );
}