import nodemailer from 'nodemailer';

import { getBookingDepartmentEmail, getEmailFromAddress, getEmailFromName } from '../routes/admin/settings';

interface CustomRoute {
  tourSlug: string;
  tourTitle: string;
  tourLine?: string;
  durationDays: number;
  pricePerPerson: number;
  insertAfterDay: number;
}

interface BookingDetails {
  bookingId: string;
  customerName: string;
  customerEmail: string;
  tourTitle: string;
  tourDate: string;
  passengers: number;
  pricePerPerson: number;
  totalAmount: number;
  country?: string;
  downpaymentAmount?: number;
  remainingBalance?: number;
  isDownpaymentOnly?: boolean;
  appointmentDate?: string;
  appointmentTime?: string;
  appointmentPurpose?: string;
  paymentMethod?: string;
  paymentMethodDescription?: string;
  paymentMethodIcon?: string;
  paymentGateway?: string;
  customRoutes?: CustomRoute[];
  // Visa assistance fields
  visaAssistanceRequested?: boolean;
  visaAssistanceFee?: number;
  visaPaxDetails?: Array<{name: string; birthday: string}>;
  visaDocumentsProvided?: boolean;
  // Travel insurance fields
  travelInsuranceRequested?: boolean;
  travelInsuranceFee?: number;
  travelInsurancePax?: Array<{name: string; birthday: string}>;
  visaDestinationCountries?: string;
  visaAssistanceStatus?: string;
  visaAssistanceNotes?: string;
}

// Create transporter - using Gmail for real email sending
const createTransporter = async () => {
  // Use Gmail SMTP for sending real emails
  if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
    console.log('📧 Using Gmail SMTP for real email delivery to:', process.env.GMAIL_USER);
    return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.GMAIL_USER,
        pass: process.env.GMAIL_APP_PASSWORD,
      },
    });
  }

  // Fallback to Ethereal Email for development testing
  console.warn('⚠️ GMAIL_USER/GMAIL_APP_PASSWORD not set — falling back to Ethereal (fake SMTP). Emails will NOT be delivered to real inboxes!');
  const testAccount = await nodemailer.createTestAccount();
  console.log('📧 Ethereal test credentials:', testAccount.user);
  
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    secure: false,
    auth: {
      user: testAccount.user,
      pass: testAccount.pass,
    },
  });
};

// Format a tour date (handles single dates and "YYYY-MM-DD - YYYY-MM-DD" ranges)
const formatTourDate = (tourDate: string): string => {
  if (!tourDate || tourDate === '') return 'Date to be confirmed';
  if (tourDate.includes(' - ')) {
    const [s, e] = tourDate.split(' - ').map(d => d.trim());
    const start = new Date(s);
    const end = new Date(e);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) return tourDate;
    const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    return `${fmt(start)} – ${fmt(end)}`;
  }
  const d = new Date(tourDate);
  if (isNaN(d.getTime())) return tourDate;
  return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const fmtPHP = (amount: number) =>
  `PHP ${amount.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const fmtPurpose = (purpose?: string): string => {
  if (!purpose) return 'Consultation';
  return purpose.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
};

// Generate booking confirmation email HTML
const generateBookingConfirmationEmail = (booking: BookingDetails): string => {
  const bookingDetailsUrl = `${process.env.CLIENT_URL || 'https://discover-grp.netlify.app'}/booking-confirmation/${booking.bookingId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Booking Confirmation - Discover Group</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6; color: #333; background-color: #f5f5f5; padding: 20px;
        }
        .email-container {
            max-width: 650px; margin: 0 auto; background: #ffffff;
            border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%);
            color: white; padding: 40px 30px; text-align: center;
        }
        .header h1 { font-size: 32px; margin-bottom: 10px; font-weight: 700; }
        .header p { font-size: 16px; opacity: 0.95; }
        .content { padding: 40px 30px; }
        .greeting { font-size: 20px; font-weight: 600; color: #1a202c; margin-bottom: 20px; }
        .intro-text { color: #4a5568; margin-bottom: 30px; font-size: 15px; line-height: 1.7; }
        .booking-card {
            background: linear-gradient(135deg, #f7fafc 0%, #edf2f7 100%);
            padding: 25px; border-radius: 12px; border-left: 5px solid #667eea; margin: 25px 0;
        }
        .booking-card h3 { color: #2d3748; font-size: 18px; margin-bottom: 20px; }
        .detail-row {
            display: flex; justify-content: space-between;
            padding: 12px 0; border-bottom: 1px solid #e2e8f0;
        }
        .detail-row:last-child { border-bottom: none; }
        .detail-label { font-weight: 600; color: #4a5568; font-size: 14px; }
        .detail-value { color: #1a202c; font-size: 14px; text-align: right; max-width: 60%; }
        .payment-method-card {
            background: linear-gradient(135deg, #667eea15 0%, #764ba215 100%);
            border: 2px solid #667eea40; padding: 20px; border-radius: 10px; margin: 20px 0;
        }
        .payment-method-card h4 { color: #667eea; font-size: 16px; margin-bottom: 15px; }
        .payment-terms {
            background: #fff7ed; border: 2px solid #fed7aa; border-radius: 10px;
            padding: 20px; margin: 20px 0;
        }
        .payment-terms h4 { color: #ea580c; font-size: 16px; margin-bottom: 12px; }
        .payment-terms ul { margin-left: 20px; color: #7c2d12; }
        .payment-terms li { margin: 8px 0; font-size: 14px; }
        .appointment-card {
            background: #fffbeb; border: 2px solid #fcd34d; border-radius: 10px;
            padding: 20px; margin: 20px 0;
        }
        .appointment-card h4 { color: #d97706; font-size: 16px; margin-bottom: 15px; }
        .total-section {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 20px; border-radius: 10px; margin: 25px 0;
        }
        .total-section .total-row { display: flex; justify-content: space-between; align-items: center; }
        .total-section .total-label { font-size: 16px; font-weight: 600; }
        .total-section .total-amount { font-size: 32px; font-weight: 700; }
        .info-card {
            background: #f0fdf4; border-left: 4px solid #10b981;
            padding: 20px; border-radius: 8px; margin: 25px 0;
        }
        .info-card h3 { color: #065f46; font-size: 18px; margin-bottom: 15px; }
        .info-card ul { list-style: none; padding: 0; }
        .info-card li {
            padding: 8px 0 8px 25px; position: relative;
            color: #047857; font-size: 14px;
        }
        .info-card li:before { content: "✓"; position: absolute; left: 0; color: #10b981; font-weight: bold; }
        .contact-card {
            background: #eff6ff; border-left: 4px solid #3b82f6;
            padding: 20px; border-radius: 8px; margin: 25px 0;
        }
        .contact-card h3 { color: #1e40af; font-size: 18px; margin-bottom: 15px; }
        .contact-card ul { list-style: none; padding: 0; }
        .contact-card li { padding: 6px 0; color: #1e40af; font-size: 14px; }
        .contact-card a { color: #2563eb; text-decoration: none; }
        .button {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px;
            font-weight: 600; font-size: 15px; text-align: center; margin: 20px 0;
            box-shadow: 0 4px 6px rgba(102,126,234,0.3);
        }
        .closing { margin-top: 30px; color: #4a5568; font-size: 15px; line-height: 1.7; }
        .signature { margin-top: 20px; color: #1a202c; font-weight: 600; }
        .footer {
            background: #f7fafc; text-align: center; padding: 30px;
            border-top: 1px solid #e2e8f0; color: #718096; font-size: 13px;
        }
        .footer p { margin: 8px 0; }
        .footer .social-links { margin: 15px 0; }
        .footer .social-links a { color: #667eea; text-decoration: none; margin: 0 10px; }
        .badge {
            display: inline-block; padding: 4px 12px; border-radius: 12px;
            font-size: 12px; font-weight: 600; margin-left: 8px;
        }
        .badge-success { background: #d1fae5; color: #065f46; }
        .badge-warning { background: #fed7aa; color: #7c2d12; }
        .badge-info { background: #dbeafe; color: #1e40af; }
        @media only screen and (max-width: 600px) {
            .email-container { border-radius: 0; }
            .header { padding: 30px 20px; }
            .header h1 { font-size: 26px; }
            .content { padding: 25px 20px; }
            .detail-row { flex-direction: column; gap: 4px; }
            .detail-value { text-align: left; max-width: 100%; }
            .total-section .total-amount { font-size: 26px; }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <h1>🎉 Booking Confirmed!</h1>
            <p>Thank you for choosing Discover Group for your adventure</p>
        </div>

        <div class="content">
            <div class="greeting">Hi ${booking.customerName},</div>

            <p class="intro-text">
                We're thrilled to confirm your booking! Your adventure awaits, and we can't wait to help you create unforgettable memories. Below are your complete booking details.
            </p>

            <!-- Payment Pending Notice -->
            <div style="background:#fff7ed;border:2px solid #fed7aa;border-radius:10px;padding:20px;margin:20px 0;">
                <h4 style="color:#ea580c;font-size:16px;margin-bottom:10px;">⏳ Payment Pending — We'll Contact You Shortly</h4>
                <p style="color:#78350f;font-size:14px;">Online payment is coming soon! We accept cash, bank transfer, GCash, Maya, and card payments. Our team will contact you within <strong>24–48 hours</strong> to arrange this.</p>
            </div>

            <!-- Booking Details Card -->
            <div class="booking-card">
                <h3>📋 Booking Information</h3>
                <div class="detail-row">
                    <span class="detail-label">Booking ID:</span>
                    <span class="detail-value"><strong>${booking.bookingId}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Tour Package:</span>
                    <span class="detail-value"><strong>${booking.tourTitle}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Travel Date:</span>
                    <span class="detail-value">${formatTourDate(booking.tourDate)}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Number of Passengers:</span>
                    <span class="detail-value">${booking.passengers} ${booking.passengers === 1 ? 'person' : 'people'}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Price per Person:</span>
                    <span class="detail-value">${fmtPHP(booking.pricePerPerson)}</span>
                </div>
                ${booking.visaAssistanceRequested ? `
                <div class="detail-row">
                    <span class="detail-label">Visa Assistance (${booking.passengers} pax):</span>
                    <span class="detail-value">${fmtPHP((booking.visaAssistanceFee ?? 10000) * booking.passengers)}</span>
                </div>` : ''}
                ${booking.travelInsuranceRequested ? `
                <div class="detail-row">
                    <span class="detail-label">Travel Insurance (${booking.passengers} pax):</span>
                    <span class="detail-value">${fmtPHP((booking.travelInsuranceFee ?? 3000) * booking.passengers)}</span>
                </div>` : ''}
            </div>

            ${booking.paymentMethod ? `
            <!-- Payment Method Card -->
            <div class="payment-method-card">
                <h4>${booking.paymentMethodIcon ?? '💳'} Payment Method</h4>
                <div class="detail-row">
                    <span class="detail-label">Selected Method:</span>
                    <span class="detail-value"><strong>${booking.paymentMethod}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Gateway:</span>
                    <span class="detail-value">${booking.paymentGateway ?? ''}</span>
                </div>
                ${booking.paymentMethodDescription ? `
                <div class="detail-row">
                    <span class="detail-label">Details:</span>
                    <span class="detail-value">${booking.paymentMethodDescription}</span>
                </div>` : ''}
            </div>` : ''}

            ${booking.isDownpaymentOnly ? `
            <!-- Downpayment Terms -->
            <div class="payment-terms">
                <h4>💰 Payment Terms — Downpayment Option</h4>
                <div class="detail-row">
                    <span class="detail-label">Downpayment Amount:</span>
                    <span class="detail-value"><strong>${fmtPHP(booking.downpaymentAmount ?? 0)}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Remaining Balance:</span>
                    <span class="detail-value"><strong>${fmtPHP(booking.remainingBalance ?? 0)}</strong></span>
                </div>
                <ul style="margin-top:15px;">
                    <li>The downpayment secures your booking and holds your reservation</li>
                    <li>Remaining balance must be paid <strong>30 days before departure</strong></li>
                    <li>Payment reminders will be sent via email and SMS</li>
                    <li>You can pay the balance online or visit our office</li>
                    <li>Flexible payment options available for the remaining balance</li>
                </ul>
            </div>` : ''}

            ${booking.appointmentDate && booking.appointmentTime ? `
            <!-- Office Appointment -->
            <div class="appointment-card">
                <h4>🏢 Office Appointment Scheduled</h4>
                <div class="detail-row">
                    <span class="detail-label">Date:</span>
                    <span class="detail-value"><strong>${(() => { const d = new Date(booking.appointmentDate!); return isNaN(d.getTime()) ? booking.appointmentDate! : d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }); })()}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Time:</span>
                    <span class="detail-value"><strong>${booking.appointmentTime}</strong></span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Purpose:</span>
                    <span class="detail-value">${fmtPurpose(booking.appointmentPurpose)}</span>
                </div>
                <p style="margin-top:15px;color:#92400e;font-size:14px;">
                    📍 <strong>Office Address:</strong> Quezon Avenue cor. Sct. Reyes St, Diliman, Quezon City, 1103 Metro Manila<br>
                    💰 Please bring <strong>${fmtPHP(booking.totalAmount)}</strong> in cash. Credit/debit cards also accepted at our office.
                </p>
            </div>` : ''}

            <!-- Total Amount Section -->
            <div class="total-section">
                <div class="total-row">
                    <div>
                        <div class="total-label">
                            Total Amount
                            ${booking.isDownpaymentOnly
                              ? '<span class="badge badge-warning">Downpayment</span>'
                              : '<span class="badge badge-success">Full Payment</span>'}
                        </div>
                    </div>
                    <div class="total-amount">${fmtPHP(booking.totalAmount)}</div>
                </div>
            </div>

            ${booking.visaAssistanceRequested ? `
            <!-- Visa Assistance -->
            <div style="background:#eff6ff;border-left:4px solid #3b82f6;padding:20px;border-radius:8px;margin:25px 0;">
                <h3 style="color:#1e40af;font-size:18px;margin-bottom:15px;">🛂 Visa Assistance Included</h3>
                <p style="color:#1e3a8a;font-size:14px;">Your booking includes our <strong>Visa Assistance Service</strong> (${fmtPHP(booking.visaAssistanceFee ?? 10000)}/pax). Our visa team will contact you to guide you through the required documents and application process.</p>
                ${booking.visaPaxDetails && booking.visaPaxDetails.length > 0 ? `
                <ul style="margin-top:10px;padding-left:20px;color:#1e40af;font-size:14px;">
                    ${booking.visaPaxDetails.map((p: {name: string; birthday: string}) => `<li><strong>${p.name}</strong> — DOB: ${p.birthday}</li>`).join('')}
                </ul>` : ''}
                <p style="margin-top:10px;font-size:14px;color:#1e40af;">Questions? Email <a href="mailto:visa@discovergrp.com" style="color:#2563eb;">visa@discovergrp.com</a></p>
            </div>` : ''}

            ${booking.travelInsuranceRequested ? `
            <!-- Travel Insurance -->
            <div style="background:#f0fdf4;border-left:4px solid #10b981;padding:20px;border-radius:8px;margin:25px 0;">
                <h3 style="color:#065f46;font-size:18px;margin-bottom:15px;">🛡️ Travel Insurance Included</h3>
                <p style="color:#047857;font-size:14px;">Your booking includes <strong>Travel Insurance</strong> (${fmtPHP(booking.travelInsuranceFee ?? 3000)}/pax). Coverage includes trip cancellation, medical emergencies, lost baggage &amp; delays.</p>
                ${booking.travelInsurancePax && booking.travelInsurancePax.length > 0 ? `
                <ul style="margin-top:10px;padding-left:20px;color:#047857;font-size:14px;">
                    ${booking.travelInsurancePax.map((p: {name: string; birthday: string}) => `<li><strong>${p.name}</strong> — DOB: ${p.birthday}</li>`).join('')}
                </ul>` : ''}
            </div>` : ''}

            <!-- What's Next Section -->
            <div class="info-card">
                <h3>📍 What's Next?</h3>
                <ul>
                    <li><strong>Payment Arrangement:</strong> Our team will contact you within 24–48 hours to process payment</li>
                    <li><strong>Documentation:</strong> Ensure your passport is valid for at least 6 months from travel date</li>
                    <li><strong>Preparation:</strong> We'll send you a detailed itinerary 2 weeks before departure</li>
                    <li><strong>Contact:</strong> Our team will reach out with important travel information</li>
                    ${booking.isDownpaymentOnly ? '<li><strong>Balance Payment:</strong> Reminder will be sent 45 days before departure</li>' : ''}
                    <li><strong>Cancellation:</strong> Free cancellation up to 30 days before departure</li>
                    <li><strong>Travel Insurance:</strong> Included in your package for peace of mind</li>
                </ul>
            </div>

            <!-- View Booking Button -->
            <div style="text-align:center;">
                <a href="${bookingDetailsUrl}" class="button">View Booking Details</a>
            </div>

            <!-- Contact Section -->
            <div class="contact-card">
                <h3>📞 Need Help?</h3>
                <p style="margin-bottom:15px;color:#1e3a8a;">Our customer service team is here to assist you:</p>
                <ul>
                    <li>📧 Email: <a href="mailto:reservations@discovergrp.com">reservations@discovergrp.com</a></li>
                    <li>📱 Phone: <a href="tel:+63285551234">+63 02 8555 1234</a></li>
                    <li>💬 Live Chat: Available on our website</li>
                    <li>🕒 Hours: Monday – Friday, 9:00 AM – 6:00 PM (PHT)</li>
                    <li>📍 Office: Quezon Avenue cor. Sct. Reyes St, Diliman, QC</li>
                </ul>
            </div>

            <p class="closing">
                Thank you for trusting us with your travel dreams. We're committed to making this an incredible experience you'll treasure forever!
            </p>
            <p class="signature">
                Safe travels,<br>
                <strong>The Discover Group Team</strong>
            </p>
        </div>

        <div class="footer">
            <p><strong>Discover Group — European Travel Specialists</strong></p>
            <div class="social-links">
                <a href="https://facebook.com/discovergroup">Facebook</a> |
                <a href="https://instagram.com/discovergroup">Instagram</a> |
                <a href="https://twitter.com/discovergroup">Twitter</a>
            </div>
            <p>© 2026 Discover Group. All rights reserved.</p>
            <p style="margin-top:15px;font-size:12px;">
                This is an automated confirmation email. Please do not reply to this message.<br>
                If you did not make this booking, please contact us immediately.
            </p>
        </div>
    </div>
</body>
</html>`;
};

export const sendBookingConfirmationEmail = async (booking: BookingDetails): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> => {
  try {
    console.log('📧 Attempting to send booking confirmation email to:', booking.customerEmail);
    console.log('📋 Booking details received:', {
      bookingId: booking.bookingId,
      tourDate: booking.tourDate,
      appointmentDate: booking.appointmentDate,
      appointmentTime: booking.appointmentTime,
      appointmentPurpose: booking.appointmentPurpose
    });
    
    console.log('🔧 Environment check:');
    console.log('- GMAIL_USER:', process.env.GMAIL_USER ? `✅ Set (${process.env.GMAIL_USER})` : '❌ Not set (emails will go to Ethereal fake SMTP!)');
    console.log('- GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Not set');

    try {
      const transporter = await createTransporter();
      
      // Get current settings
      const bookingDeptEmail = getBookingDepartmentEmail();
      const fromEmail = getEmailFromAddress();
      const fromName = getEmailFromName();
    
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: [booking.customerEmail, bookingDeptEmail], // Send to both customer and booking department
      subject: `Tour Reservation Confirmed - ${booking.tourTitle} (${booking.bookingId})`,
      html: generateBookingConfirmationEmail(booking),
      text: `
Tour Reservation Confirmed - ${booking.tourTitle}

Dear ${booking.customerName},

Your tour reservation is confirmed! Our team will contact you within 24-48 hours to arrange payment.

Booking ID: ${booking.bookingId}
Tour: ${booking.tourTitle}
Date: ${new Date(booking.tourDate).toLocaleDateString()}
Passengers: ${booking.passengers}
Total Amount: PHP ${booking.totalAmount.toLocaleString()}

We'll be in touch shortly with payment details.

Thank you for choosing Discover Group!

The Discover Group Team
Email: reservations@discovergroup.com
Phone: +63 02 8555 1234
      `.trim(),
    };

      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      
      if (previewUrl) {
        console.log('📧 Email Preview URL: %s', previewUrl);
      }

      console.log('✅ Email sent successfully! Message ID:', info.messageId);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (nodemailerError) {
      console.error('❌ Nodemailer also failed:', nodemailerError);
      return {
        success: false,
        error: nodemailerError instanceof Error ? nodemailerError.message : 'Failed to send email via Nodemailer',
      };
    }
  } catch (error) {
    console.error('❌ Email sending failed with critical error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

/**
 * Send email verification email
 */
export const sendVerificationEmail = async (
  email: string,
  fullName: string,
  verificationToken: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> => {
  try {
    console.log('📧 Sending verification email to:', email);
    console.log('- GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set' : '❌ Not set (will use Ethereal fake SMTP)');

    const verificationUrl = `${process.env.CLIENT_URL || 'http://localhost:5173'}/verify-email?token=${verificationToken}`;

    try {
      const transporter = await createTransporter();
    
    const fromEmail = getEmailFromAddress();
    const fromName = getEmailFromName();
    
    const mailOptions = {
      from: `"${fromName}" <${fromEmail}>`,
      to: email,
      subject: 'Verify Your Email - Discover Group',
      html: `
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f8fafc; padding: 30px; }
        .verify-btn { display: inline-block; background: #3b82f6; color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; margin: 20px 0; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>✉️ Verify Your Email</h1>
        </div>
        <div class="content">
            <p>Hello ${fullName},</p>
            <p>Thank you for registering with Discover Group! Please verify your email address:</p>
            <div style="text-align: center;">
                <a href="${verificationUrl}" class="verify-btn">Verify Email Address</a>
            </div>
            <p>This link will expire in 24 hours.</p>
        </div>
    </div>
</body>
</html>
      `,
      text: `
Hello ${fullName},

Please verify your email address by clicking this link:
${verificationUrl}

This link will expire in 24 hours.

Best regards,
The Discover Group Team
      `.trim(),
    };

      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);
      
      if (previewUrl) {
        console.log('📧 Verification Email Preview URL: %s', previewUrl);
      }

      console.log('✅ Verification email sent! Message ID:', info.messageId);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (nodemailerError) {
      console.error('❌ Nodemailer verification email also failed:', nodemailerError);
      return {
        success: false,
        error: nodemailerError instanceof Error ? nodemailerError.message : 'Failed to send verification email via Nodemailer',
      };
    }
  } catch (error) {
    console.error('❌ Verification email sending failed with critical error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};

export const sendPasswordResetEmail = async (
  email: string,
  fullName: string,
  resetUrl: string
): Promise<{ success: boolean; messageId?: string; previewUrl?: string; error?: string }> => {
  try {
    console.log('📧 Sending password reset email to:', email);
    console.log('- GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set' : '❌ Not set (will use Ethereal fake SMTP)');
    
    const passwordResetHtml = `
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .container { 
            background: #f5f5f5; 
            border-radius: 8px; 
            padding: 30px; 
            box-shadow: 0 2px 4px rgba(0,0,0,0.1); 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 20px; 
            border-radius: 8px 8px 0 0; 
            text-align: center; 
        }
        .content { 
            background: white; 
            padding: 20px; 
            border-radius: 0 0 8px 8px; 
        }
        .reset-btn { 
            display: inline-block; 
            padding: 12px 30px; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            text-decoration: none; 
            border-radius: 8px; 
            margin: 20px 0; 
            font-weight: bold; 
        }
        .reset-btn:hover { 
            opacity: 0.9; 
        }
        .footer { 
            margin-top: 20px; 
            font-size: 12px; 
            color: #666; 
            border-top: 1px solid #eee; 
            padding-top: 10px; 
        }
    </style>
    <div class="container">
        <div class="header">
            <h1>🔐 Password Reset</h1>
        </div>
        <div class="content">
            <p>Hello ${fullName},</p>
            <p>We received a request to reset your password. Click the button below to set a new password:</p>
            <div style="text-align: center;">
                <a href="${resetUrl}" class="reset-btn">Reset Password</a>
            </div>
            <p style="color: #666; font-size: 14px;">Or copy this link: <br><code>${resetUrl}</code></p>
            <p style="color: #d32f2f;">This link will expire in 1 hour.</p>
            <p style="color: #666;">If you didn't request a password reset, you can ignore this email.</p>
        </div>
        <div class="footer">
            <p>© Discover Group. All rights reserved.</p>
        </div>
    </div>
    `;

    const passwordResetText = `
Hello ${fullName},

We received a request to reset your password. Click the link below to set a new password:
${resetUrl}

This link will expire in 1 hour.

If you didn't request a password reset, you can ignore this email.

Best regards,
The Discover Group Team
    `.trim();

    try {
      const transporter = await createTransporter();
      const fromEmail = getEmailFromAddress();
      const fromName = getEmailFromName();

      const mailOptions = {
        from: `"${fromName}" <${fromEmail}>`,
        to: email,
        subject: 'Password Reset Request - Discover Group',
        html: passwordResetHtml,
        text: passwordResetText,
      };

      const info = await transporter.sendMail(mailOptions);
      const previewUrl = nodemailer.getTestMessageUrl(info);

      if (previewUrl) {
        console.log('📧 Password Reset Email Preview URL: %s', previewUrl);
      }

      console.log('✅ Password reset email sent via Nodemailer! Message ID:', info.messageId);

      return {
        success: true,
        messageId: info.messageId,
        previewUrl: previewUrl || undefined,
      };
    } catch (nodemailerError) {
      console.error('❌ Nodemailer also failed:', nodemailerError);
      return {
        success: false,
        error: nodemailerError instanceof Error ? nodemailerError.message : 'Failed to send password reset email via Nodemailer',
      };
    }
  } catch (error) {
    console.error('❌ Password reset email sending failed with critical error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
};