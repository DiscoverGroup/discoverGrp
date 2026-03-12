import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Booking, BookingFilters, BookingReportData, DashboardStats, BookingStatus } from '../../types/booking';
import { 
  fetchBookings, 
  updateBookingStatus, 
  deleteBooking, 
  generateBookingReport, 
  getDashboardStats,
  archiveBooking,
  batchArchiveBookings,
  batchDeleteBookings,
} from '../../services/bookingRepo';

// ─── PDF / Print ──────────────────────────────────────────────────────────────
function printBooking(booking: import('../../types/booking').Booking) {
  const statusColors: Record<string, string> = {
    confirmed: '#16a34a',
    pending:   '#d97706',
    cancelled: '#dc2626',
    completed: '#2563eb',
  };
  const statusColor = statusColors[booking.status] ?? '#374151';

  const balance = booking.totalAmount - booking.paidAmount;

  const travelDate = new Date(booking.selectedDate).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric',
  });
  const bookingDate = new Date(booking.bookingDate).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
  const printedDate = new Date().toLocaleDateString('en-PH', {
    year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  const appointmentBlock = (booking.appointmentDate && booking.appointmentTime) ? `
    <div class="section">
      <div class="section-title" style="color:#1d4ed8;border-color:#93c5fd;">Office Appointment</div>
      <table class="info-table">
        <tr><td class="label">Date</td><td>${new Date(booking.appointmentDate).toLocaleDateString('en-PH', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}</td></tr>
        <tr><td class="label">Time</td><td>${booking.appointmentTime}</td></tr>
        ${booking.appointmentPurpose ? `<tr><td class="label">Purpose</td><td>${booking.appointmentPurpose.replace(/_/g,' ')}</td></tr>` : ''}
        <tr><td class="label">Location</td><td>Discover Group Travel and Tours Office</td></tr>
      </table>
    </div>` : '';

  const notesBlock = booking.notes ? `
    <div class="section">
      <div class="section-title">Additional Notes</div>
      <p style="color:#374151;font-size:13px;">${booking.notes}</p>
    </div>` : '';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Booking Confirmation – ${booking.bookingId}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box;}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#111827;background:#fff;padding:32px;}
    .header{display:flex;align-items:center;justify-content:space-between;border-bottom:3px solid #1e3a8a;padding-bottom:16px;margin-bottom:24px;}
    .company h1{font-size:22px;font-weight:700;color:#1e3a8a;letter-spacing:-0.5px;}
    .company p{font-size:11px;color:#6b7280;margin-top:2px;}
    .badge{display:inline-block;padding:5px 14px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:0.5px;text-transform:uppercase;background:${statusColor}20;color:${statusColor};border:1px solid ${statusColor}60;}
    .booking-id{font-size:11px;color:#6b7280;margin-top:6px;}
    .booking-id span{font-weight:700;color:#111827;}
    .section{margin-bottom:20px;}
    .section-title{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:0.6px;color:#1e3a8a;border-bottom:1px solid #bfdbfe;padding-bottom:4px;margin-bottom:10px;}
    .info-table{width:100%;border-collapse:collapse;}
    .info-table tr:nth-child(even){background:#f9fafb;}
    .info-table td{padding:5px 8px;font-size:13px;}
    .label{font-weight:600;color:#374151;width:38%;}
    .payment-box{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;padding:12px 16px;margin-top:8px;}
    .payment-box.has-balance{background:#fff7ed;border-color:#fed7aa;}
    .total-row{font-weight:700;font-size:14px;}
    .balance-row{color:#b45309;font-weight:700;}
    .footer{margin-top:32px;border-top:1px solid #e5e7eb;padding-top:12px;display:flex;justify-content:space-between;font-size:11px;color:#9ca3af;}
    @media print{
      body{padding:20px;}
      @page{margin:1.5cm;size:A4;}
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="company">
      <h1>Discover Group Travel &amp; Tours</h1>
      <p>Official Booking Confirmation</p>
    </div>
    <div style="text-align:right;">
      <div class="badge">${booking.status}</div>
      <div class="booking-id">Booking ID: <span>${booking.bookingId}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Booking Information</div>
    <table class="info-table">
      <tr><td class="label">Booking Date</td><td>${bookingDate}</td></tr>
      <tr><td class="label">Passengers</td><td>${booking.passengers}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Customer Information</div>
    <table class="info-table">
      <tr><td class="label">Full Name</td><td>${booking.customerName}</td></tr>
      <tr><td class="label">Email</td><td>${booking.customerEmail}</td></tr>
      <tr><td class="label">Phone</td><td>${booking.customerPhone}</td></tr>
      ${booking.customerPassport ? `<tr><td class="label">Passport No.</td><td>${booking.customerPassport}</td></tr>` : ''}
    </table>
  </div>

  <div class="section">
    <div class="section-title">Tour Information</div>
    <table class="info-table">
      <tr><td class="label">Tour</td><td><strong>${booking.tour?.title ?? 'N/A'}</strong></td></tr>
      <tr><td class="label">Duration</td><td>${booking.tour?.durationDays ?? '–'} days</td></tr>
      <tr><td class="label">Travel Date</td><td>${travelDate}</td></tr>
    </table>
  </div>

  <div class="section">
    <div class="section-title">Payment Information</div>
    <div class="payment-box${balance > 0 ? ' has-balance' : ''}">
      <table class="info-table">
        <tr><td class="label">Price per Person</td><td>PHP ${(booking.perPerson ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
        <tr class="total-row"><td class="label">Total Amount</td><td>PHP ${(booking.totalAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td class="label">Paid Amount</td><td style="color:#16a34a;font-weight:600;">PHP ${(booking.paidAmount ?? 0).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>
        <tr><td class="label">Payment Type</td><td style="text-transform:capitalize;">${booking.paymentType}${booking.paymentType === 'downpayment' ? ' (30%)' : ''}</td></tr>
        ${balance > 0 ? `<tr class="balance-row"><td class="label">Balance Due</td><td>PHP ${balance.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</td></tr>` : ''}
      </table>
    </div>
  </div>

  ${appointmentBlock}
  ${notesBlock}

  <div class="footer">
    <span>Printed: ${printedDate}</span>
    <span>Discover Group Travel &amp; Tours — Official Document</span>
  </div>

  <script>window.onload = function(){ window.print(); };</script>
</body>
</html>`;

  const w = window.open('', '_blank', 'width=850,height=1100');
  if (w) {
    w.document.write(html);
    w.document.close();
  }
}
// ──────────────────────────────────────────────────────────────────────────────

// Utility functions
function formatCurrency(amount: number | undefined | null): string {
  if (typeof amount !== 'number' || isNaN(amount)) return 'PHP 0.00';
  return `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case 'confirmed':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'pending':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'cancelled':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'completed':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// Status Badge Component
function StatusBadge({ status }: { status: BookingStatus }) {
  const getIcon = () => {
    switch (status) {
      case 'confirmed': return '✓';
      case 'pending': return '⏳';
      case 'cancelled': return '✗';
      case 'completed': return '🎉';
      default: return '?';
    }
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(status)}`}>
      <span className="mr-1">{getIcon()}</span>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

// Dashboard Stats Component
function DashboardStatsCard({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-blue-100">
            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-gray-500">Total Bookings</h3>
            <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
            <p className="text-sm text-gray-600">Today: {stats.todayBookings}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-green-100">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-gray-500">Total Revenue</h3>
            <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalRevenue)}</p>
            <p className="text-sm text-gray-600">Today: {formatCurrency(stats.todayRevenue)}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-purple-100">
            <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-gray-500">Weekly Growth</h3>
            <p className="text-2xl font-bold text-gray-900">{typeof stats.weeklyGrowth === 'number' && !isNaN(stats.weeklyGrowth) ? stats.weeklyGrowth.toFixed(1) : '0.0'}%</p>
            <p className="text-sm text-gray-600">vs last week</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="flex items-center">
          <div className="p-3 rounded-full bg-orange-100">
            <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div className="ml-4">
            <h3 className="text-sm font-medium text-gray-500">Monthly Growth</h3>
            <p className="text-2xl font-bold text-gray-900">{typeof stats.monthlyGrowth === 'number' && !isNaN(stats.monthlyGrowth) ? stats.monthlyGrowth.toFixed(1) : '0.0'}%</p>
            <p className="text-sm text-gray-600">vs last month</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Filters Component
interface FiltersProps {
  filters: BookingFilters;
  onFiltersChange: (filters: BookingFilters) => void;
  onGenerateReport: (period: 'day' | 'week' | 'month' | 'year') => void;
}

function BookingFilters({ filters, onFiltersChange, onGenerateReport }: FiltersProps) {
  return (
    <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters & Reports</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Start Date</label>
          <input
            type="date"
            value={filters.startDate || ''}
            onChange={(e) => onFiltersChange({ ...filters, startDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
          <input
            type="date"
            value={filters.endDate || ''}
            onChange={(e) => onFiltersChange({ ...filters, endDate: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
          <select
            value={filters.status || 'all'}
            onChange={(e) => onFiltersChange({ ...filters, status: e.target.value as BookingStatus | 'all' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Customer Search</label>
          <input
            type="text"
            placeholder="Name or email..."
            value={filters.customerId || ''}
            onChange={(e) => onFiltersChange({ ...filters, customerId: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700 self-center">Generate Report:</span>
        {(['day', 'week', 'month', 'year'] as const).map((period) => (
          <button
            key={period}
            onClick={() => onGenerateReport(period)}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-md hover:bg-blue-200 transition-colors"
          >
            {period.charAt(0).toUpperCase() + period.slice(1)}ly
          </button>
        ))}
      </div>
    </div>
  );
}

// Booking Detail Modal Component
function BookingDetailModal({ booking, onClose, onPrint }: { booking: Booking; onClose: () => void; onPrint: () => void }) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Booking Details</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Booking Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Booking Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Booking ID:</span>
                <span className="text-sm font-semibold text-gray-900">{booking.bookingId}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Booking Date:</span>
                <span className="text-sm text-gray-900">{formatDate(booking.bookingDate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Status:</span>
                <StatusBadge status={booking.status} />
              </div>
            </div>
          </div>

          {/* Customer Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Customer Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Name:</span>
                <span className="text-sm text-gray-900">{booking.customerName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Email:</span>
                <span className="text-sm text-gray-900">{booking.customerEmail}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Phone:</span>
                <span className="text-sm text-gray-900">{booking.customerPhone}</span>
              </div>
              {booking.customerPassport && (
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-gray-600">Passport:</span>
                  <span className="text-sm text-gray-900">{booking.customerPassport}</span>
                </div>
              )}
            </div>
          </div>

          {/* Tour Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Tour Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Tour:</span>
                <span className="text-sm text-gray-900 font-semibold">{booking.tour.title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Duration:</span>
                <span className="text-sm text-gray-900">{booking.tour.durationDays} days</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Travel Date:</span>
                <span className="text-sm text-gray-900">
                  {new Date(booking.selectedDate).toLocaleDateString('en-PH', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Passengers:</span>
                <span className="text-sm text-gray-900">{booking.passengers}</span>
              </div>
            </div>
          </div>

          {/* Payment Information */}
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-3">Payment Information</h3>
            <div className="bg-gray-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Price per Person:</span>
                <span className="text-sm text-gray-900">{formatCurrency(booking.perPerson)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Total Amount:</span>
                <span className="text-sm font-bold text-gray-900">{formatCurrency(booking.totalAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Paid Amount:</span>
                <span className="text-sm text-green-700 font-semibold">{formatCurrency(booking.paidAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Payment Type:</span>
                <span className="text-sm text-gray-900 capitalize">
                  {booking.paymentType}
                  {booking.paymentType === 'downpayment' && ' (30%)'}
                </span>
              </div>
              {booking.paidAmount < booking.totalAmount && (
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-sm font-medium text-red-600">Balance Due:</span>
                  <span className="text-sm font-bold text-red-700">
                    {formatCurrency(booking.totalAmount - booking.paidAmount)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Appointment Information */}
          {booking.appointmentDate && booking.appointmentTime && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Appointment Details</h3>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 text-blue-600 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="font-semibold text-blue-900">Office Appointment Scheduled</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-blue-800">Date:</span>
                  <span className="text-sm text-blue-900 font-semibold">
                    {new Date(booking.appointmentDate).toLocaleDateString('en-PH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      weekday: 'long'
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm font-medium text-blue-800">Time:</span>
                  <span className="text-sm text-blue-900 font-semibold">{booking.appointmentTime}</span>
                </div>
                {booking.appointmentPurpose && (
                  <div className="flex justify-between">
                    <span className="text-sm font-medium text-blue-800">Purpose:</span>
                    <span className="text-sm text-blue-900 capitalize">{booking.appointmentPurpose.replace(/_/g, ' ')}</span>
                  </div>
                )}
                <div className="mt-3 pt-3 border-t border-blue-200 text-xs text-blue-700">
                  <p>📍 Location: Discover Group Travel and Tours Office</p>
                  <p className="mt-1">📞 Contact: +63 123 456 7890</p>
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          {booking.notes && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Additional Notes</h3>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm text-gray-700">{booking.notes}</p>
              </div>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-gray-50 border-t px-6 py-4 flex items-center justify-between">
          <button
            onClick={onPrint}
            className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            Print / Download PDF
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// Main Component
export default function ManageBookings() {
  const navigate = useNavigate();
  const [filteredBookings, setFilteredBookings] = useState<Booking[]>([]);
  const [dashboardStats, setDashboardStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<BookingFilters>({});
  const [reportData, setReportData] = useState<BookingReportData[]>([]);
  const [showReports, setShowReports] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadBookings = useCallback(async () => {
    try {
      setLoading(true);
      const [bookingsData, statsData] = await Promise.all([
        fetchBookings(filters),
        getDashboardStats()
      ]);
      setFilteredBookings(bookingsData);
      setDashboardStats(statsData);
      setError(null);
    } catch (err) {
      console.error('Error loading bookings:', err);
      setError('Failed to load bookings. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const handleStatusChange = async (bookingId: string, newStatus: BookingStatus) => {
    try {
      await updateBookingStatus(bookingId, newStatus);
      loadBookings(); // Reload data
    } catch (err) {
      console.error('Error updating booking status:', err);
      setError('Failed to update booking status. Please try again.');
    }
  };

  const handleDeleteBooking = async (bookingId: string) => {
    if (!confirm('Are you sure you want to delete this booking? This action cannot be undone.')) {
      return;
    }

    try {
      await deleteBooking(bookingId);
      loadBookings(); // Reload data
    } catch (err) {
      console.error('Error deleting booking:', err);
      setError('Failed to delete booking. Please try again.');
    }
  };

  const handleArchiveBooking = async (bookingId: string) => {
    try {
      await archiveBooking(bookingId);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(bookingId); return n; });
      loadBookings();
    } catch (err) {
      console.error('Error archiving booking:', err);
      setError('Failed to archive booking. Please try again.');
    }
  };

  const handleBatchArchive = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Archive ${selectedIds.size} selected booking(s)? They can be restored from the Archive page.`)) return;
    try {
      await batchArchiveBookings(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadBookings();
    } catch (err) {
      console.error('Error batch archiving:', err);
      setError('Failed to archive selected bookings.');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} selected booking(s)? This cannot be undone.`)) return;
    try {
      await batchDeleteBookings(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadBookings();
    } catch (err) {
      console.error('Error batch deleting:', err);
      setError('Failed to delete selected bookings.');
    }
  };

  const handleToggleSelect = (bookingId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId);
      else next.add(bookingId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === filteredBookings.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredBookings.map(b => b.bookingId)));
    }
  };

  const handleGenerateReport = async (period: 'day' | 'week' | 'month' | 'year') => {
    try {
      setLoading(true);
      const reportResult = await generateBookingReport(period, filters.startDate, filters.endDate);
      setReportData(reportResult);
      setShowReports(true);
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Booking ID',
      'Customer Name',
      'Customer Email',
      'Tour Title',
      'Travel Date',
      'Passengers',
      'Total Amount',
      'Paid Amount',
      'Payment Type',
      'Status',
      'Booking Date',
      'Appointment Date',
      'Appointment Time',
      'Appointment Purpose'
    ];

    const csvData = filteredBookings.map(booking => [
      booking.bookingId,
      booking.customerName,
      booking.customerEmail,
      booking.tour.title,
      new Date(booking.selectedDate).toLocaleDateString(),
      booking.passengers.toString(),
      booking.totalAmount.toString(),
      booking.paidAmount.toString(),
      booking.paymentType,
      booking.status,
      new Date(booking.bookingDate).toLocaleDateString(),
      booking.appointmentDate || 'N/A',
      booking.appointmentTime || 'N/A',
      booking.appointmentPurpose || 'N/A'
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `bookings-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Manage Booked Tours</h1>
          <p className="text-gray-600">Monitor and manage all tour bookings</p>
        </div>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button
            onClick={() => navigate('/bookings/archive')}
            className="inline-flex items-center px-4 py-2 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg hover:bg-amber-200 transition-colors font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4" />
            </svg>
            View Archive
          </button>
          <button
            onClick={loadBookings}
            className="inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Refresh
          </button>
          <button
            onClick={exportToCSV}
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Batch action toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-blue-800">
            {selectedIds.size} booking{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBatchArchive}
            className="inline-flex items-center px-3 py-1.5 bg-amber-500 text-white text-sm rounded-md hover:bg-amber-600 transition-colors font-medium"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4" />
            </svg>
            Archive Selected
          </button>
          <button
            onClick={handleBatchDelete}
            className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Selected
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-blue-600 hover:text-blue-800 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {dashboardStats && <DashboardStatsCard stats={dashboardStats} />}

      <BookingFilters 
        filters={filters} 
        onFiltersChange={setFilters} 
        onGenerateReport={handleGenerateReport}
      />

      {showReports && reportData.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Report Results</h3>
            <button
              onClick={() => setShowReports(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr key="report-header">
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Avg Value</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status Breakdown</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {reportData.map((data) => (
                  <tr key={data.period}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {data.period}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.totalBookings}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(data.totalRevenue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatCurrency(data.averageBookingValue)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <div className="flex space-x-2">
                        <span className="text-green-600">✓{data.confirmedBookings}</span>
                        <span className="text-yellow-600">⏳{data.pendingBookings}</span>
                        <span className="text-red-600">✗{data.cancelledBookings}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {filteredBookings.length === 0 ? (
          <div className="p-8 text-center">
            <div className="text-gray-400 mb-4">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
            <p className="text-gray-600">No bookings match your current filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr key="bookings-header">
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={filteredBookings.length > 0 && selectedIds.size === filteredBookings.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      title="Select all"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Booking Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tour</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Travel Date</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.map((booking) => (
                  <tr key={booking.id} className={`hover:bg-gray-50 ${selectedIds.has(booking.bookingId) ? 'bg-blue-50' : ''}`}>
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(booking.bookingId)}
                        onChange={() => handleToggleSelect(booking.bookingId)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{booking.bookingId}</div>
                        <div className="text-sm text-gray-500">{formatDate(booking.bookingDate)}</div>
                        <div className="text-xs text-gray-400">{booking.passengers} passenger{booking.passengers > 1 ? 's' : ''}</div>
                        {booking.appointmentDate && booking.appointmentTime && (
                          <div className="mt-2 inline-flex items-center px-2 py-1 rounded-md bg-blue-50 border border-blue-200">
                            <svg className="w-3 h-3 text-blue-600 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span className="text-xs font-medium text-blue-700">Appointment Scheduled</span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{booking.customerName}</div>
                        <div className="text-sm text-gray-500">{booking.customerEmail}</div>
                        <div className="text-sm text-gray-500">{booking.customerPhone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">{booking.tour ? booking.tour.title : 'Unknown Tour'}</div>
                        <div className="text-sm text-gray-500">{booking.tour ? `${booking.tour.durationDays} days` : ''}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {new Date(booking.selectedDate).toLocaleDateString('en-PH', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{formatCurrency(booking.totalAmount)}</div>
                        <div className="text-sm text-gray-500">Paid: {formatCurrency(booking.paidAmount)}</div>
                        <div className="text-xs text-gray-400 capitalize">
                          {booking.paymentType}
                          {booking.paymentType === 'downpayment' && ' (30%)'}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-2">
                        <StatusBadge status={booking.status} />
                        <select
                          value={booking.status}
                          onChange={(e) => handleStatusChange(booking.bookingId, e.target.value as BookingStatus)}
                          className="text-xs px-2 py-1 rounded border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="confirmed">Confirmed</option>
                          <option value="pending">Pending</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setSelectedBooking(booking)}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => printBooking(booking)}
                          className="text-indigo-600 hover:text-indigo-800"
                          title="Print / Download PDF"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleArchiveBooking(booking.bookingId)}
                          className="text-amber-500 hover:text-amber-700"
                          title="Archive Booking"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteBooking(booking.bookingId)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete Booking"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {filteredBookings.length > 0 && (
        <div className="flex items-center justify-between text-sm text-gray-700">
          <span>Showing {filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}</span>
          <span>Total Revenue: {formatCurrency(filteredBookings.reduce((sum, b) => sum + b.totalAmount, 0))}</span>
        </div>
      )}

      {/* Booking Detail Modal */}
      {selectedBooking && (
        <BookingDetailModal
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onPrint={() => printBooking(selectedBooking)}
        />
      )}
    </div>
  );
}