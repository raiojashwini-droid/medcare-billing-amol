// backend/src/controllers/notificationController.js
import {
  dispatchEmail,
  sendAppointmentReminderEmail,
  sendBookingConfirmationEmail,
  sendNewPatientWelcomeEmail,
  sendPaymentPostedNotification
} from '../services/notificationService.js';
import { prisma } from '../config/db.js';

/**
 * Send a test email to verify SMTP configuration
 */
export const testEmailDispatch = async (req, res) => {
  const { recipientEmail, eventType } = req.body;

  const targetEmail = recipientEmail || 'test@medpracticepro.com';

  try {
    let result;

    if (eventType === 'APPOINTMENT_REMINDER') {
      result = await sendAppointmentReminderEmail({
        patientName: 'Test Patient (Yash)',
        patientEmail: targetEmail,
        doctorName: 'Dr. Segun Adeoye (Attending Physician)',
        appointmentDate: new Date().toLocaleDateString(),
        appointmentTime: '10:30 AM',
        serviceType: 'Initial Comprehensive Pain Evaluation'
      });
    } else if (eventType === 'NEW_PATIENT_WELCOME') {
      result = await sendNewPatientWelcomeEmail({
        patientName: 'Test Patient (Yash)',
        patientEmail: targetEmail,
        mrn: 'MRN-2026-9988'
      });
    } else {
      result = await dispatchEmail({
        to: targetEmail,
        subject: 'F&M Health & Wellness — Email System Connectivity Test',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 500px; padding: 20px; border: 1px solid #cbd5e1; border-radius: 8px;">
            <h2 style="color: #0f766e; margin-top: 0;">✅ Email Connectivity Test Successful</h2>
            <p>Your MedCare Billing &amp; Clinical notification engine is fully connected and operational!</p>
            <p style="font-size: 12px; color: #64748b;">Timestamp: ${new Date().toISOString()}</p>
          </div>
        `,
        eventType: 'CONNECTIVITY_TEST'
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Email dispatch test processed successfully',
      result
    });
  } catch (error) {
    console.error('Error in testEmailDispatch:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to process email test dispatch',
      details: error.message
    });
  }
};

/**
 * Get notification logs
 */
export const getNotificationLogs = async (req, res) => {
  try {
    const logs = await prisma.reminderLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 50
    });
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching notification logs:', error);
    return res.status(500).json({ error: 'Failed to fetch notification logs.' });
  }
};

/**
 * Get live aggregate practice notifications for the top header notification center
 */
export const getLiveNotifications = async (req, res) => {
  const { providerId, role } = req.query;

  try {
    const isFullAccess = !role || ['Receptionist', 'Super Admin', 'Billing Staff'].includes(role);
    const aptWhere = {};
    if (!isFullAccess && providerId) {
      aptWhere.providerId = providerId;
    }

    // 1. Fetch appointments
    const appointments = await prisma.appointment.findMany({
      where: aptWhere,
      include: {
        patient: {
          select: { firstName: true, lastName: true, phone: true, assignedProviderIds: true }
        },
        provider: {
          select: { name: true }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    });

    // 2. Fetch reminder logs
    const reminderLogs = await prisma.reminderLog.findMany({
      orderBy: { sentAt: 'desc' },
      take: 5
    }).catch(() => []);

    // 3. Fetch outstanding bills
    const bills = await prisma.bill.findMany({
      include: {
        case: {
          include: { patient: true }
        },
        provider: true
      },
      orderBy: { createdAt: 'desc' },
      take: 10
    }).catch(() => []);

    const notifications = [];

    // Format appointments into notifications
    appointments.forEach(apt => {
      const patientName = apt.patient ? `${apt.patient.firstName} ${apt.patient.lastName}`.trim() : apt.patientName || 'Accident Patient';
      const providerName = apt.provider?.name || apt.providerName || 'Care Provider';

      if (apt.status === 'CHECKED_IN') {
        notifications.push({
          id: `notif-checkin-${apt.id}`,
          type: 'CHECK_IN',
          title: 'Patient Arrived in Lobby',
          message: `${patientName} checked in for ${apt.appointmentType || 'Therapy Visit'} with ${providerName}`,
          time: apt.startTime || 'Now',
          date: apt.date,
          status: 'CHECKED_IN',
          badge: 'In Lobby',
          badgeColor: 'bg-teal-100 text-teal-800 border-teal-200',
          link: '/appointments/checkin',
          read: false,
          createdAt: apt.createdAt || new Date()
        });
      } else {
        notifications.push({
          id: `notif-apt-${apt.id}`,
          type: 'APPOINTMENT',
          title: `Visit: ${apt.appointmentType || 'Therapy Session'}`,
          message: `${patientName} scheduled with ${providerName} (${apt.startTime || ''})`,
          time: apt.startTime,
          date: apt.date,
          status: apt.status || 'SCHEDULED',
          badge: apt.status || 'Booked',
          badgeColor: 'bg-cyan-100 text-cyan-800 border-cyan-200',
          link: '/appointments/calendar',
          read: false,
          createdAt: apt.createdAt || new Date()
        });
      }
    });

    // Format bills into notifications
    bills.forEach(b => {
      const patientName = b.case?.patient ? `${b.case.patient.firstName} ${b.case.patient.lastName}`.trim() : (b.billToName || 'Accident Patient');
      const providerName = b.provider?.name || 'Clinic Provider';
      const totals = typeof b.totals === 'string' ? JSON.parse(b.totals) : (b.totals || {});
      const balanceDue = Number(totals.balanceDue !== undefined ? totals.balanceDue : (totals.totalCharges || 0));

      if (balanceDue > 0 || b.status !== 'PAID') {
        notifications.push({
          id: `notif-bill-${b.id}`,
          type: 'BILLING',
          title: `Ledger: Statement #${b.statementNumber || b.invoiceNumber || b.id}`,
          message: `${providerName} bill for ${patientName} — Balance: $${balanceDue.toFixed(2)}`,
          badge: b.status === 'PAID' ? 'Settled' : 'Balance Due',
          badgeColor: b.status === 'PAID' ? 'bg-emerald-100 text-emerald-800 border-emerald-200' : 'bg-amber-100 text-amber-800 border-amber-200',
          link: '/billing/four-bills',
          read: false,
          createdAt: b.createdAt || new Date()
        });
      }
    });

    // Format reminder logs
    reminderLogs.forEach(r => {
      notifications.push({
        id: `notif-rem-${r.id}`,
        type: 'REMINDER',
        title: `Reminder: ${r.type || 'SMS'} Dispatched`,
        message: `Automated ${r.type || 'SMS'} reminder delivered to ${r.recipient || 'Patient'}`,
        badge: 'Delivered',
        badgeColor: 'bg-slate-100 text-slate-700 border-slate-200',
        link: '/appointments/reminders',
        read: true,
        createdAt: r.sentAt || new Date()
      });
    });

    // Sort notifications newest first
    notifications.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return res.status(200).json({
      unreadCount: notifications.filter(n => !n.read).length,
      notifications: notifications.slice(0, 15)
    });
  } catch (error) {
    console.error('Error fetching live notifications:', error);
    return res.status(500).json({ error: 'Failed to fetch live practice notifications.' });
  }
};

