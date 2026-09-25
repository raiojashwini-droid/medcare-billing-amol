import { prisma } from '../config/db.js';
import { logger } from '../config/logger.js';

export const DEFAULT_SETTINGS = {
  // Practice Identity
  appName: 'F&M Health & Wellness',
  practiceName: 'F&M Health & Wellness Center LLC',
  practiceType: 'MULTI_SPECIALTY',
  npi: '1234567890',
  taxId: '75-1234567',
  licenseNumber: 'TX-MED-98765',
  practicePhone: '713-485-5700',
  practiceEmail: 'admin@medpracticepro.com',
  practiceAddress: '10101 Harwin Dr.',
  practiceCity: 'Houston',
  practiceState: 'TX',
  practiceZip: '77036',
  practiceWebsite: 'https://medpracticepro.com',

  // Localization
  timezone: 'America/Chicago',
  currency: 'USD',
  dateFormat: 'MM/DD/YYYY',
  timeFormat: '12H',
  language: 'en-US',
  fiscalYearStart: 'JANUARY',

  // Appointment Settings
  defaultAppointmentDuration: '60',
  appointmentBuffer: '15',
  scheduleStartTime: '08:00',
  scheduleEndTime: '18:00',
  allowSameDayBooking: true,
  requireAuthForBooking: false,
  autoConfirmAppointments: false,
  autoBlockUSHolidays: true,
  maxConcurrentAppointments: '3',

  // Notifications
  smsRemindersEnabled: true,
  emailRemindersEnabled: true,
  reminderTiming: '24H',
  appointmentConfirmationEmail: true,
  billingNotificationsEnabled: true,
  overdueBalanceAlerts: true,
  newPatientWelcomeEmail: true,
  smsSenderId: 'MedPracticePro',

  // Core Modalities & Services
  modalities: [
    { id: 'pain-mgmt', name: 'Pain Management', providerId: 'prov-josmic', providerName: 'JOSMIC Wellness Center', enabled: true, cpt: '99204', fee: '$1,214.00', duration: '60 min', template: 'JOSMIC Pain Evaluation', status: 'COMPLETE' },
    { id: 'laser-therapy', name: 'Laser Therapy', providerId: 'prov-anik', providerName: 'ANIK Laser Therapy', enabled: true, cpt: '97039', fee: '$2,000.00', duration: '45 min', template: 'ANIK Laser Procedure Form', status: 'COMPLETE' },
    { id: 'shockwave-therapy', name: 'Shockwave Therapy', providerId: 'prov-davs', providerName: "DAV'S Anatomy", enabled: true, cpt: '0101T', fee: '$1,000.00', duration: '30 min', template: "DAV'S ESWT Therapy Record", status: 'COMPLETE' },
    { id: 'trigger-point', name: 'Trigger Point Injection', providerId: '', providerName: 'Unassigned (Provider Assignment Required)', enabled: false, cpt: '20552', fee: 'Pricing Pending', duration: '30 min', template: 'Trigger Point Form (Pending)', status: 'CONFIGURATION_PENDING' },
    { id: 'tecar-therapy', name: 'TECAR Therapy', providerId: '', providerName: 'Unassigned (Provider Assignment Required)', enabled: false, cpt: '97039-RF', fee: 'Pricing Pending', duration: '45 min', template: 'TECAR Procedure Form (Pending)', status: 'CONFIGURATION_PENDING' },
    { id: 'counseling', name: 'Counseling & Mental Health', providerId: 'prov-counselor', providerName: 'Counselor Practice (Hope Behavioral Health)', enabled: true, cpt: '90834 / 90791', fee: '$180.00 - $350.00', duration: '45 min', template: 'Behavioral Health Progress Note', status: 'COMPLETE' }
  ]
};

export const getSettings = async (req, res) => {
  try {
    let setting = await prisma.generalSetting.findUnique({
      where: { id: 'default' }
    });
    
    if (!setting) {
      // Initialize with default settings in database
      setting = await prisma.generalSetting.create({
        data: {
          id: 'default',
          data: DEFAULT_SETTINGS
        }
      });
    }
    
    return res.status(200).json(setting.data || DEFAULT_SETTINGS);
  } catch (error) {
    logger.error('Error fetching general settings:', error);
    // Return fallback defaults so frontend never breaks
    return res.status(200).json(DEFAULT_SETTINGS);
  }
};

export const updateSettings = async (req, res) => {
  try {
    const settingsData = req.body;
    
    const existing = await prisma.generalSetting.findUnique({
      where: { id: 'default' }
    });
    
    const merged = {
      ...DEFAULT_SETTINGS,
      ...(existing?.data || {}),
      ...settingsData
    };
    
    const setting = await prisma.generalSetting.upsert({
      where: { id: 'default' },
      update: { data: merged },
      create: { id: 'default', data: merged }
    });
    
    return res.status(200).json(setting.data);
  } catch (error) {
    logger.error('Error updating general settings:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
};

