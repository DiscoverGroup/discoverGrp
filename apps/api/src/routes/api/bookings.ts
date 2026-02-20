
import express from "express";
import Booking from "../../models/Booking";
import VisaApplication from "../../models/VisaApplication";
import { sendBookingConfirmationEmail } from "../../services/emailService";
import { evaluateVisaReadiness } from "../../services/visa-readiness";

const router = express.Router();

const isVisaReadinessEnabled = () => {
  const value = process.env.VISA_READINESS_ENABLED;
  if (typeof value !== 'string') {
    return true;
  }

  return !['0', 'false', 'off', 'no'].includes(value.toLowerCase());
};

// GET /api/bookings - get all bookings
router.get("/", async (req, res) => {
  try {
    // No need to populate tour since we store tourSlug directly
    const bookings = await Booking.find().sort({ createdAt: -1 }); // Sort by newest first
    console.log(`📋 Fetched ${bookings.length} bookings from MongoDB`);
    res.json(bookings);
  } catch (err) {
    console.error("Error fetching bookings:", err);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// POST /api/bookings - create a new booking
router.post("/", async (req, res) => {
  try {
    const {
      tourSlug,
      customerName,
      customerEmail,
      customerPhone,
      customerPassport,
      selectedDate,
      passengers,
      perPerson,
      totalAmount,
      paidAmount,
      paymentType,
      status,
      bookingId,
      bookingDate,
      paymentIntentId,
      notes,
      appointmentDate,
      appointmentTime,
      appointmentPurpose,
      customRoutes,
      visaAssistanceRequested,
      visaPaxDetails,
      visaDocumentsProvided,
      visaDestinationCountries,
      visaAssistanceStatus,
      visaAssistanceNotes,
      travelInsuranceRequested,
      travelInsuranceFee,
      insurancePaxDetails,
      nationality
    } = req.body;

    // Note: Tours are served from JSON files, not MongoDB
    // So we'll store the tour slug directly instead of a MongoDB reference
    console.log('📝 Creating booking for tour slug:', tourSlug);
    if (customRoutes && customRoutes.length > 0) {
      console.log('📋 Combined tour with', customRoutes.length, 'custom route(s)');
    }

    let visaReadinessScore: number | undefined;
    let visaReadinessStatus: 'ready' | 'attention' | 'not_ready' | undefined;
    let visaReadinessSnapshot:
      | {
          score: number;
          status: 'ready' | 'attention' | 'not_ready';
          blockers: Array<{ code: string; message: string; level: 'critical' | 'high' | 'medium' | 'low'; country?: string }>;
          warnings: Array<{ code: string; message: string; level: 'critical' | 'high' | 'medium' | 'low'; country?: string }>;
          nextActions: string[];
          ruleSummary: {
            countries: string[];
            strictestPassportValidityMonths: number;
            strictestVisaLeadDays: number;
            visaRequiredCountries: string[];
            evisaCountries: string[];
          };
          evaluatedAt: string;
        }
      | undefined;

    if (isVisaReadinessEnabled() && typeof tourSlug === 'string' && typeof selectedDate === 'string') {
      try {
        const readiness = await evaluateVisaReadiness({
          tourSlug,
          departureDate: selectedDate,
          nationality: typeof nationality === 'string' ? nationality : 'philippines',
          passportExpiryDate: typeof customerPassport === 'string' ? customerPassport : undefined,
          documents: {
            hasPassport: Boolean(customerPassport),
            hasVisa: Boolean(visaDocumentsProvided),
            hasSupportingDocuments: Boolean(visaDocumentsProvided),
          },
        });

        visaReadinessScore = readiness.score;
        visaReadinessStatus = readiness.status;
        visaReadinessSnapshot = readiness;
      } catch (readinessError) {
        console.warn('⚠️ Visa readiness evaluation failed (non-critical):', readinessError);
      }
    }

    // Create the booking
    const booking = await Booking.create({
      tourSlug: tourSlug, // Store slug directly instead of MongoDB reference
      customerName,
      customerEmail,
      customerPhone,
      customerPassport,
      selectedDate,
      passengers,
      perPerson,
      totalAmount,
      paidAmount,
      paymentType,
      status,
      bookingId,
      bookingDate,
      paymentIntentId,
      notes,
      appointmentDate,
      appointmentTime,
      appointmentPurpose,
      customRoutes: customRoutes || [],
      visaAssistanceRequested: visaAssistanceRequested || false,
      visaAssistanceFee: visaAssistanceRequested ? 10000 : 0,
      visaPaxDetails: visaPaxDetails || [],
      visaDocumentsProvided: visaDocumentsProvided || false,
      visaDestinationCountries,
      visaAssistanceStatus: visaAssistanceRequested ? (visaAssistanceStatus || 'pending') : 'not-needed',
      visaAssistanceNotes,
      travelInsuranceRequested: travelInsuranceRequested || false,
      travelInsuranceFee: travelInsuranceRequested ? (travelInsuranceFee ?? 3000) : 0,
      insurancePaxDetails: insurancePaxDetails || [],
      visaReadinessScore,
      visaReadinessStatus,
      visaReadinessSnapshot
    });

    console.log('✅ Booking created successfully:', bookingId);

    // Auto-create a visa application record if visa assistance was requested
    if (visaAssistanceRequested) {
      try {
        const year = new Date().getFullYear();
        const randomSuffix = Math.random().toString(36).slice(2, 8).toUpperCase();
        const applicationId = `VA-${year}-${randomSuffix}`;
        await VisaApplication.create({
          applicationId,
          applicationDate: new Date().toISOString().split('T')[0],
          status: 'pending',
          source: 'booking',
          completeName: customerName,
          contactNumber: customerPhone,
          emailAddress: customerEmail,
          destinationCountries: visaDestinationCountries || '',
          tourTitle: tourSlug,
          bookingId,
          notes: visaAssistanceNotes || '',
        });
        console.log('✅ Visa application record created for booking:', bookingId);
      } catch (visaErr) {
        console.warn('⚠️ Could not create visa application record (non-critical):', visaErr);
      }
    }

    // Send confirmation email to customer and booking department
    try {
      console.log('📧 Sending booking confirmation emails...');
      const emailResult = await sendBookingConfirmationEmail({
        bookingId,
        customerName,
        customerEmail,
        tourTitle: tourSlug, // Using tourSlug as title for now
        tourDate: selectedDate,
        passengers,
        pricePerPerson: perPerson,
        totalAmount,
        downpaymentAmount: paidAmount < totalAmount ? paidAmount : undefined,
        remainingBalance: paidAmount < totalAmount ? totalAmount - paidAmount : undefined,
        isDownpaymentOnly: paidAmount < totalAmount,
        appointmentDate,
        appointmentTime,
        appointmentPurpose,
        customRoutes: customRoutes || [],
        visaAssistanceRequested: visaAssistanceRequested || false,
        visaAssistanceFee: visaAssistanceRequested ? 10000 : undefined,
        visaPaxDetails: visaPaxDetails || [],
        visaDocumentsProvided: visaDocumentsProvided || false,
        visaDestinationCountries,
        visaAssistanceStatus: visaAssistanceRequested ? (visaAssistanceStatus || 'pending') : 'not-needed',
        visaAssistanceNotes,
        travelInsuranceRequested: travelInsuranceRequested || false,
        travelInsuranceFee: travelInsuranceRequested ? (travelInsuranceFee ?? 3000) : undefined,
        travelInsurancePax: insurancePaxDetails || [],
      });

      if (emailResult.success) {
        console.log('✅ Confirmation emails sent to customer and booking department');
      } else {
        console.warn('⚠️ Failed to send confirmation email:', emailResult.error);
      }
    } catch (emailError) {
      // Don't fail the booking if email fails
      console.error('⚠️ Email sending error (non-critical):', emailError);
    }

    res.status(201).json(booking);
  } catch (err) {
    console.error("Error creating booking:", err);
    res.status(500).json({ error: "Failed to create booking" });
  }
});

// GET /api/bookings/recent/notification - get most recent confirmed booking
// NOTE: must be defined BEFORE /:bookingId to avoid 'recent' being matched as a param
router.get("/recent/notification", async (req, res) => {
  try {
    const recentBooking = await Booking.findOne({ status: 'confirmed' })
      .sort({ createdAt: -1 });
    
    if (!recentBooking) {
      return res.json(null);
    }

    const bookingTime = new Date(recentBooking.createdAt);
    const now = new Date();
    const diffMinutes = Math.floor((now.getTime() - bookingTime.getTime()) / (1000 * 60));
    
    let timeAgo = '';
    if (diffMinutes < 1) {
      timeAgo = 'just now';
    } else if (diffMinutes < 60) {
      timeAgo = `${diffMinutes} min ago`;
    } else if (diffMinutes < 1440) {
      const hours = Math.floor(diffMinutes / 60);
      timeAgo = `${hours} hour${hours > 1 ? 's' : ''} ago`;
    } else {
      const days = Math.floor(diffMinutes / 1440);
      timeAgo = `${days} day${days > 1 ? 's' : ''} ago`;
    }

    res.json({
      customerName: recentBooking.customerName,
      tourSlug: recentBooking.tourSlug,
      timeAgo
    });
  } catch (err) {
    console.error("Error fetching recent booking:", err);
    res.status(500).json({ error: "Failed to fetch recent booking" });
  }
});

// GET /api/bookings/:bookingId - get a specific booking by bookingId
router.get("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const booking = await Booking.findOne({ bookingId });
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    res.json(booking);
  } catch (err) {
    console.error("Error fetching booking:", err);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// PATCH /api/bookings/:bookingId/payment - update payment details after successful payment
router.patch("/:bookingId/payment", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { paidAmount, paymentIntentId, status } = req.body;

    const update: Record<string, unknown> = {};
    if (paidAmount !== undefined) update.paidAmount = paidAmount;
    if (paymentIntentId) update.paymentIntentId = paymentIntentId;
    if (status) update.status = status;

    const booking = await Booking.findOneAndUpdate(
      { bookingId },
      { $set: update },
      { new: true }
    );

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    console.log(`💳 Updated payment for booking ${bookingId}:`, update);
    res.json(booking);
  } catch (err) {
    console.error("Error updating payment:", err);
    res.status(500).json({ error: "Failed to update payment" });
  }
});

// PATCH /api/bookings/:bookingId/status - update booking status
router.patch("/:bookingId/status", async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { status } = req.body;
    
    const booking = await Booking.findOneAndUpdate(
      { bookingId },
      { status },
      { new: true }
    );
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    console.log(`📝 Updated booking ${bookingId} status to: ${status}`);
    res.json(booking);
  } catch (err) {
    console.error("Error updating booking status:", err);
    res.status(500).json({ error: "Failed to update booking status" });
  }
});

// DELETE /api/bookings/:bookingId - delete a booking
router.delete("/:bookingId", async (req, res) => {
  try {
    const { bookingId } = req.params;
    
    const booking = await Booking.findOneAndDelete({ bookingId });
    
    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    console.log(`🗑️ Deleted booking: ${bookingId}`);
    res.json({ message: "Booking deleted successfully", deletedBooking: booking });
  } catch (err) {
    console.error("Error deleting booking:", err);
    res.status(500).json({ error: "Failed to delete booking" });
  }
});



export default router;
