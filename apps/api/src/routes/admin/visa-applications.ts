import express from 'express';
import VisaApplication from '../../models/VisaApplication';
import { requireAuth, requireAdmin } from '../../middleware/auth';

const router = express.Router();

// GET /admin/visa-applications — list all visa applications
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const applications = await VisaApplication.find().sort({ createdAt: -1 });
    res.json({ success: true, applications });
  } catch (error) {
    console.error('Error fetching visa applications:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch visa applications' });
  }
});

// GET /admin/visa-applications/:id — single application
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const application = await VisaApplication.findById(req.params.id);
    if (!application) {
      return res.status(404).json({ success: false, error: 'Visa application not found' });
    }
    res.json({ success: true, application });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to fetch visa application' });
  }
});

// PATCH /admin/visa-applications/:id — update status or notes
router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, notes, assignedTo } = req.body;
    const update: Record<string, unknown> = {};
    if (status) update.status = status;
    if (notes !== undefined) update.notes = notes;
    if (assignedTo !== undefined) update.assignedTo = assignedTo;

    const application = await VisaApplication.findByIdAndUpdate(
      req.params.id,
      { $set: update },
      { new: true }
    );
    if (!application) {
      return res.status(404).json({ success: false, error: 'Visa application not found' });
    }
    res.json({ success: true, application });
  } catch {
    res.status(500).json({ success: false, error: 'Failed to update visa application' });
  }
});

// POST /admin/visa-applications — manually create (admin-entered)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      completeName, passportNumber, civilStatus, contactNumber, emailAddress,
      presentAddress, travelHistory, companyName, jobTitle, companyLocation,
      dateHiredOrStarted, destinationCountries, notes, tourTitle, bookingId
    } = req.body;

    if (!completeName) {
      return res.status(400).json({ success: false, error: 'completeName is required' });
    }

    const count = await VisaApplication.countDocuments();
    const applicationId = `VA-${new Date().getFullYear()}-${String(count + 1).padStart(3, '0')}`;

    const application = await VisaApplication.create({
      applicationId,
      applicationDate: new Date().toISOString().split('T')[0],
      status: 'pending',
      source: 'direct',
      completeName, passportNumber, civilStatus, contactNumber, emailAddress,
      presentAddress, travelHistory, companyName, jobTitle, companyLocation,
      dateHiredOrStarted, destinationCountries, notes, tourTitle, bookingId,
    });

    res.status(201).json({ success: true, application });
  } catch (error) {
    console.error('Error creating visa application:', error);
    res.status(500).json({ success: false, error: 'Failed to create visa application' });
  }
});

export default router;
