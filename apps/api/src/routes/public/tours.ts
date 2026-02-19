import express, { Request, Response } from "express";
import Tour from "../../models/Tour";
const router = express.Router();

interface LeanTour {
  _id?: unknown;
  id?: unknown;
  [key: string]: unknown;
}

function normalizeTourForClient(tour: LeanTour): LeanTour {
  const normalizedId = typeof tour.id === 'string'
    ? tour.id
    : tour._id !== undefined && tour._id !== null
    ? String(tour._id)
    : undefined;

  return {
    ...tour,
    ...(normalizedId ? { id: normalizedId } : {}),
  };
}

// GET /public/tours - return tours from MongoDB only
router.get("/", async (req: Request, res: Response) => {
  try {
    const limitParam = typeof req.query.limit === 'string' ? Number(req.query.limit) : undefined;
    const safeLimit = Number.isFinite(limitParam) && (limitParam as number) > 0
      ? Math.min(Math.floor(limitParam as number), 50)
      : undefined;

    const query = Tour.find().sort({ createdAt: -1 });

    if (safeLimit) {
      query.limit(safeLimit);
    }

    const tours = await query.lean().exec();
    const normalizedTours = Array.isArray(tours)
      ? tours.map((tour) => normalizeTourForClient(tour as LeanTour))
      : [];

    return res.json(normalizedTours);
  } catch (err) {
    console.error("Error fetching tours from DB:", err);
    return res.status(500).json({ error: "Failed to fetch tours" });
  }
});

// GET /public/tours/:slug - return tour by slug from MongoDB only
router.get("/:slug", async (req: Request, res: Response) => {
  const { slug } = req.params;
  try {
    const tour = await Tour.findOne({ slug }).lean().exec();
    if (tour) return res.json(tour);
    return res.status(404).json({ error: "Tour not found" });
  } catch (err) {
    console.error("Error fetching tour by slug from DB:", err);
    return res.status(500).json({ error: "Failed to fetch tour" });
  }
});

export default router;