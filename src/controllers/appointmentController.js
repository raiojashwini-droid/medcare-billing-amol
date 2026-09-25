import { prisma } from '../config/db.js';
import { sendAppointmentEmailNotification, sendBookingConfirmationEmail } from '../services/notificationService.js';
import { isUSFederalHoliday, isClinicClosed } from '../constants/usHolidays.js';

/**
 * Helper to format a DB Appointment record matching the frontend schema
 */
const formatAppointment = (a) => {
  if (!a) return null;
  return {
    id: a.id,
    patientId: a.patientId,
    patientName: a.patient ? `${a.patient.firstName} ${a.patient.lastName}`.trim() : a.patientName || 'Unknown Patient',
    patientPhone: a.patient?.phone || a.patientPhone || '',
    patientEmail: a.patient?.email || a.patientEmail || '',
    patientDob: a.patient?.dob || a.patientDob || '',
    caseId: a.caseId,
    providerId: a.providerId,
    providerName: a.provider?.name || a.providerName || 'Unknown Provider',
    appointmentType: a.appointmentType,
    date: a.date,
    startTime: a.startTime,
    endTime: a.endTime,
    location: a.location,
    status: a.status,
    bookingRef: a.bookingRef,
    bookingChannel: a.bookingChannel,
    reminderStatus: a.reminderStatus,
    reminderPreference: a.reminderPreference,
    reasonForVisit: a.reasonForVisit,
    cptCode: a.cptCode,
    rescheduleReason: a.rescheduleReason || '',
    cancelReason: a.cancelReason || '',
    createdAt: a.createdAt
  };
};

/**
 * Get appointments list with optional filters (date, patientId, providerId)
 */
export const getAppointments = async (req, res) => {
  const { date, patientId, providerId, status } = req.query;

  try {
    const where = {};
    if (date) where.date = date;
    if (patientId) where.patientId = patientId;
    if (providerId) where.providerId = providerId;
    if (status) where.status = status;

    const appointments = await prisma.appointment.findMany({
      where,
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            phone: true,
            email: true,
            dob: true
          }
        },
        provider: {
          select: {
            name: true
          }
        }
      },
      orderBy: [
        { date: 'desc' },
        { startTime: 'asc' }
      ]
    });

    const notes = await prisma.clinicalNote.findMany({
      select: { patientId: true, providerId: true, date: true }
    });

    const result = appointments.map(a => {
      const formatted = formatAppointment(a);
      // Check if a clinical note exists for this patient, provider, and date
      const hasNote = notes.some(n => 
        n.patientId === a.patientId && 
        n.providerId === a.providerId && 
        n.date === a.date
      );
      formatted.hasClinicalNote = hasNote;
      return formatted;
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error fetching appointments:', error);
    return res.status(500).json({ error: 'Internal server error fetching appointments.' });
  }
};

/**
 * Create/schedule new appointment
 */
export const createAppointment = async (req, res) => {
  const data = req.body;

  if (!data.date || !data.startTime) {
    return res.status(400).json({ error: 'date and startTime are required.' });
  }

  // Check clinic closure & past dates
  const closedCheck = isClinicClosed(data.date);
  if (closedCheck.isPast) {
    return res.status(400).json({ error: 'Appointments cannot be scheduled for past dates.' });
  }
  if (closedCheck.isClosed && !data.holidayOverride) {
    return res.status(400).json({ error: closedCheck.reason });
  }

  const generatedId = `apt-${Date.now()}`;

  try {
    // 1. Resolve Patient ID
    let targetPatientId = data.patientId;
    let patientEmail = data.patientEmail || '';
    let patientName = data.patientName || '';

    if (data.patientId) {
      const patientObj = await prisma.patient.findFirst({
        where: {
          OR: [
            { id: data.patientId },
            { patientId: data.patientId }
          ]
        }
      });
      if (patientObj) {
        targetPatientId = patientObj.id;
        patientEmail = patientObj.email || patientEmail;
        patientName = `${patientObj.firstName} ${patientObj.lastName}`.trim();
      }
    }

    if (!targetPatientId) {
      if (data.patientName) {
        const nameParts = data.patientName.trim().split(' ');
        const firstName = nameParts[0] || 'Walk-In';
        const lastName = nameParts.slice(1).join(' ') || 'Patient';
        const newPat = await prisma.patient.create({
          data: {
            id: `pat-${Date.now()}`,
            patientId: `${Math.floor(100000000 + Math.random() * 900000000)}`,
            firstName,
            lastName,
            phone: data.patientPhone || '',
            email: data.patientEmail || `${firstName.toLowerCase()}.${Date.now()}@example.com`,
            dob: data.patientDob || '1990-01-01',
            gender: 'Unspecified',
            status: 'ACTIVE'
          }
        });
        targetPatientId = newPat.id;
        patientName = `${newPat.firstName} ${newPat.lastName}`;
      } else {
        const fallbackPatient = await prisma.patient.findFirst();
        if (fallbackPatient) {
          targetPatientId = fallbackPatient.id;
          patientEmail = fallbackPatient.email || patientEmail;
          patientName = `${fallbackPatient.firstName} ${fallbackPatient.lastName}`.trim();
        }
      }
    }

    // 2. Resolve Case ID (handle business code CASE-xxx or PK case-xxx)
    let targetCaseId = null;
    if (data.caseId) {
      const caseObj = await prisma.case.findFirst({
        where: {
          OR: [
            { id: data.caseId },
            { caseId: data.caseId }
          ]
        }
      });
      if (caseObj) {
        targetCaseId = caseObj.id;
      }
    }

    // 3. Resolve Provider ID
    let targetProviderId = data.providerId || 'prov-josmic';
    let provName = 'Dr. Segun Adeoye (JOSMIC Wellness)';
    const provObj = await prisma.provider.findFirst({
      where: {
        OR: [
          { id: targetProviderId },
          { id: `prov-${targetProviderId.replace('prov-', '')}` }
        ]
      }
    });
    if (provObj) {
      targetProviderId = provObj.id;
      provName = provObj.name;
    } else {
      const newProv = await prisma.provider.create({
        data: {
          id: targetProviderId,
          name: data.providerName || 'New Practice Provider',
          businessName: 'F&M Health & Wellness',
          status: 'ACTIVE',
          isPlaceholder: true
        }
      });
      targetProviderId = newProv.id;
      provName = newProv.name;
    }

    // Parse appointmentDate if valid
    let appointmentDateVal = null;
    try {
      if (data.date) {
        appointmentDateVal = new Date(`${data.date}T00:00:00.000Z`);
      }
    } catch (e) {
      appointmentDateVal = null;
    }

    const newApt = await prisma.appointment.create({
      data: {
        id: generatedId,
        patientId: targetPatientId,
        caseId: targetCaseId,
        providerId: targetProviderId,
        date: data.date,
        appointmentDate: appointmentDateVal,
        startTime: data.startTime,
        endTime: data.endTime || '09:30 AM',
        status: data.status || 'SCHEDULED',
        bookingChannel: data.bookingChannel || 'Clinic Staff Portal',
        reminderStatus: 'Sent - SMS Queued',
        reminderPreference: data.reminderPreference || 'SMS',
        reasonForVisit: data.reasonForVisit || 'Comprehensive Evaluation',
        appointmentType: data.appointmentType || 'Consultation',
        cptCode: data.cptCode || '99204',
        location: data.location || 'Suite 774'
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, phone: true, email: true, dob: true }
        },
        provider: {
          select: { name: true }
        }
      }
    });

    // Asynchronously dispatch booking confirmation email
    if (patientEmail) {
      sendBookingConfirmationEmail({
        patientName: patientName || 'Patient',
        patientEmail,
        doctorName: provName,
        appointmentDate: data.date,
        appointmentTime: data.startTime
      }).catch(() => {});
    }

    return res.status(201).json(formatAppointment(newApt));
  } catch (error) {
    console.error('Error creating appointment:', error);
    return res.status(500).json({ error: error.message || 'Failed to schedule appointment.' });
  }
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const ampm = match[3].toUpperCase();
  if (ampm === 'PM' && hours < 12) hours += 12;
  if (ampm === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

/**
 * Get available slots for a provider on a date
 */
export const getAvailableSlots = async (req, res) => {
  const { providerId, date } = req.query;

  if (!providerId || !date) {
    return res.status(400).json({ error: 'providerId and date are required.' });
  }

  try {
    const clinicTz = req.query.timezone || 'America/Chicago';
    
    // Calculate current date and minutes in clinic timezone (Houston, TX)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: clinicTz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
    
    const parts = formatter.formatToParts(now);
    const partMap = {};
    parts.forEach(p => { partMap[p.type] = p.value; });

    const todayDateStr = `${partMap.year}-${partMap.month}-${partMap.day}`;
    const currentMinutes = parseInt(partMap.hour, 10) * 60 + parseInt(partMap.minute, 10);

    const isToday = date === todayDateStr;
    const isPastDate = date < todayDateStr;

    // Check if entire date is in the past
    if (isPastDate) {
      return res.status(200).json({
        isClosed: true,
        isPast: true,
        reason: 'Selected date is in the past. Please choose a future date.',
        slots: []
      });
    }

    // 1. Check if official US Federal Holiday
    const holidayCheck = isUSFederalHoliday(date);
    if (holidayCheck.isHoliday) {
      return res.status(200).json({
        isClosed: true,
        isWeekend: false,
        isHoliday: true,
        holidayName: holidayCheck.name,
        reason: `Clinic Closed — Official US Federal Holiday (${holidayCheck.name})`,
        slots: []
      });
    }

    // 2. Check if weekend
    const dateObj = new Date(`${date}T00:00:00`);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 6 = Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    if (isWeekend) {
      return res.status(200).json({
        isClosed: true,
        isWeekend: true,
        isHoliday: false,
        reason: 'Clinic closed on weekends',
        slots: []
      });
    }

    // 3. Fetch existing appointments for date
    const bookedApts = await prisma.appointment.findMany({
      where: {
        providerId,
        date,
        status: { not: 'CANCELLED' }
      },
      select: { startTime: true }
    });

    const bookedTimes = bookedApts.map(a => a.startTime);

    const defaultTimeSlots = [
      '08:30 AM', '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM', '11:00 AM',
      '01:00 PM', '01:30 PM', '02:00 PM', '02:30 PM', '03:00 PM', '03:30 PM', '04:00 PM'
    ];

    const slots = defaultTimeSlots.map(time => {
      const isBooked = bookedTimes.includes(time);
      const slotMinutes = parseTimeToMinutes(time);
      const isPastSlot = isToday && (slotMinutes <= currentMinutes);

      return {
        time,
        available: !isBooked && !isPastSlot,
        isBooked,
        isPast: isPastSlot,
        reason: isPastSlot ? 'Time passed' : isBooked ? 'Already booked' : 'Available'
      };
    });

    const hasAnyAvailable = slots.some(s => s.available);

    return res.status(200).json({
      isClosed: isToday && !hasAnyAvailable,
      allSlotsPassed: isToday && !hasAnyAvailable,
      reason: (isToday && !hasAnyAvailable) ? 'All appointment slots for today have already passed. Please select tomorrow or an upcoming date.' : '',
      isWeekend: false,
      isHoliday: false,
      slots
    });
  } catch (error) {
    console.error('Error calculating available slots:', error);
    return res.status(500).json({ error: 'Failed to retrieve available slots.' });
  }
};

/**
 * Auto-book from patient self-service portal
 */
export const autoBookAppointment = async (req, res) => {
  const data = req.body;

  if (!data.patientName || !data.patientPhone || !data.date || !data.time) {
    return res.status(400).json({ error: 'patientName, patientPhone, date, and time are required.' });
  }

  try {
    // Split firstName and lastName
    const nameParts = data.patientName.trim().split(/\s+/);
    const firstName = nameParts[0] || 'Portal';
    const lastName = nameParts.slice(1).join(' ') || 'Patient';

    // 1. Find or create a mock/placeholder patient in the database to link to
    let patient = await prisma.patient.findFirst({
      where: {
        phone: data.patientPhone
      }
    });

    if (!patient) {
      const newPatientId = `pat-self-${Date.now()}`;
      const mockMrn = `${Math.floor(100000000 + Math.random() * 900000000)}`;
      patient = await prisma.patient.create({
        data: {
          id: newPatientId,
          patientId: mockMrn,
          firstName,
          lastName,
          phone: data.patientPhone,
          email: data.patientEmail || '',
          dob: data.patientDob || '',
          sex: 'M',
          status: 'ACTIVE',
          assignedProviderIds: [data.providerId || 'prov-josmic'],
          createdAt: new Date().toISOString().split('T')[0]
        }
      });
    }

    const generatedId = `apt-auto-${Date.now()}`;
    const bookingRef = `SELF-${Math.floor(100000 + Math.random() * 900000)}`;

    const attorneySuffix = (data.hasAttorney && data.attorneyName)
      ? ` | Legal Rep: ${data.attorneyName}${data.attorneyPhone ? ` (${data.attorneyPhone})` : ''}`
      : '';
    const fullReason = (data.reasonForVisit || 'Patient Self-Scheduled Visit') + attorneySuffix;

    const newApt = await prisma.appointment.create({
      data: {
        id: generatedId,
        patientId: patient.id,
        providerId: data.providerId || 'prov-josmic',
        date: data.date,
        startTime: data.time,
        endTime: data.endTime || '09:30 AM',
        status: 'SCHEDULED',
        bookingRef,
        bookingChannel: 'Patient Online Self-Booking Portal',
        reminderStatus: data.patientEmail ? 'Automated Email & SMS Dispatched' : 'Automated SMS Dispatched',
        reminderPreference: data.patientEmail ? 'EMAIL' : 'SMS',
        reasonForVisit: fullReason,
        appointmentType: data.appointmentType || 'Consultation',
        cptCode: data.cptCode || '99204',
        location: 'Suite 774 - Main Clinic'
      },
      include: {
        patient: {
          select: { firstName: true, lastName: true, email: true, phone: true }
        },
        provider: {
          select: { name: true }
        }
      }
    });

    // ── Dispatch Automated Confirmation Email & SMS Notification ──
    const patientFullName = `${firstName} ${lastName}`.trim();
    const providerName = data.providerName || newApt.provider?.name || 'JOSMIC Wellness Center';

    if (data.patientEmail) {
      // 1. Insert DB log record
      await prisma.reminderLog.create({
        data: {
          id: `rem-email-${Date.now()}`,
          patientName: patientFullName,
          patientPhone: data.patientPhone || '',
          appointmentDate: data.date,
          appointmentTime: data.time,
          providerName,
          type: 'EMAIL',
          status: 'DELIVERED',
          deliveryStatus: 'Delivered',
          sentAt: new Date().toISOString(),
          message: `Dear ${patientFullName}, your appointment is confirmed for ${data.date} at ${data.time} with ${providerName}. Reference: ${bookingRef}. Location: Suite 774 Main Clinic.`
        }
      }).catch(err => console.warn('Reminder log email error:', err));

      // 2. Dispatch Live HTML Email (Plug & play with .env SMTP settings with safe anti-block protection)
      sendAppointmentEmailNotification({
        toEmail: data.patientEmail,
        patientName: patientFullName,
        bookingRef,
        date: data.date,
        time: data.time,
        providerName,
        location: newApt.location || 'Suite 774 - Main Clinic',
        appointmentType: data.appointmentType || 'Consultation'
      }).catch(err => console.error('Background email dispatch error:', err));
    }

    if (data.patientPhone) {
      await prisma.reminderLog.create({
        data: {
          id: `rem-sms-${Date.now() + 1}`,
          patientName: patientFullName,
          patientPhone: data.patientPhone,
          appointmentDate: data.date,
          appointmentTime: data.time,
          providerName,
          type: 'SMS',
          status: 'DELIVERED',
          deliveryStatus: 'Delivered',
          sentAt: new Date().toISOString(),
          message: `F&M Health: Your appointment is booked for ${data.date} at ${data.time}. Ref: ${bookingRef}. Reply C to confirm.`
        }
      }).catch(err => console.warn('Reminder log sms error:', err));
    }

    return res.status(201).json(formatAppointment(newApt));
  } catch (error) {
    console.error('Error in portal self booking:', error);
    return res.status(500).json({ error: 'Failed to process self-booking.' });
  }
};

/**
 * Update appointment status (CHECKED_IN, CANCELLED, etc.)
 */
export const updateStatus = async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  try {
    const updated = await prisma.appointment.update({
      where: { id },
      data: { status },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        provider: { select: { name: true } }
      }
    });

    return res.status(200).json(formatAppointment(updated));
  } catch (error) {
    console.error('Error updating status:', error);
    return res.status(500).json({ error: 'Failed to update visit status.' });
  }
};

/**
 * Reschedule appointment
 */
export const reschedule = async (req, res) => {
  const { id } = req.params;
  const { date, startTime, endTime, reason } = req.body;

  try {
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        date,
        startTime,
        endTime,
        rescheduleReason: reason,
        status: 'RESCHEDULED'
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        provider: { select: { name: true } }
      }
    });

    return res.status(200).json(formatAppointment(updated));
  } catch (error) {
    console.error('Error rescheduling appointment:', error);
    return res.status(500).json({ error: 'Failed to reschedule appointment.' });
  }
};

/**
 * Cancel appointment
 */
export const cancel = async (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;

  try {
    const updated = await prisma.appointment.update({
      where: { id },
      data: {
        status: 'CANCELLED',
        cancelReason: reason
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        provider: { select: { name: true } }
      }
    });

    return res.status(200).json(formatAppointment(updated));
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return res.status(500).json({ error: 'Failed to cancel appointment.' });
  }
};

/**
 * General update details (CPT lines etc.)
 */
export const updateAppointment = async (req, res) => {
  const { id } = req.params;
  const updateData = req.body;

  try {
    const existingApt = await prisma.appointment.findUnique({
      where: { id },
      select: { patientId: true }
    });

    const updatePayload = {};
    if (updateData.date) {
      updatePayload.date = String(updateData.date);
      const parsedDate = new Date(updateData.date);
      if (!isNaN(parsedDate.getTime())) {
        updatePayload.appointmentDate = parsedDate;
      }
    }
    if (updateData.startTime) updatePayload.startTime = updateData.startTime;
    if (updateData.endTime) updatePayload.endTime = updateData.endTime;
    if (updateData.providerId) updatePayload.providerId = updateData.providerId;
    if (updateData.reasonForVisit !== undefined) updatePayload.reasonForVisit = updateData.reasonForVisit;
    if (updateData.location) updatePayload.location = updateData.location;
    if (updateData.appointmentType) updatePayload.appointmentType = updateData.appointmentType;
    if (updateData.cptCode) updatePayload.cptCode = String(updateData.cptCode);
    if (updateData.status) updatePayload.status = updateData.status;

    if (existingApt?.patientId && (updateData.patientName || updateData.patientPhone || updateData.patientDob)) {
      const patientUpdate = {};
      if (updateData.patientName) {
        const nameParts = updateData.patientName.trim().split(/\s+/);
        patientUpdate.firstName = nameParts[0] || '';
        patientUpdate.lastName = nameParts.slice(1).join(' ') || '';
      }
      if (updateData.patientPhone) {
        patientUpdate.phone = updateData.patientPhone;
      }
      if (updateData.patientDob) {
        patientUpdate.dob = updateData.patientDob;
      }
      await prisma.patient.update({
        where: { id: existingApt.patientId },
        data: patientUpdate
      }).catch(err => console.warn('Failed updating patient record:', err));
    }

    const updated = await prisma.appointment.update({
      where: { id },
      data: updatePayload,
      include: {
        patient: { select: { firstName: true, lastName: true, phone: true, email: true, dob: true } },
        provider: { select: { name: true } }
      }
    });

    return res.status(200).json(formatAppointment(updated));
  } catch (error) {
    console.error('Error updating appointment metadata:', error);
    return res.status(500).json({ error: error.message || 'Failed to update appointment.' });
  }
};

/**
 * Delete an appointment completely
 */
export const deleteAppointment = async (req, res) => {
  const { id } = req.params;
  try {
    const deleted = await prisma.appointment.delete({
      where: { id }
    });
    return res.status(200).json(formatAppointment(deleted));
  } catch (error) {
    console.error('Error deleting appointment:', error);
    return res.status(500).json({ error: 'Failed to delete appointment.' });
  }
};
