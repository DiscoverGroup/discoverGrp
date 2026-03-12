import express from 'express';
import { requireAuth, requireAdmin } from '../../middleware/auth';
import { Settings } from '../../models/Settings';

const router = express.Router();

// In-memory storage for settings (you can replace this with MongoDB if needed)
const adminSettings = {
  bookingDepartmentEmail: process.env.BOOKING_DEPT_EMAIL || 'booking@discovergrp.com',
  salesDepartmentEmail: process.env.SALES_DEPT_EMAIL || 'sales@discovergrp.com',
  emailFromAddress: process.env.FROM_EMAIL || 'traveldesk@discovergrp.com',
  emailFromName: process.env.FROM_NAME || 'Discover Group Travel Desk',
  // Meta / Facebook integration
  metaPageId: process.env.META_PAGE_ID || '',
  metaPageAccessToken: process.env.META_PAGE_ACCESS_TOKEN || '',
  metaNotificationPsid: process.env.META_NOTIFICATION_PSID || '',
};

// GET /admin/settings - Get all settings
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json({
      success: true,
      settings: adminSettings
    });
  } catch (error) {
    console.error('Error fetching settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch settings'
    });
  }
});

// PUT /admin/settings - Update settings
router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { bookingDepartmentEmail, salesDepartmentEmail, emailFromAddress, emailFromName,
            metaPageId, metaPageAccessToken, metaNotificationPsid } = req.body;

    // Update settings
    if (bookingDepartmentEmail) {
      adminSettings.bookingDepartmentEmail = bookingDepartmentEmail as string;
    }
    if (salesDepartmentEmail) {
      adminSettings.salesDepartmentEmail = salesDepartmentEmail as string;
    }
    if (emailFromAddress) {
      adminSettings.emailFromAddress = emailFromAddress as string;
    }
    if (emailFromName) {
      adminSettings.emailFromName = emailFromName as string;
    }
    if (typeof metaPageId === 'string') {
      adminSettings.metaPageId = metaPageId;
    }
    if (typeof metaPageAccessToken === 'string') {
      adminSettings.metaPageAccessToken = metaPageAccessToken;
    }
    if (typeof metaNotificationPsid === 'string') {
      adminSettings.metaNotificationPsid = metaNotificationPsid;
    }

    console.log('✅ Admin settings updated:', adminSettings);

    res.json({
      success: true,
      settings: adminSettings,
      message: 'Settings updated successfully'
    });
  } catch (error) {
    console.error('Error updating settings:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update settings'
    });
  }
});

// GET /admin/settings/addons - Get add-on pricing & discount toggles
router.get('/addons', requireAuth, requireAdmin, async (req, res) => {
  try {
    const settings = await Settings.findOne({ key: 'global' });
    const defaults = {
      visaAssistanceFee: 10000,
      visaAssistanceOriginalFee: 20000,
      visaDiscountEnabled: true,
      insuranceFee: 3000,
      insuranceOriginalFee: 6000,
      insuranceDiscountEnabled: true,
      passportAssistanceFee: 5000,
      passportAssistanceOriginalFee: 10000,
      passportDiscountEnabled: true,
    };
    res.json({ success: true, settings: settings ?? defaults });
  } catch (error) {
    console.error('Error fetching addon settings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch addon settings' });
  }
});

// PUT /admin/settings/addons - Update add-on pricing & discount toggles
router.put('/addons', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      visaAssistanceFee,
      visaAssistanceOriginalFee,
      visaDiscountEnabled,
      insuranceFee,
      insuranceOriginalFee,
      insuranceDiscountEnabled,
      passportAssistanceFee,
      passportAssistanceOriginalFee,
      passportDiscountEnabled,
    } = req.body as {
      visaAssistanceFee?: number;
      visaAssistanceOriginalFee?: number;
      visaDiscountEnabled?: boolean;
      insuranceFee?: number;
      insuranceOriginalFee?: number;
      insuranceDiscountEnabled?: boolean;
      passportAssistanceFee?: number;
      passportAssistanceOriginalFee?: number;
      passportDiscountEnabled?: boolean;
    };

    const update: Partial<{
      visaAssistanceFee: number;
      visaAssistanceOriginalFee: number;
      visaDiscountEnabled: boolean;
      insuranceFee: number;
      insuranceOriginalFee: number;
      insuranceDiscountEnabled: boolean;
      passportAssistanceFee: number;
      passportAssistanceOriginalFee: number;
      passportDiscountEnabled: boolean;
    }> = {};

    if (typeof visaAssistanceFee === 'number') update.visaAssistanceFee = visaAssistanceFee;
    if (typeof visaAssistanceOriginalFee === 'number') update.visaAssistanceOriginalFee = visaAssistanceOriginalFee;
    if (typeof visaDiscountEnabled === 'boolean') update.visaDiscountEnabled = visaDiscountEnabled;
    if (typeof insuranceFee === 'number') update.insuranceFee = insuranceFee;
    if (typeof insuranceOriginalFee === 'number') update.insuranceOriginalFee = insuranceOriginalFee;
    if (typeof insuranceDiscountEnabled === 'boolean') update.insuranceDiscountEnabled = insuranceDiscountEnabled;
    if (typeof passportAssistanceFee === 'number') update.passportAssistanceFee = passportAssistanceFee;
    if (typeof passportAssistanceOriginalFee === 'number') update.passportAssistanceOriginalFee = passportAssistanceOriginalFee;
    if (typeof passportDiscountEnabled === 'boolean') update.passportDiscountEnabled = passportDiscountEnabled;

    const settings = await Settings.findOneAndUpdate(
      { key: 'global' },
      { $set: update },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log('✅ Addon settings updated:', settings);
    res.json({ success: true, settings });
  } catch (error) {
    console.error('Error updating addon settings:', error);
    res.status(500).json({ success: false, error: 'Failed to update addon settings' });
  }
});

// Export the settings so other modules can use them
export function getBookingDepartmentEmail(): string {
  return adminSettings.bookingDepartmentEmail;
}

export function getSalesDepartmentEmail(): string {
  return adminSettings.salesDepartmentEmail;
}

export function getEmailFromAddress(): string {
  return adminSettings.emailFromAddress;
}

export function getEmailFromName(): string {
  return adminSettings.emailFromName;
}

export function getMetaPageId(): string {
  return adminSettings.metaPageId;
}

export function getMetaPageAccessToken(): string {
  return adminSettings.metaPageAccessToken;
}

export function getMetaNotificationPsid(): string {
  return adminSettings.metaNotificationPsid;
}

export default router;
