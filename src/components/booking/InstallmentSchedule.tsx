import React, { useState, useMemo, useCallback } from "react";
import type { Booking, InstallmentPayment } from "../../types";

function formatCurrencyPHP(amount: number) {
  return `PHP ${amount.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

interface InstallmentScheduleProps {
  booking: Booking;
  onPayInstallment?: (payment: InstallmentPayment) => void;
}

function InstallmentScheduleComponent({ booking, onPayInstallment }: InstallmentScheduleProps) {
  const [expanded, setExpanded] = useState(false);
  
  // Memoize payment plan calculations
  const paymentStats = useMemo(() => {
    if (!booking.installmentPlan) {
      return { paidPayments: 0, totalPayments: 0, progressPercentage: 0, totalRemaining: 0 };
    }
    
    const { payments } = booking.installmentPlan;
    const paidPayments = payments.filter(p => p.status === "paid").length;
    const totalPayments = payments.length;
    const progressPercentage = totalPayments > 0 ? (paidPayments / totalPayments) * 100 : 0;
    const totalRemaining = payments
      .filter(p => p.status !== "paid")
      .reduce((sum, p) => sum + p.amount, 0);
    
    return { paidPayments, totalPayments, progressPercentage, totalRemaining };
  }, [booking.installmentPlan]);
  
  // Memoize toggle handler
  const toggleExpanded = useCallback(() => {
    setExpanded(prev => !prev);
  }, []);
  
  // Memoize payment handler
  const handlePayment = useCallback((payment: InstallmentPayment) => {
    if (onPayInstallment) {
      onPayInstallment(payment);
    }
  }, [onPayInstallment]);
  
  if (!booking.installmentPlan || booking.paymentType !== "downpayment") {
    return null;
  }

  const { installmentPlan } = booking;
  const { paidPayments, totalPayments, progressPercentage, totalRemaining } = paymentStats;

  const getStatusBadge = (status: InstallmentPayment["status"]) => {
    switch (status) {
      case "paid":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 border border-green-200">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Paid
          </span>
        );
      case "overdue":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 border border-red-200">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Overdue
          </span>
        );
      case "pending":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 border border-yellow-200">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Pending
          </span>
        );
    }
  };

  return (
    <div className="mt-4 border-t-2 border-gray-200 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
          </svg>
          <h4 className="font-bold text-gray-900">
            Payment Plan ({installmentPlan.totalMonths} months)
          </h4>
        </div>
        <button
          onClick={toggleExpanded}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
          aria-label={expanded ? "Hide payment schedule" : "Show payment schedule"}
        >
          {expanded ? "Hide" : "Show"} Schedule
          <svg
            className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray-700 mb-2">
          <span>Progress: {paidPayments} of {totalPayments} payments</span>
          <span className="font-semibold">{Math.round(progressPercentage)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div
            className="bg-gradient-to-r from-green-500 to-green-600 h-3 rounded-full transition-all duration-500"
            style={{ width: `${progressPercentage}%` }}
          />
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 bg-gray-50 rounded-xl p-4 border border-gray-200">
          <div className="grid grid-cols-12 gap-2 text-xs font-bold text-gray-700 uppercase tracking-wider pb-2 border-b border-gray-300">
            <div className="col-span-1">#</div>
            <div className="col-span-4">Due Date</div>
            <div className="col-span-3">Amount</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-2">Action</div>
          </div>
          {installmentPlan.payments.map((payment, index) => {
            const dueDate = new Date(payment.dueDate);
            const today = new Date();
            const isOverdue = payment.status === "pending" && dueDate < today;
            const isPaid = payment.status === "paid";

            return (
              <div
                key={payment.id}
                className={`grid grid-cols-12 gap-2 items-center py-3 px-2 rounded-lg text-sm ${
                  isPaid ? "bg-green-50 border border-green-200" : 
                  isOverdue ? "bg-red-50 border border-red-200" : 
                  "bg-white border border-gray-200"
                }`}
              >
                <div className="col-span-1 font-semibold text-gray-700">
                  {index + 1}
                </div>
                <div className="col-span-4 text-gray-900">
                  <div className="font-medium">
                    {dueDate.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                  </div>
                  {isPaid && payment.paidDate && (
                    <div className="text-xs text-green-600">
                      Paid: {new Date(payment.paidDate).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                    </div>
                  )}
                </div>
                <div className="col-span-3 font-semibold text-gray-900">
                  {formatCurrencyPHP(payment.amount)}
                </div>
                <div className="col-span-2">
                  {getStatusBadge(isOverdue ? "overdue" : payment.status)}
                </div>
                <div className="col-span-2">
                  {!isPaid && onPayInstallment && (
                    <button
                      onClick={() => handlePayment(payment)}
                      className={`text-xs px-3 py-1.5 rounded-lg font-semibold transition-all ${
                        isOverdue
                          ? "bg-red-600 hover:bg-red-700 text-white"
                          : "bg-blue-600 hover:bg-blue-700 text-white"
                      }`}
                      aria-label={`Pay installment ${index + 1}`}
                    >
                      Pay Now
                    </button>
                  )}
                  {isPaid && (
                    <div className="text-xs text-green-600 font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Complete
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          
          {/* Summary Footer */}
          <div className="pt-3 mt-3 border-t-2 border-gray-300 bg-white rounded-lg p-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-600">Monthly Payment:</div>
                <div className="font-bold text-gray-900 text-lg">{formatCurrencyPHP(installmentPlan.monthlyAmount)}</div>
              </div>
              <div className="text-right">
                <div className="text-gray-600">Total Remaining:</div>
                <div className="font-bold text-orange-600 text-lg">
                  {formatCurrencyPHP(totalRemaining)}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Export memoized component to prevent unnecessary re-renders
export default React.memo(InstallmentScheduleComponent, (prevProps, nextProps) => {
  // Only re-render if booking ID changes or installment plan changes
  return (
    prevProps.booking.id === nextProps.booking.id &&
    prevProps.booking.paidAmount === nextProps.booking.paidAmount &&
    JSON.stringify(prevProps.booking.installmentPlan) === JSON.stringify(nextProps.booking.installmentPlan)
  );
});
