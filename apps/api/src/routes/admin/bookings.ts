import express from "express";
import Booking from "../../models/Booking";
import { requireAuth, requireAdmin } from "../../middleware/auth";

// Type definitions for tours
interface BaseTour {
  id: string;
  slug: string;
  title: string;
  durationDays: number;
}

interface FullTour extends BaseTour {
  summary: string;
  line: string;
  highlights: string[];
  images: string[];
  guaranteedDeparture: boolean;
  regularPricePerPerson: number;
  promoPricePerPerson: number;
  allowsDownpayment: boolean;
  additionalInfo: {
    countriesVisited: string[];
    startingPoint: string;
    endingPoint: string;
  };
}

const router = express.Router();

// Interface for booking response with populated tour data (removed — not used)

// ── Tour lookup helpers ───────────────────────────────────────────────────────
// Import tour data from both systems
const mockTours: FullTour[] = [
  {
    id: "route-a-preferred",
    slug: "route-a-preferred",
    title: "Route A Preferred - European Adventure",
    summary: "14-day journey through France, Switzerland, Italy, and Vatican City.",
    line: "ROUTE_A",
    durationDays: 14,
    highlights: ["Paris", "Zurich", "Milan", "Florence", "Rome"],
    images: ["/image.png"],
    guaranteedDeparture: true,
    regularPricePerPerson: 250000,
    promoPricePerPerson: 160000,
    allowsDownpayment: true,
    additionalInfo: {
      countriesVisited: ["France", "Switzerland", "Italy", "Vatican City"],
      startingPoint: "Manila, Philippines",
      endingPoint: "Manila, Philippines"
    }
  }
];

// Admin tours (in-memory)
const ADMIN_TOURS: BaseTour[] = [
  { id: "1", slug: "route-a-preferred", title: "Route A Preferred - European Adventure", durationDays: 14 }
];

// Helper: attach tour data to a booking plain object
function attachTour(booking: ReturnType<(typeof Booking.prototype)['toObject']>): Record<string, unknown> {
  const bookingObj = booking as unknown as Record<string, unknown>;
  const slug = bookingObj['tourSlug'] as string | undefined;
  const tour: BaseTour | FullTour | undefined =
    mockTours.find(t => t.slug === slug) ?? ADMIN_TOURS.find(t => t.slug === slug);
  if (tour) {
    const tourData: Record<string, unknown> = {
      id: String(tour.id ?? tour.slug),
      slug: tour.slug,
      title: tour.title,
      durationDays: tour.durationDays,
      ...(('summary' in tour) && { summary: tour.summary }),
      ...(('highlights' in tour) && { highlights: tour.highlights }),
      ...(('images' in tour) && { images: tour.images }),
      ...(('guaranteedDeparture' in tour) && { guaranteedDeparture: tour.guaranteedDeparture }),
      ...(('allowsDownpayment' in tour) && { allowsDownpayment: tour.allowsDownpayment }),
      ...(('additionalInfo' in tour) && { additionalInfo: tour.additionalInfo }),
    };
    bookingObj['tour'] = tourData;
  }
  return bookingObj;
}

// ── GET /admin/bookings - list active (non-archived) bookings ─────────────────
router.get("/", requireAuth, requireAdmin, async (req, res) => {
  try {
    const query: Record<string, unknown> = { archived: { $ne: true } };
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    if (req.query.startDate) query.bookingDate = { $gte: req.query.startDate };
    if (req.query.endDate) {
      query.bookingDate = { ...(query.bookingDate as Record<string, unknown> ?? {}), $lte: req.query.endDate };
    }
    if (req.query.customerId) {
      const search = req.query.customerId as string;
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ];
    }
    const bookings = await Booking.find(query).sort({ createdAt: -1 });
    res.json(bookings.map(b => attachTour(b.toObject())));
  } catch (error) {
    console.error('Error fetching admin bookings:', error);
    res.status(500).json({ error: "Failed to fetch bookings" });
  }
});

// ── GET /admin/bookings/archived - list archived bookings ─────────────────────
router.get("/archived", requireAuth, requireAdmin, async (req, res) => {
  try {
    const query: Record<string, unknown> = { archived: true };
    if (req.query.status && req.query.status !== 'all') query.status = req.query.status;
    if (req.query.customerId) {
      const search = req.query.customerId as string;
      query.$or = [
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } },
      ];
    }
    const bookings = await Booking.find(query).sort({ archivedAt: -1 });
    res.json(bookings.map(b => attachTour(b.toObject())));
  } catch (error) {
    console.error('Error fetching archived bookings:', error);
    res.status(500).json({ error: "Failed to fetch archived bookings" });
  }
});

// ── GET /admin/bookings/dashboard-stats ───────────────────────────────────────
router.get("/dashboard-stats", requireAuth, requireAdmin, async (req, res) => {
  try {
    const activeFilter = { archived: { $ne: true } };
    const totalBookings = await Booking.countDocuments(activeFilter);
    const totalRevenue = await Booking.aggregate([
      { $match: activeFilter },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    const today = new Date();
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const todayBookings = await Booking.countDocuments({
      ...activeFilter,
      bookingDate: { $gte: todayStart.toISOString() }
    });
    const todayRevenue = await Booking.aggregate([
      { $match: { ...activeFilter, bookingDate: { $gte: todayStart.toISOString() } } },
      { $group: { _id: null, total: { $sum: "$totalAmount" } } }
    ]);

    const lastWeek = new Date();
    lastWeek.setDate(lastWeek.getDate() - 7);
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);

    const lastWeekBookings = await Booking.countDocuments({ ...activeFilter, bookingDate: { $gte: lastWeek.toISOString() } });
    const lastMonthBookings = await Booking.countDocuments({ ...activeFilter, bookingDate: { $gte: lastMonth.toISOString() } });

    const calculateGrowth = (current: number, previous: number): number => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    res.json({
      totalBookings,
      totalRevenue: totalRevenue[0]?.total || 0,
      todayBookings,
      todayRevenue: todayRevenue[0]?.total || 0,
      weeklyGrowth: calculateGrowth(lastWeekBookings, totalBookings - lastWeekBookings),
      monthlyGrowth: calculateGrowth(lastMonthBookings, totalBookings - lastMonthBookings),
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: "Failed to fetch stats" });
  }
});

// ── GET /admin/bookings/:bookingId ────────────────────────────────────────────
router.get("/:bookingId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findOne({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(attachTour(booking.toObject()));
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: "Failed to fetch booking" });
  }
});

// ── PUT /admin/bookings/:bookingId/status ─────────────────────────────────────
router.put("/:bookingId/status", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, notes } = req.body as { status?: string; notes?: string };
    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { $set: update },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(attachTour(booking.toObject()));
  } catch (error) {
    console.error('Error updating booking status:', error);
    res.status(500).json({ error: "Failed to update status" });
  }
});

// ── PATCH /admin/bookings/:bookingId/archive ──────────────────────────────────
router.patch("/:bookingId/archive", requireAuth, requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { $set: { archived: true, archivedAt: new Date() } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    console.log(`📦 Archived booking: ${req.params.bookingId}`);
    res.json({ message: "Booking archived", booking: attachTour(booking.toObject()) });
  } catch (error) {
    console.error('Error archiving booking:', error);
    res.status(500).json({ error: "Failed to archive booking" });
  }
});

// ── PATCH /admin/bookings/:bookingId/restore ──────────────────────────────────
router.patch("/:bookingId/restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findOneAndUpdate(
      { bookingId: req.params.bookingId },
      { $set: { archived: false }, $unset: { archivedAt: '' } },
      { new: true }
    );
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    console.log(`♻️ Restored booking: ${req.params.bookingId}`);
    res.json({ message: "Booking restored", booking: attachTour(booking.toObject()) });
  } catch (error) {
    console.error('Error restoring booking:', error);
    res.status(500).json({ error: "Failed to restore booking" });
  }
});

// ── DELETE /admin/bookings/:bookingId ─────────────────────────────────────────
router.delete("/:bookingId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const booking = await Booking.findOneAndDelete({ bookingId: req.params.bookingId });
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    console.log(`🗑️ Deleted booking: ${req.params.bookingId}`);
    res.json({ message: "Booking deleted" });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ error: "Failed to delete booking" });
  }
});

// ── POST /admin/bookings/batch-archive ────────────────────────────────────────
router.post("/batch-archive", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { bookingIds } = req.body as { bookingIds: string[] };
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: "bookingIds array required" });
    }
    const result = await Booking.updateMany(
      { bookingId: { $in: bookingIds } },
      { $set: { archived: true, archivedAt: new Date() } }
    );
    console.log(`📦 Batch archived ${result.modifiedCount} bookings`);
    res.json({ message: `${result.modifiedCount} booking(s) archived`, count: result.modifiedCount });
  } catch (error) {
    console.error('Error batch archiving:', error);
    res.status(500).json({ error: "Failed to archive bookings" });
  }
});

// ── POST /admin/bookings/batch-restore ────────────────────────────────────────
router.post("/batch-restore", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { bookingIds } = req.body as { bookingIds: string[] };
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: "bookingIds array required" });
    }
    const result = await Booking.updateMany(
      { bookingId: { $in: bookingIds } },
      { $set: { archived: false }, $unset: { archivedAt: '' } }
    );
    console.log(`♻️ Batch restored ${result.modifiedCount} bookings`);
    res.json({ message: `${result.modifiedCount} booking(s) restored`, count: result.modifiedCount });
  } catch (error) {
    console.error('Error batch restoring:', error);
    res.status(500).json({ error: "Failed to restore bookings" });
  }
});

// ── POST /admin/bookings/batch-delete ────────────────────────────────────────
router.post("/batch-delete", requireAuth, requireAdmin, async (req, res) => {
  try {
    const { bookingIds } = req.body as { bookingIds: string[] };
    if (!Array.isArray(bookingIds) || bookingIds.length === 0) {
      return res.status(400).json({ error: "bookingIds array required" });
    }
    const result = await Booking.deleteMany({ bookingId: { $in: bookingIds } });
    console.log(`🗑️ Batch deleted ${result.deletedCount} bookings`);
    res.json({ message: `${result.deletedCount} booking(s) deleted`, count: result.deletedCount });
  } catch (error) {
    console.error('Error batch deleting:', error);
    res.status(500).json({ error: "Failed to delete bookings" });
  }
});

// ── POST /admin/bookings/sync-tours ──────────────────────────────────────────
router.post("/sync-tours", requireAuth, requireAdmin, async (req, res) => {
  try {    res.json({ message: "Tour sync completed", tours: ADMIN_TOURS });
  } catch {
    res.status(500).json({ error: "Failed to sync tours" });
  }
});

export default router;