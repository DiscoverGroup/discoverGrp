import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Eye, 
  CheckCircle, 
  Clock, 
  AlertTriangle, 
  User, 
  Globe,
  Calendar,
  Filter,
  Search,
  Plus,
  X,
  Save,
  RefreshCw
} from 'lucide-react';
import { authFetch } from '../utils/tokenStorage';
import { getAdminApiBaseUrl } from '../config/apiBase';

const API_BASE_URL = getAdminApiBaseUrl();

interface VisaApplication {
  _id: string;
  applicationId: string;
  status: 'pending' | 'under_review' | 'documents_requested' | 'approved' | 'rejected' | 'completed';
  applicationDate: string;
  source: 'booking' | 'direct';
  completeName: string;
  passportNumber?: string;
  civilStatus?: string;
  contactNumber?: string;
  emailAddress?: string;
  presentAddress?: string;
  travelHistory?: string;
  companyName?: string;
  jobTitle?: string;
  companyLocation?: string;
  dateHiredOrStarted?: string;
  bookingId?: string;
  tourTitle?: string;
  destinationCountries?: string;
  notes?: string;
  assignedTo?: string;
  createdAt?: string;
}

const statusConfig = {
  pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
  under_review: { color: 'bg-blue-100 text-blue-800', label: 'Under Review' },
  documents_requested: { color: 'bg-orange-100 text-orange-800', label: 'Documents Requested' },
  approved: { color: 'bg-green-100 text-green-800', label: 'Approved' },
  rejected: { color: 'bg-red-100 text-red-800', label: 'Rejected' },
  completed: { color: 'bg-gray-100 text-gray-800', label: 'Completed' }
};

export default function VisaAssistanceManagement() {
  const [applications, setApplications] = useState<VisaApplication[]>([]);
  const [filteredApplications, setFilteredApplications] = useState<VisaApplication[]>([]);
  const [selectedApplication, setSelectedApplication] = useState<VisaApplication | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [isNewApplicationModalOpen, setIsNewApplicationModalOpen] = useState(false);
  const [newApplicationForm, setNewApplicationForm] = useState({
    completeName: '',
    passportNumber: '',
    civilStatus: '',
    contactNumber: '',
    emailAddress: '',
    presentAddress: '',
    travelHistory: '',
    companyName: '',
    jobTitle: '',
    companyLocation: '',
    dateHiredOrStarted: '',
    destinationCountries: '',
    tourTitle: '',
    bookingId: '',
    notes: '',
  });

  const fetchApplications = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await authFetch(`${API_BASE_URL}/admin/visa-applications`);
      if (!res.ok) throw new Error('Failed to fetch visa applications');
      const data = await res.json();
      setApplications(data.applications || []);
    } catch (err) {
      setError('Could not load visa applications. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  useEffect(() => {
    let filtered = applications;
    if (filterStatus !== 'all') {
      filtered = filtered.filter(app => app.status === filterStatus);
    }
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(app =>
        app.completeName.toLowerCase().includes(q) ||
        (app.emailAddress || '').toLowerCase().includes(q) ||
        app.applicationId.toLowerCase().includes(q) ||
        (app.destinationCountries || '').toLowerCase().includes(q) ||
        (app.bookingId || '').toLowerCase().includes(q)
      );
    }
    setFilteredApplications(filtered);
  }, [applications, filterStatus, searchTerm]);

  const updateApplicationStatus = async (id: string, newStatus: VisaApplication['status']) => {
    try {
      const res = await authFetch(`${API_BASE_URL}/admin/visa-applications/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error('Failed to update status');
      setApplications(prev =>
        prev.map(app => app._id === id ? { ...app, status: newStatus } : app)
      );
    } catch {
      alert('Failed to update status. Please try again.');
    }
  };

  const handleCreateNewApplication = async () => {
    try {
      const res = await authFetch(`${API_BASE_URL}/admin/visa-applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newApplicationForm),
      });
      if (!res.ok) throw new Error('Failed to create application');
      const data = await res.json();
      setApplications(prev => [data.application, ...prev]);
      setIsNewApplicationModalOpen(false);
      resetNewApplicationForm();
    } catch {
      alert('Failed to create application. Please try again.');
    }
  };

  const resetNewApplicationForm = () => {
    setNewApplicationForm({
      completeName: '', passportNumber: '', civilStatus: '', contactNumber: '',
      emailAddress: '', presentAddress: '', travelHistory: '', companyName: '',
      jobTitle: '', companyLocation: '', dateHiredOrStarted: '',
      destinationCountries: '', tourTitle: '', bookingId: '', notes: '',
    });
  };

  const handleViewDetails = (application: VisaApplication) => {
    setSelectedApplication(application);
    setShowDetails(true);
  };

  const getStatusIcon = (status: VisaApplication['status']) => {
    switch (status) {
      case 'pending': return <Clock size={16} className="text-yellow-600" />;
      case 'under_review': return <Eye size={16} className="text-blue-600" />;
      case 'documents_requested': return <AlertTriangle size={16} className="text-orange-600" />;
      case 'approved': return <CheckCircle size={16} className="text-green-600" />;
      case 'rejected': return <AlertTriangle size={16} className="text-red-600" />;
      case 'completed': return <CheckCircle size={16} className="text-gray-600" />;
      default: return <Clock size={16} className="text-gray-600" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Visa Assistance Management</h1>
            <p className="text-gray-600 mt-2">Manage visa applications and customer assistance requests</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchApplications}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors flex items-center gap-2"
            >
              <RefreshCw size={16} />
              Refresh
            </button>
            <button
              onClick={() => setIsNewApplicationModalOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <Plus size={20} />
              New Application
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Applications</p>
              <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
            </div>
            <div className="bg-blue-100 p-3 rounded-xl"><FileText className="text-blue-600" size={24} /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Under Review</p>
              <p className="text-2xl font-bold text-blue-600">
                {applications.filter(a => a.status === 'under_review').length}
              </p>
            </div>
            <div className="bg-blue-100 p-3 rounded-xl"><Eye className="text-blue-600" size={24} /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600">
                {applications.filter(a => a.status === 'approved').length}
              </p>
            </div>
            <div className="bg-green-100 p-3 rounded-xl"><CheckCircle className="text-green-600" size={24} /></div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Documents</p>
              <p className="text-2xl font-bold text-orange-600">
                {applications.filter(a => a.status === 'documents_requested').length}
              </p>
            </div>
            <div className="bg-orange-100 p-3 rounded-xl"><AlertTriangle className="text-orange-600" size={24} /></div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <div className="flex flex-col md:flex-row gap-4 items-center">
          <div className="flex items-center gap-2 flex-1">
            <Search size={20} className="text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, ID, destination, or booking..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-2">
            <Filter size={20} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="under_review">Under Review</option>
              <option value="documents_requested">Documents Requested</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>
      </div>

      {/* Applications Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center p-16 text-gray-500">
            <RefreshCw size={24} className="animate-spin mr-3" /> Loading visa applications…
          </div>
        ) : error ? (
          <div className="flex items-center justify-center p-16 text-red-600">
            <AlertTriangle size={24} className="mr-3" /> {error}
          </div>
        ) : filteredApplications.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-16 text-gray-500">
            <FileText size={48} className="mb-4 text-gray-300" />
            <p className="text-lg font-medium">No visa applications found</p>
            <p className="text-sm">Applications will appear here when customers submit via booking or the visa assistance form.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Application</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Customer</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Destination</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Source</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Status</th>
                  <th className="text-left py-4 px-6 font-semibold text-gray-900">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filteredApplications.map((application) => (
                  <tr key={application._id} className="hover:bg-gray-50">
                    <td className="py-4 px-6">
                      <div>
                        <p className="font-medium text-gray-900">{application.applicationId}</p>
                        <p className="text-sm text-gray-600">{application.applicationDate}</p>
                        {application.bookingId && (
                          <p className="text-xs text-blue-600">Booking: {application.bookingId}</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="bg-gray-100 rounded-full p-2">
                          <User size={16} className="text-gray-600" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900">{application.completeName}</p>
                          <p className="text-sm text-gray-600">{application.emailAddress}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <Globe size={16} className="text-gray-400" />
                        <p className="text-gray-900">{application.destinationCountries || '—'}</p>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        application.source === 'booking'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {application.source === 'booking' ? 'From Booking' : 'Direct'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        {getStatusIcon(application.status)}
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusConfig[application.status].color}`}>
                          {statusConfig[application.status].label}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(application)}
                          className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <select
                          value={application.status}
                          onChange={(e) => updateApplicationStatus(application._id, e.target.value as VisaApplication['status'])}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="pending">Pending</option>
                          <option value="under_review">Under Review</option>
                          <option value="documents_requested">Documents Requested</option>
                          <option value="approved">Approved</option>
                          <option value="rejected">Rejected</option>
                          <option value="completed">Completed</option>
                        </select>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Application Details Modal */}
      {showDetails && selectedApplication && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Visa Application Details</h2>
                <p className="text-gray-600">{selectedApplication.applicationId}</p>
              </div>
              <button onClick={() => setShowDetails(false)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Source badge */}
              <div className="flex items-center gap-3">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                  selectedApplication.source === 'booking'
                    ? 'bg-purple-100 text-purple-800'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {selectedApplication.source === 'booking' ? '📋 Generated from Booking' : '📝 Direct Submission'}
                </span>
                {selectedApplication.bookingId && (
                  <span className="text-sm text-blue-600 font-medium">Booking ID: {selectedApplication.bookingId}</span>
                )}
              </div>

              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <User size={18} /> Personal Information
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <DetailRow label="Complete Name" value={selectedApplication.completeName} />
                  <DetailRow label="Passport Number" value={selectedApplication.passportNumber} />
                  <DetailRow label="Civil Status" value={selectedApplication.civilStatus} />
                  <DetailRow label="Contact Number" value={selectedApplication.contactNumber} />
                  <DetailRow label="Email Address" value={selectedApplication.emailAddress} />
                </div>
                {selectedApplication.presentAddress && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-500">Present Address</p>
                    <p className="text-gray-900 mt-1">{selectedApplication.presentAddress}</p>
                  </div>
                )}
              </div>

              {/* Employment Information */}
              {(selectedApplication.companyName || selectedApplication.jobTitle) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Employment / Business</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailRow label="Company / Business" value={selectedApplication.companyName} />
                    <DetailRow label="Position / Job Title" value={selectedApplication.jobTitle} />
                    <DetailRow label="Company Location" value={selectedApplication.companyLocation} />
                    <DetailRow label="Date Hired / Started" value={selectedApplication.dateHiredOrStarted} />
                  </div>
                </div>
              )}

              {/* Travel History */}
              {selectedApplication.travelHistory && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 flex items-center gap-2">
                    <Globe size={18} /> Travel History
                  </h3>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-700 whitespace-pre-wrap">{selectedApplication.travelHistory}</p>
                  </div>
                </div>
              )}

              {/* Tour / Destination */}
              {(selectedApplication.destinationCountries || selectedApplication.tourTitle) && (
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <Calendar size={18} /> Tour / Destination
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailRow label="Destination Countries" value={selectedApplication.destinationCountries} />
                    <DetailRow label="Tour" value={selectedApplication.tourTitle} />
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Notes</h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700 whitespace-pre-wrap">{selectedApplication.notes || 'No notes yet.'}</p>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowDetails(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
              >
                Close
              </button>
              <select
                value={selectedApplication.status}
                onChange={(e) => {
                  const newStatus = e.target.value as VisaApplication['status'];
                  updateApplicationStatus(selectedApplication._id, newStatus);
                  setSelectedApplication(prev => prev ? { ...prev, status: newStatus } : prev);
                }}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="pending">Pending</option>
                <option value="under_review">Under Review</option>
                <option value="documents_requested">Documents Requested</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
                <option value="completed">Completed</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* New Application Modal */}
      {isNewApplicationModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">New Visa Application</h2>
                <button onClick={() => { setIsNewApplicationModalOpen(false); resetNewApplicationForm(); }} className="text-gray-400 hover:text-gray-600">
                  <X size={24} />
                </button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleCreateNewApplication(); }} className="space-y-4">
                {/* Personal */}
                <div className="bg-gray-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-900 flex items-center gap-2"><User size={18} /> Personal Information</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Complete Name *" required>
                      <input type="text" required value={newApplicationForm.completeName} onChange={e => setNewApplicationForm(p => ({ ...p, completeName: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Full name" />
                    </FormField>
                    <FormField label="Passport Number">
                      <input type="text" value={newApplicationForm.passportNumber} onChange={e => setNewApplicationForm(p => ({ ...p, passportNumber: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Passport number" />
                    </FormField>
                    <FormField label="Civil Status">
                      <select value={newApplicationForm.civilStatus} onChange={e => setNewApplicationForm(p => ({ ...p, civilStatus: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                        <option value="">Select</option>
                        <option>Single</option><option>Married</option><option>Widowed</option><option>Separated</option><option>Divorced</option>
                      </select>
                    </FormField>
                    <FormField label="Contact Number">
                      <input type="tel" value={newApplicationForm.contactNumber} onChange={e => setNewApplicationForm(p => ({ ...p, contactNumber: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="+63 9xx xxx xxxx" />
                    </FormField>
                    <FormField label="Email Address">
                      <input type="email" value={newApplicationForm.emailAddress} onChange={e => setNewApplicationForm(p => ({ ...p, emailAddress: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Email" />
                    </FormField>
                  </div>
                  <FormField label="Present Address">
                    <textarea value={newApplicationForm.presentAddress} onChange={e => setNewApplicationForm(p => ({ ...p, presentAddress: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={2} placeholder="Present address" />
                  </FormField>
                  <FormField label="Travel History (countries visited)">
                    <textarea value={newApplicationForm.travelHistory} onChange={e => setNewApplicationForm(p => ({ ...p, travelHistory: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={2} placeholder="e.g. Japan (2022), Singapore (2023)" />
                  </FormField>
                </div>

                {/* Employment */}
                <div className="bg-blue-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">Employment / Business</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Company / Business Name">
                      <input type="text" value={newApplicationForm.companyName} onChange={e => setNewApplicationForm(p => ({ ...p, companyName: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Company name" />
                    </FormField>
                    <FormField label="Position / Job Title">
                      <input type="text" value={newApplicationForm.jobTitle} onChange={e => setNewApplicationForm(p => ({ ...p, jobTitle: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Job title" />
                    </FormField>
                    <FormField label="Company Location">
                      <input type="text" value={newApplicationForm.companyLocation} onChange={e => setNewApplicationForm(p => ({ ...p, companyLocation: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="Location" />
                    </FormField>
                    <FormField label="Date Hired / Business Started">
                      <input type="date" value={newApplicationForm.dateHiredOrStarted} onChange={e => setNewApplicationForm(p => ({ ...p, dateHiredOrStarted: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" />
                    </FormField>
                  </div>
                </div>

                {/* Tour details */}
                <div className="bg-green-50 rounded-lg p-4 space-y-4">
                  <h3 className="font-semibold text-gray-900">Tour / Destination</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FormField label="Destination Countries">
                      <input type="text" value={newApplicationForm.destinationCountries} onChange={e => setNewApplicationForm(p => ({ ...p, destinationCountries: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="e.g. France, Italy" />
                    </FormField>
                    <FormField label="Booking ID (optional)">
                      <input type="text" value={newApplicationForm.bookingId} onChange={e => setNewApplicationForm(p => ({ ...p, bookingId: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" placeholder="BK-XXXXXXX" />
                    </FormField>
                  </div>
                </div>

                {/* Notes */}
                <FormField label="Notes">
                  <textarea value={newApplicationForm.notes} onChange={e => setNewApplicationForm(p => ({ ...p, notes: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent" rows={3} placeholder="Additional notes..." />
                </FormField>

                <div className="flex justify-end gap-3 pt-4 border-t">
                  <button type="button" onClick={() => { setIsNewApplicationModalOpen(false); resetNewApplicationForm(); }} className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button type="submit" className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <Save size={16} /> Create Application
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value?: string }) {
  return (
    <div>
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="text-gray-900 mt-0.5">{value || '—'}</p>
    </div>
  );
}

function FormField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}{required && <span className="text-red-500 ml-1">*</span>}</label>
      {children}
    </div>
  );
}
