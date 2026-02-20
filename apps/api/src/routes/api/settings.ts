import express from 'express';
import { Settings } from '../../models/Settings';

const router = express.Router();

// GET /api/settings/addons - Public endpoint for booking page to fetch current add-on pricing
router.get('/addons', async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'global' });
    // Effective prices: when discount is disabled, fee === originalFee (no strikethrough shown)
    const visa = {
      fee: settings?.visaAssistanceFee ?? 10000,
      originalFee: settings?.visaDiscountEnabled
        ? (settings?.visaAssistanceOriginalFee ?? 20000)
        : (settings?.visaAssistanceFee ?? 10000),
      discountEnabled: settings?.visaDiscountEnabled ?? true,
    };
    const insurance = {
      fee: settings?.insuranceFee ?? 3000,
      originalFee: settings?.insuranceDiscountEnabled
        ? (settings?.insuranceOriginalFee ?? 6000)
        : (settings?.insuranceFee ?? 3000),
      discountEnabled: settings?.insuranceDiscountEnabled ?? true,
    };
    const passport = {
      fee: settings?.passportAssistanceFee ?? 5000,
      originalFee: settings?.passportDiscountEnabled
        ? (settings?.passportAssistanceOriginalFee ?? 10000)
        : (settings?.passportAssistanceFee ?? 5000),
      discountEnabled: settings?.passportDiscountEnabled ?? true,
    };
    res.json({ success: true, visa, insurance, passport });
  } catch (error) {
    console.error('Error fetching public addon settings:', error);
    // Return safe defaults so the booking page always works
    res.json({
      success: true,
      visa: { fee: 10000, originalFee: 20000, discountEnabled: true },
      insurance: { fee: 3000, originalFee: 6000, discountEnabled: true },
      passport: { fee: 5000, originalFee: 10000, discountEnabled: true },
    });
  }
});

export default router;
