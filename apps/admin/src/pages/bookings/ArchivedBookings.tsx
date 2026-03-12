import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Booking, BookingFilters, BookingStatus } from '../../types/booking';
import {
  fetchArchivedBookings,
  restoreBooking,
  deleteBooking,
  batchRestoreBookings,
  batchDeleteBookings,
} from '../../services/bookingRepo';

// ── Utilities ─────────────────────────────────────────────────────────────────
function formatCurrency(amount: number | undefined | null): string {
  if (typeof amount !== 'number' || isNaN(amount)) return 'PHP 0.00';
  return `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString('en-PH', {
    year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function getStatusColor(status: BookingStatus): string {
  switch (status) {
    case 'confirmed': return 'bg-green-100 text-green-800 border-green-200';
    case 'pending':   return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
    case 'completed': return 'bg-blue-100 text-blue-800 border-blue-200';
    default:          return 'bg-gray-100 text-gray-800 border-gray-200';
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function ArchivedBookings() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState<BookingFilters>({});
  const [search, setSearch] = useState('');

  const loadArchived = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchArchivedBookings({ ...filters, customerId: search || undefined });
      setBookings(data);
      setError(null);
    } catch (err) {
      console.error('Error loading archived bookings:', err);
      setError('Failed to load archived bookings.');
    } finally {
      setLoading(false);
    }
  }, [filters, search]);

  useEffect(() => {
    loadArchived();
  }, [loadArchived]);

  // ── Selection ───────────────────────────────────────────────────────────────
  const handleToggleSelect = (bookingId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(bookingId)) next.delete(bookingId); else next.add(bookingId);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === bookings.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(bookings.map(b => b.bookingId)));
  };

  // ── Single actions ──────────────────────────────────────────────────────────
  const handleRestore = async (bookingId: string) => {
    try {
      await restoreBooking(bookingId);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(bookingId); return n; });
      loadArchived();
    } catch {
      setError('Failed to restore booking.');
    }
  };

  const handleDelete = async (bookingId: string) => {
    if (!confirm('Permanently delete this booking? This cannot be undone.')) return;
    try {
      await deleteBooking(bookingId);
      setSelectedIds(prev => { const n = new Set(prev); n.delete(bookingId); return n; });
      loadArchived();
    } catch {
      setError('Failed to delete booking.');
    }
  };

  // ── Batch actions ───────────────────────────────────────────────────────────
  const handleBatchRestore = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Restore ${selectedIds.size} booking(s) back to active?`)) return;
    try {
      await batchRestoreBookings(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadArchived();
    } catch {
      setError('Failed to restore selected bookings.');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Permanently delete ${selectedIds.size} booking(s)? This cannot be undone.`)) return;
    try {
      await batchDeleteBookings(Array.from(selectedIds));
      setSelectedIds(new Set());
      loadArchived();
    } catch {
      setError('Failed to delete selected bookings.');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-500 mx-auto mb-4" />
          <p className="text-gray-600">Loading archived bookings…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/bookings')}
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            title="Back to Bookings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <svg className="w-6 h-6 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4" />
              </svg>
              Archived Bookings
            </h1>
            <p className="text-gray-600">View, restore, or permanently delete archived bookings</p>
          </div>
        </div>
        <button
          onClick={loadArchived}
          className="mt-4 sm:mt-0 inline-flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors font-medium"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      )}

      {/* Filter bar */}
      <div className="bg-white rounded-lg border shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-48">
          <label className="block text-xs font-medium text-gray-600 mb-1">Search Customer</label>
          <input
            type="text"
            placeholder="Name or email…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <select
            value={filters.status ?? 'all'}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value as BookingStatus | 'all' }))}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="all">All Statuses</option>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Batch toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
          <span className="text-sm font-medium text-amber-800">
            {selectedIds.size} booking{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button
            onClick={handleBatchRestore}
            className="inline-flex items-center px-3 py-1.5 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Restore Selected
          </button>
          <button
            onClick={handleBatchDelete}
            className="inline-flex items-center px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            Delete Permanently
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-sm text-amber-700 hover:text-amber-900 underline"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
        {bookings.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-amber-300 mb-4">
              <svg className="mx-auto h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8l1 12a2 2 0 002 2h8a2 2 0 002-2l1-12M10 12v4m4-4v4" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">No archived bookings</h3>
            <p className="text-gray-500 text-sm">Bookings you archive will appear here. You can restore them at any time.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-amber-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={bookings.length > 0 && selectedIds.size === bookings.length}
                      onChange={handleSelectAll}
                      className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      title="Select all"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Booking Details</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Tour</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Payment</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Archived</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {bookings.map(booking => (
                  <tr key={booking.id} className={`hover:bg-gray-50 ${selectedIds.has(booking.bookingId) ? 'bg-amber-50' : ''}`}>
                    {/* Checkbox */}
                    <td className="px-4 py-4">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(booking.bookingId)}
                        onChange={() => handleToggleSelect(booking.bookingId)}
                        className="rounded border-gray-300 text-amber-600 focus:ring-amber-500"
                      />
                    </td>

                    {/* Booking Details */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.bookingId}</div>
                      <div className="text-xs text-gray-500">{formatDate(booking.bookingDate)}</div>
                      <div className="text-xs text-gray-400">{booking.passengers} passenger{booking.passengers > 1 ? 's' : ''}</div>
                    </td>

                    {/* Customer */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{booking.customerName}</div>
                      <div className="text-xs text-gray-500">{booking.customerEmail}</div>
                      {booking.customerPhone && (
                        <div className="text-xs text-gray-500">{booking.customerPhone}</div>
                      )}
                    </td>

                    {/* Tour */}
                    <td className="px-6 py-4">
                      <div className="max-w-xs">
                        <div className="text-sm font-medium text-gray-900 truncate">
                          {booking.tour ? booking.tour.title : 'Unknown Tour'}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(booking.selectedDate).toLocaleDateString('en-PH', {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </div>
                      </div>
                    </td>

                    {/* Payment */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{formatCurrency(booking.totalAmount)}</div>
                      <div className="text-xs text-gray-500">Paid: {formatCurrency(booking.paidAmount)}</div>
                      <div className="text-xs text-gray-400 capitalize">{booking.paymentType}</div>
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(booking.status)}`}>
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </span>
                    </td>

                    {/* Archived at */}
                    <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500">
                      {booking.archivedAt ? formatDate(booking.archivedAt) : '—'}
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleRestore(booking.bookingId)}
                          className="inline-flex items-center px-2.5 py-1 bg-green-100 text-green-700 text-xs rounded-md hover:bg-green-200 transition-colors font-medium"
                          title="Restore booking"
                        >
                          <svg className="w-3.5 h-3.5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                          </svg>
                          Restore
                        </button>
                        <button
                          onClick={() => handleDelete(booking.bookingId)}
                          className="text-red-500 hover:text-red-700 transition-colors"
                          title="Delete permanently"
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

      {/* Footer count */}
      {bookings.length > 0 && (
        <div className="text-sm text-gray-600">
          {bookings.length} archived booking{bookings.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  );
}
