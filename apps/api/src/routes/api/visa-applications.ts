import express from 'express';
import VisaApplication from '../../models/VisaApplication';

const router = express.Router();

// POST /api/visa-applications — submit from public visa assistance form
router.post('/', async (req, res) => {
  try {
    const {
      completeName, passportNumber, civilStatus, contactNumber, emailAddress,
      presentAddress, travelHistory, companyName, jobTitle, companyLocation,
      dateHiredOrStarted, destinationCountries, bookingId, tourTitle,
    } = req.body;

    if (!completeName) {
      return res.status(400).json({ success: false, error: 'Complete name is required' });
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
      dateHiredOrStarted, destinationCountries, bookingId, tourTitle,
    });

    res.status(201).json({ success: true, application });
  } catch (error) {
    console.error('Error creating visa application:', error);
    res.status(500).json({ success: false, error: 'Failed to submit visa application' });
  }
});

export default router;
