// backend/src/services/notificationService.js
import nodemailer from 'nodemailer';
import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

/**
 * Creates Nodemailer Transporter supporting Resend, SendGrid, Gmail App Passwords, or Standard SMTP
 */
const getTransporter = () => {
  // 1. Check for Resend API Key
  if (process.env.RESEND_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.resend.com',
      port: 465,
      secure: true,
      auth: {
        user: 'resend',
        pass: process.env.RESEND_API_KEY
      }
    });
  }

  // 2. Check for SendGrid API Key
  if (process.env.SENDGRID_API_KEY) {
    return nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY
      }
    });
  }

  // 3. Check for Standard SMTP / Gmail App Password
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true';

  if (!host || !user || !pass) {
    return null; // Not configured yet
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass }
  });
};

/**
 * Generic email dispatcher with auto-fallback to audit logging
 */
export const dispatchEmail = async ({ to, subject, html, text, eventType = 'GENERAL_NOTIFICATION', metadata = {}, attachments = [] }) => {
  const from = process.env.SMTP_FROM || process.env.EMAIL_FROM || '"F&M Health & Wellness" <onboarding@resend.dev>';
  const transporter = getTransporter();
  const timestamp = new Date();

  // If live email service is configured in .env, send real email!
  if (transporter) {
    try {
      const mailOptions = {
        from,
        to,
        subject,
        text: text || html.replace(/<[^>]*>?/gm, ''),
        html
      };

      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments;
      }

      const info = await transporter.sendMail(mailOptions);
      logger.info(`[Email Dispatcher] Live email sent to ${to} for event ${eventType} - MessageId: ${info.messageId}`);

      try {
        await prisma.reminderLog.create({
          data: {
            id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
            patientId: metadata.patientId || 'system',
            patientName: metadata.patientName || to,
            phone: metadata.phone || '',
            type: 'EMAIL',
            channel: 'EMAIL',
            status: 'DELIVERED',
            message: subject,
            scheduledFor: timestamp,
            sentAt: timestamp
          }
        });
      } catch (dbErr) {}

      return {
        success: true,
        mode: 'LIVE_EMAIL_DISPATCHED',
        messageId: info.messageId,
        recipient: to,
        timestamp
      };
    } catch (err) {
      logger.error(`[Email Dispatcher] Failed to send live email: ${err.message}`);
      return {
        success: false,
        mode: 'LIVE_EMAIL_FAILED',
        error: err.message,
        recipient: to
      };
    }
  }

  // Fallback mode (Plug & Play - Ready for API Key)
  logger.info(`[Email Dispatcher (Ready)] Event: ${eventType} -> Destination: ${to} | Subject: "${subject}" (API key pending in .env)`);

  try {
    await prisma.reminderLog.create({
      data: {
        id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        patientId: metadata.patientId || 'system',
        patientName: metadata.patientName || to,
        phone: metadata.phone || '',
        type: 'EMAIL',
        channel: 'EMAIL',
        status: 'QUEUED_READY',
        message: `${subject} (Plug & Play Ready)`,
        scheduledFor: timestamp,
        sentAt: timestamp
      }
    });
  } catch (dbErr) {}

  return {
    success: true,
    mode: 'QUEUED_READY',
    notice: 'Notification prepared and logged. Add RESEND_API_KEY, SENDGRID_API_KEY, or SMTP credentials to .env to deliver real-time inbox emails.',
    recipient: to,
    subject,
    timestamp
  };
};

/**
 * 1. Instant Patient Booking Confirmation Email
 */
export const sendBookingConfirmationEmail = async ({ patientName, patientEmail, doctorName, appointmentDate, appointmentTime, bookingRef, serviceName }) => {
  const subject = `Booking Confirmed: F&M Health & Wellness Appointment [${bookingRef || 'CONFIRMED'}]`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff; color: #1e293b;">
      <div style="background: linear-gradient(135deg, #0f766e 0%, #115e59 100%); padding: 20px; border-radius: 12px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 22px; font-weight: bold;">F&M Health & Wellness Center</h2>
        <p style="margin: 6px 0 0; font-size: 13px; opacity: 0.9;">10101 Harwin Dr., Houston, TX 77036 · (713) 485-5700</p>
      </div>
      <div style="padding: 24px 8px;">
        <div style="display: inline-block; background-color: #ccfbf1; color: #0f766e; font-size: 12px; font-weight: bold; padding: 4px 12px; border-radius: 20px; margin-bottom: 12px;">
          ✓ Appointment Scheduled & Confirmed
        </div>
        <h3 style="color: #0f172a; margin: 0 0 12px 0; font-size: 18px;">Hello ${patientName},</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.6;">Your medical visit has been successfully reserved in our live clinic calendar.</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0f766e; padding: 18px; border-radius: 8px; margin: 20px 0;">
          <p style="margin: 6px 0; font-size: 14px;"><strong>Booking Reference:</strong> <span style="font-family: monospace; font-weight: bold; color: #0f766e; background: #e6fffa; padding: 2px 6px; border-radius: 4px;">${bookingRef || 'SELF-PORTAL'}</span></p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Date & Time:</strong> ${appointmentDate} at ${appointmentTime}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Attending Clinician:</strong> ${doctorName || 'Attending Physician'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Service / Modality:</strong> ${serviceName || 'Pain Management & Evaluation'}</p>
          <p style="margin: 6px 0; font-size: 14px;"><strong>Location:</strong> Suite 774 Main Clinic, 10101 Harwin Dr., Houston, TX</p>
        </div>

        <p style="color: #64748b; font-size: 12px; line-height: 1.5;">Please arrive 10 minutes prior to your visit. If you need to reschedule, reply directly to this email or call our clinic desk.</p>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: patientEmail,
    subject,
    html,
    eventType: 'BOOKING_CONFIRMATION',
    metadata: { patientName }
  });
};

/**
 * 2. Automated Appointment Reminder Email (24h/48h Before)
 */
export const sendAppointmentReminderEmail = async ({ patientName, patientEmail, doctorName, appointmentDate, appointmentTime, serviceType }) => {
  const subject = `Appointment Reminder: Your upcoming visit with ${doctorName || 'F&M Health & Wellness'}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #0f766e; padding: 18px; border-radius: 12px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold;">F&M Health & Wellness Center</h2>
        <p style="margin: 4px 0 0; font-size: 12px;">Visit Reminder Notification</p>
      </div>

      <div style="padding: 24px 8px;">
        <h3 style="color: #0f172a; margin-top: 0;">Upcoming Appointment Reminder</h3>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">Hello <strong>${patientName}</strong>,</p>
        <p style="color: #334155; font-size: 14px; line-height: 1.6;">This is a reminder for your upcoming appointment:</p>
        
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #0f766e; padding: 16px; border-radius: 6px; margin: 20px 0;">
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Date:</strong> ${appointmentDate}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Time:</strong> ${appointmentTime}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Provider:</strong> ${doctorName || 'Attending Physician'}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Service:</strong> ${serviceType || 'Comprehensive Evaluation'}</p>
          <p style="margin: 4px 0; font-size: 13px; color: #334155;"><strong>Location:</strong> 10101 Harwin Dr., Houston, TX 77036</p>
        </div>

        <p style="color: #64748b; font-size: 12px;">If you need to reschedule or have any questions, please reply to this email or call our front desk at (713) 485-5700.</p>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: patientEmail,
    subject,
    html,
    eventType: 'APPOINTMENT_REMINDER',
    metadata: { patientName }
  });
};

/**
 * 3. Medical Report / SOAP Note & Superbill Delivery Email
 */
export const sendClinicalReportEmail = async ({ recipientEmail, recipientName, patientName, reportType = 'SOAP Note & Superbill', caseNumber, pdfBuffer, pdfFilename }) => {
  const subject = `Clinical Document: ${reportType} for ${patientName} [Case #${caseNumber || 'MVA-RECORD'}]`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #1e293b; padding: 18px; border-radius: 12px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; font-weight: bold;">F&M Health & Wellness Clinical Portal</h2>
        <p style="margin: 4px 0 0; font-size: 12px; color: #94a3b8;">Confidential Medical Records & Itemized Billing</p>
      </div>
      <div style="padding: 24px 8px; color: #334155; font-size: 14px; line-height: 1.6;">
        <p>Dear <strong>${recipientName || 'Care Coordinator / Attorney'}</strong>,</p>
        <p>Please find attached the official <strong>${reportType}</strong> for patient <strong>${patientName}</strong>.</p>
        <div style="background: #f1f5f9; padding: 14px; border-radius: 8px; margin: 15px 0;">
          <p style="margin: 4px 0;"><strong>Patient:</strong> ${patientName}</p>
          <p style="margin: 4px 0;"><strong>Case Number:</strong> ${caseNumber || 'N/A'}</p>
          <p style="margin: 4px 0;"><strong>Document Type:</strong> Certified Clinical Documentation & Claim Ledger</p>
        </div>
        <p style="font-size: 12px; color: #64748b;">This document contains protected health information (PHI) protected by HIPAA regulations.</p>
      </div>
    </div>
  `;

  const attachments = pdfBuffer ? [{ filename: pdfFilename || `${patientName}_Report.pdf`, content: pdfBuffer }] : [];

  return dispatchEmail({
    to: recipientEmail,
    subject,
    html,
    attachments,
    eventType: 'CLINICAL_REPORT_DELIVERY',
    metadata: { patientName }
  });
};

/**
 * 4. Billing Invoice & Payment Posted Notification
 */
export const sendPaymentPostedNotification = async ({ recipientEmail, patientName, statementNumber, amountPaid, paymentMethod, remainingBalance }) => {
  const subject = `Payment Receipt & Statement Update: Statement #${statementNumber}`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #0284c7; padding: 18px; border-radius: 12px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; color: #ffffff;">Payment Receipt & Billing Statement</h2>
      </div>
      <div style="padding: 24px 8px; color: #334155; font-size: 14px;">
        <p>A payment transaction has been successfully processed and recorded:</p>
        <div style="background: #f0fdf4; border-left: 4px solid #16a34a; padding: 14px; border-radius: 6px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Patient:</strong> ${patientName}</p>
          <p style="margin: 4px 0;"><strong>Statement Number:</strong> #${statementNumber}</p>
          <p style="margin: 4px 0;"><strong>Amount Paid:</strong> <span style="font-weight: bold; color: #15803d;">$${amountPaid}</span></p>
          <p style="margin: 4px 0;"><strong>Payment Method:</strong> ${paymentMethod}</p>
          <p style="margin: 4px 0;"><strong>Remaining Balance:</strong> $${remainingBalance}</p>
        </div>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: recipientEmail,
    subject,
    html,
    eventType: 'BILLING_PAYMENT_NOTIFICATION'
  });
};

/**
 * 5. Staff & Doctor Onboarding Credential Email
 */
export const sendStaffInvitationEmail = async ({ staffEmail, staffName, role, temporaryPassword, loginUrl }) => {
  const subject = `Welcome to MedCare Practice: Your Staff Portal Access`;
  const html = `
    <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 16px; background-color: #ffffff;">
      <div style="background-color: #0f766e; padding: 18px; border-radius: 12px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; color: #ffffff;">MedCare Staff Portal</h2>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.9;">Staff Account Created</p>
      </div>
      <div style="padding: 24px 8px; color: #334155; font-size: 14px; line-height: 1.6;">
        <p>Hello <strong>${staffName}</strong>,</p>
        <p>An authorized administrative account has been provisioned for you in the MedCare Clinical Platform:</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Assigned Role:</strong> ${role}</p>
          <p style="margin: 4px 0;"><strong>Login Email:</strong> ${staffEmail}</p>
          <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px;">${temporaryPassword || 'MedCare@2026!'}</code></p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${loginUrl || 'http://localhost:3000/login'}" style="background-color: #0f766e; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
            Log In to MedCare Portal
          </a>
        </div>
      </div>
    </div>
  `;

  return dispatchEmail({
    to: staffEmail,
    subject,
    html,
    eventType: 'STAFF_ONBOARDING_INVITE'
  });
};

export const sendNewPatientWelcomeEmail = sendBookingConfirmationEmail;
export const sendAppointmentEmailNotification = sendAppointmentReminderEmail;
export const sendAppointmentEmail = sendAppointmentReminderEmail;

export default {
  dispatchEmail,
  sendAppointmentReminderEmail,
  sendAppointmentEmailNotification,
  sendAppointmentEmail,
  sendBookingConfirmationEmail,
  sendClinicalReportEmail,
  sendPaymentPostedNotification,
  sendStaffInvitationEmail,
  sendNewPatientWelcomeEmail
};

