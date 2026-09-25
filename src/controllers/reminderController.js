import { prisma } from '../config/db.js';

/**
 * Get reminder settings
 */
export const getSettings = async (req, res) => {
  try {
    let settings = await prisma.reminderSetting.findFirst();
    if (!settings) {
      // Return default values if missing
      settings = {
        id: 'default',
        enable24hSms: true,
        enable2hEmail: true,
        enableMissedFollowUp: true,
        smsTemplate: 'Reminder: Hello {PATIENT_NAME}, your upcoming medical appointment is scheduled for {APT_DATE} at {APT_TIME}. Reply 1 to confirm.',
        emailTemplate: 'Dear {PATIENT_NAME},\n\nThis is a reminder for your upcoming medical visit on {APT_DATE} at {APT_TIME}.\n\nPlease contact our office if you need to reschedule.'
      };
    }
    return res.status(200).json(settings);
  } catch (error) {
    console.error('Error fetching reminder settings:', error);
    return res.status(500).json({ error: 'Failed to retrieve reminder settings.' });
  }
};

/**
 * Save reminder settings
 */
export const saveSettings = async (req, res) => {
  const { enable24hSms, enable2hEmail, enableMissedFollowUp, smsTemplate, emailTemplate } = req.body;

  try {
    const updated = await prisma.reminderSetting.upsert({
      where: { id: 'default' },
      update: {
        enable24hSms: enable24hSms ?? true,
        enable2hEmail: enable2hEmail ?? true,
        enableMissedFollowUp: enableMissedFollowUp ?? true,
        smsTemplate: smsTemplate || '',
        emailTemplate: emailTemplate || ''
      },
      create: {
        id: 'default',
        enable24hSms: enable24hSms ?? true,
        enable2hEmail: enable2hEmail ?? true,
        enableMissedFollowUp: enableMissedFollowUp ?? true,
        smsTemplate: smsTemplate || '',
        emailTemplate: emailTemplate || ''
      }
    });

    return res.status(200).json(updated);
  } catch (error) {
    console.error('Error saving reminder settings:', error);
    return res.status(500).json({ error: 'Failed to save reminder settings.' });
  }
};

/**
 * Get reminder logs
 */
export const getLogs = async (req, res) => {
  try {
    const logs = await prisma.reminderLog.findMany({
      orderBy: { sentAt: 'desc' }
    });
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error fetching reminder logs:', error);
    return res.status(500).json({ error: 'Failed to retrieve reminder logs.' });
  }
};

/**
 * Simulate patient response (Confirm / Reschedule)
 */
export const simulatePatientResponse = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updated = await prisma.reminderLog.update({
      where: { id },
      data: { status }
    });

    // If patient confirmed, we can update matching appointment status to CONFIRMED or update reminderStatus
    console.log(`[ReminderLog] Simulated patient response for log ${id} -> Status: ${status}`);

    const logs = await prisma.reminderLog.findMany({
      orderBy: { sentAt: 'desc' }
    });
    return res.status(200).json(logs);
  } catch (error) {
    console.error('Error simulating response:', error);
    return res.status(500).json({ error: 'Failed to simulate response.' });
  }
};
