/**
 * Meta Messenger Notification Service
 *
 * Sends an internal booking alert to a designated sales team member
 * via the Facebook Graph API Send API.
 *
 * Prerequisites:
 *   1. Your Facebook Page must have a Page Access Token (long-lived).
 *   2. The sales team member must have first sent a message to your Page
 *      so their Page-Scoped User ID (PSID) is known.
 *   3. Set the env vars below (or configure via admin Settings):
 *        META_PAGE_ACCESS_TOKEN  – Page Access Token
 *        META_NOTIFICATION_PSID  – Recipient's PSID (Messenger user ID)
 *        META_PAGE_ID            – Your Facebook Page ID (used by chat widget)
 */

import { getMetaPageAccessToken, getMetaNotificationPsid } from '../routes/admin/settings';

const GRAPH_API_VERSION = 'v19.0';
const GRAPH_API_BASE = `https://graph.facebook.com/${GRAPH_API_VERSION}`;

interface MetaBookingPayload {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  tourTitle: string;
  tourDate: string;
  passengers: number;
  totalAmount: number;
  isDownpaymentOnly?: boolean;
  downpaymentAmount?: number;
  remainingBalance?: number;
  visaAssistanceRequested?: boolean;
  travelInsuranceRequested?: boolean;
  passportAssistanceRequested?: boolean;
  appointmentDate?: string;
  appointmentTime?: string;
}

const fmt = (n: number) =>
  `₱${n.toLocaleString('en-PH', { minimumFractionDigits: 2 })}`;

const buildNotificationText = (b: MetaBookingPayload): string => {
  const paymentLine = b.isDownpaymentOnly
    ? `Paid: ${fmt(b.downpaymentAmount ?? 0)}  |  Balance: ${fmt(b.remainingBalance ?? (b.totalAmount - (b.downpaymentAmount ?? 0)))}`
    : `Full Payment: ${fmt(b.totalAmount)}`;

  const addOns: string[] = [];
  if (b.visaAssistanceRequested)    addOns.push('Visa');
  if (b.travelInsuranceRequested)   addOns.push('Insurance');
  if (b.passportAssistanceRequested) addOns.push('Passport');

  const apptLine = b.appointmentDate
    ? `\n📅 Appointment: ${b.appointmentDate}${b.appointmentTime ? ' @ ' + b.appointmentTime : ''}`
    : '';

  return [
    `🔔 NEW BOOKING — ${b.bookingId}`,
    ``,
    `👤 ${b.customerName}`,
    b.customerPhone ? `📞 ${b.customerPhone}` : null,
    `✉️  ${b.customerEmail}`,
    ``,
    `🗺️  Tour: ${b.tourTitle}`,
    `📆 Date: ${b.tourDate}`,
    `👥 Pax: ${b.passengers}`,
    ``,
    `💰 ${b.isDownpaymentOnly ? '⚠️ DOWNPAYMENT ONLY' : '✅ FULL PAYMENT'}`,
    paymentLine,
    addOns.length ? `🧳 Add-ons: ${addOns.join(', ')}` : null,
    apptLine || null,
  ]
    .filter((l): l is string => l !== null)
    .join('\n');
};

export const sendMetaBookingNotification = async (
  booking: MetaBookingPayload
): Promise<{ success: boolean; error?: string }> => {
  try {
    const pageAccessToken = getMetaPageAccessToken();
    const recipientPsid  = getMetaNotificationPsid();

    if (!pageAccessToken || !recipientPsid) {
      console.warn(
        '⚠️ Meta notification skipped — META_PAGE_ACCESS_TOKEN or META_NOTIFICATION_PSID not configured'
      );
      return { success: false, error: 'Meta credentials not configured' };
    }

    const body = {
      recipient: { id: recipientPsid },
      message:   { text: buildNotificationText(booking) },
      messaging_type: 'MESSAGE_TAG',
      tag: 'CONFIRMED_EVENT_UPDATE',
    };

    const res = await fetch(
      `${GRAPH_API_BASE}/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );

    if (!res.ok) {
      const errData = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
      const msg = errData?.error?.message || res.statusText;
      console.error('\u274c Meta Send API error:', msg);
      return { success: false, error: msg };
    }

    const data = (await res.json()) as { message_id?: string };
    console.log('\u2705 Meta booking notification sent \u2014 message_id:', data.message_id);
    return { success: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('❌ Meta notification failed (non-critical):', msg);
    return { success: false, error: msg };
  }
};
