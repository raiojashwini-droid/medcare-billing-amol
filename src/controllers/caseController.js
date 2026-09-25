import { prisma } from '../config/db.js';

/**
 * Format a DB Case record to match frontend model structure
 */
const formatCase = (c) => {
  if (!c) return null;
  const p = c.patient || {};
  const rawDx = typeof c.diagnosisCodes === 'string' ? JSON.parse(c.diagnosisCodes) : c.diagnosisCodes;
  const dxList = Array.isArray(rawDx) ? rawDx : [];

  const patientFullName = p.firstName || p.lastName ? `${p.firstName || ''} ${p.middleName ? p.middleName + ' ' : ''}${p.lastName || ''}`.trim() : (c.patientName || '');
  const patientAddrStr = p.addressLine1 || p.street ? `${p.addressLine1 || p.street || ''}, ${p.city || ''} ${p.state || ''} ${p.zipCode || ''}`.trim() : (c.patientAddress || '');

  let caseTotalBilling = 0;
  let uniqueProviders = new Set();
  
  if (c.bills && Array.isArray(c.bills)) {
    c.bills.forEach(bill => {
      uniqueProviders.add(bill.providerId);
      if (bill.totals) {
        const t = typeof bill.totals === 'string' ? JSON.parse(bill.totals) : bill.totals;
        if (t.totalCharges) {
          caseTotalBilling += parseFloat(t.totalCharges) || 0;
        }
      }
    });
  }

  return {
    id: c.id,
    caseId: c.caseId,
    patientId: c.patientId,
    patientName: patientFullName,
    patient: {
      id: p.id || c.patientId,
      patientId: p.patientId || c.patientId,
      firstName: p.firstName || '',
      middleName: p.middleName || '',
      lastName: p.lastName || '',
      dob: p.dob || '',
      sex: p.sex || '',
      gender: p.sex || '',
      phone: p.phone || '',
      email: p.email || '',
      address: patientAddrStr,
      knownAllergies: p.knownAllergies || '',
      selectedInjuryAreas: typeof p.selectedInjuryAreas === 'string' ? JSON.parse(p.selectedInjuryAreas) : (p.selectedInjuryAreas || [])
    },
    patientDob: p.dob || c.patientDob || '',
    patientSex: p.sex || c.patientSex || '',
    patientAddress: patientAddrStr,
    patientPhone: p.phone || c.patientPhone || '',
    accidentDate: c.accidentDate || '',
    initialDate: c.initialDate || '',
    dischargeDate: c.dischargeDate || '',
    accidentType: c.accidentType || 'AUTO_ACCIDENT',
    accidentState: c.accidentState || '',
    accidentCity: c.accidentCity || '',
    accidentLocation: c.accidentLocation || '',
    mechanismOfInjury: c.mechanismOfInjury || '',
    policeReportNumber: c.policeReportNumber || '',
    emergencyTransport: c.emergencyTransport || 'NONE',
    chiefComplaint: c.chiefComplaint || '',
    painDescription: (() => {
      try {
        if (!c.painDescription) return [];
        if (typeof c.painDescription === 'string') return JSON.parse(c.painDescription);
        return Array.isArray(c.painDescription) ? c.painDescription : [];
      } catch (e) {
        return [];
      }
    })(),
    injuryBodyParts: c.injuryBodyParts || '',
    diagnosisCodes: dxList,
    referringProviderName: c.referringProviderName || '',
    referringProviderNpi: c.referringProviderNpi || '',
    attorneyName: c.attorneyName || '',
    lawFirm: c.lawFirm || '',
    attorneyAddress: c.attorneyAddress || '',
    attorneyPhone: c.attorneyPhone || '',
    attorneyEmail: c.attorneyEmail || '',
    lawFirmAddress: c.lawFirmAddress || '',
    litigationStatus: c.litigationStatus || 'PRE_LITIGATION',
    insuranceCompany: c.insuranceCompany || '',
    insurancePolicyNumber: c.insurancePolicyNumber || '',
    insuranceClaimNumber: c.insuranceClaimNumber || '',
    insuranceAdjuster: c.insuranceAdjuster || '',
    insuranceAdjusterPhone: c.insuranceAdjusterPhone || '',
    liabilityStatus: c.liabilityStatus || 'PENDING',
    caseNotes: c.caseNotes || '',
    assignedProviderIds: typeof c.assignedProviderIds === 'string' ? JSON.parse(c.assignedProviderIds) : (c.assignedProviderIds || []),
    status: c.status || 'ACTIVE',
    createdAt: c.createdAt,
    bills: c.bills || [],
    appointments: c.appointments || [],
    clinicalNotes: c.clinicalNotes || [],
    caseTotalBilling,
    connectedProviderLedgersCount: uniqueProviders.size
  };
};

/**
 * Get cases list (supports search and patientId filter)
 */
export const getCases = async (req, res) => {
  const { search, patientId, providerId } = req.query;

  try {
    const where = {};

    if (patientId) {
      where.patientId = patientId;
    }

    if (search) {
      const q = search.toLowerCase();
      where.OR = [
        { caseId: { contains: q } },
        { attorneyName: { contains: q } },
        { lawFirm: { contains: q } },
        { patient: { firstName: { contains: q } } },
        { patient: { lastName: { contains: q } } }
      ];
    }

    let cases = await prisma.case.findMany({
      where,
      include: {
        patient: true,
        bills: true,
        appointments: { orderBy: { createdAt: 'desc' } },
        clinicalNotes: { orderBy: { createdAt: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    if (providerId) {
      cases = cases.filter(c => {
        const ids = typeof c.assignedProviderIds === 'string' ? JSON.parse(c.assignedProviderIds) : c.assignedProviderIds;
        return Array.isArray(ids) && ids.includes(providerId);
      });
    }

    return res.status(200).json(cases.map(formatCase));
  } catch (error) {
    console.error('Error fetching cases:', error);
    return res.status(500).json({ error: 'Internal server error fetching cases.' });
  }
};

/**
 * Get case details by ID
 */
export const getCaseById = async (req, res) => {
  const { id } = req.params;

  try {
    const caseObj = await prisma.case.findFirst({
      where: {
        OR: [
          { id },
          { caseId: id }
        ]
      },
      include: {
        patient: true,
        bills: true,
        appointments: { orderBy: { createdAt: 'desc' } },
        clinicalNotes: { orderBy: { createdAt: 'desc' } }
      }
    });

    if (!caseObj) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    return res.status(200).json(formatCase(caseObj));
  } catch (error) {
    console.error('Error fetching case by ID:', error);
    return res.status(500).json({ error: 'Failed to retrieve case details.' });
  }
};

/**
 * Register new case for a patient
 */
export const createCase = async (req, res) => {
  const data = req.body;

  if (!data.patientId || !data.accidentType || !data.accidentState) {
    return res.status(400).json({ error: 'patientId, accidentType, and accidentState are required.' });
  }

  const generatedId = `case-${Date.now()}`;
  const generatedCaseStr = `CASE-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;

  try {
    // Confirm patient exists
    const patient = await prisma.patient.findUnique({
      where: { id: data.patientId }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Associated patient not found.' });
    }

    const newCase = await prisma.case.create({
      data: {
        id: generatedId,
        caseId: generatedCaseStr,
        patientId: data.patientId,
        accidentDate: data.accidentDate || '',
        initialDate: data.initialDate || '',
        dischargeDate: data.dischargeDate || '',
        accidentType: data.accidentType,
        accidentState: data.accidentState,
        accidentCity: data.accidentCity || '',
        accidentLocation: data.accidentLocation || '',
        mechanismOfInjury: data.mechanismOfInjury || '',
        policeReportNumber: data.policeReportNumber || '',
        emergencyTransport: data.emergencyTransport || '',
        chiefComplaint: data.chiefComplaint || '',
        painDescription: Array.isArray(data.painDescription) ? JSON.stringify(data.painDescription) : (data.painDescription ? JSON.stringify([data.painDescription]) : '[]'),
        injuryBodyParts: data.injuryBodyParts || '',
        diagnosisCodes: data.diagnosisCodes || [],
        referringProviderName: data.referringProviderName || '',
        referringProviderNpi: data.referringProviderNpi || '',
        attorneyName: data.attorneyName || '',
        lawFirm: data.lawFirm || '',
        attorneyAddress: data.attorneyAddress || '',
        attorneyPhone: data.attorneyPhone || '',
        attorneyEmail: data.attorneyEmail || '',
        lawFirmAddress: data.lawFirmAddress || '',
        litigationStatus: data.litigationStatus || 'UNFILED',
        insuranceCompany: data.insuranceCompany || '',
        insurancePolicyNumber: data.insurancePolicyNumber || '',
        insuranceClaimNumber: data.insuranceClaimNumber || '',
        insuranceAdjuster: data.insuranceAdjuster || '',
        insuranceAdjusterPhone: data.insuranceAdjusterPhone || '',
        liabilityStatus: data.liabilityStatus || 'PENDING',
        caseNotes: data.caseNotes || '',
        assignedProviderIds: data.assignedProviderIds || [],
        status: 'ACTIVE'
      },
      include: {
        patient: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true
          }
        }
      }
    });

    return res.status(201).json(formatCase(newCase));
  } catch (error) {
    console.error('Error creating case:', error);
    return res.status(500).json({ error: 'Failed to register patient case.' });
  }
};

/**
 * Update case assigned providers
 */
export const updateAssignedProviders = async (req, res) => {
  const { id } = req.params;
  const { providerIds } = req.body;

  if (!Array.isArray(providerIds)) {
    return res.status(400).json({ error: 'providerIds must be an array.' });
  }

  try {
    const existing = await prisma.case.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const updated = await prisma.case.update({
      where: { id },
      data: {
        assignedProviderIds: providerIds
      },
      include: {
        patient: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true
          }
        }
      }
    });

    return res.status(200).json(formatCase(updated));
  } catch (error) {
    console.error('Error updating case assigned providers:', error);
    return res.status(500).json({ error: 'Failed to update assigned providers.' });
  }
};

/**
 * Update entire case (including Attorney & Law Firm)
 */
export const updateCase = async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  try {
    const existing = await prisma.case.findFirst({
      where: {
        OR: [{ id }, { caseId: id }]
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const updated = await prisma.case.update({
      where: { id: existing.id },
      data: {
        ...(data.accidentDate !== undefined && { accidentDate: data.accidentDate }),
        ...(data.initialDate !== undefined && { initialDate: data.initialDate }),
        ...(data.dischargeDate !== undefined && { dischargeDate: data.dischargeDate }),
        ...(data.accidentType !== undefined && { accidentType: data.accidentType }),
        ...(data.accidentState !== undefined && { accidentState: data.accidentState }),
        ...(data.accidentCity !== undefined && { accidentCity: data.accidentCity }),
        ...(data.accidentLocation !== undefined && { accidentLocation: data.accidentLocation }),
        ...(data.mechanismOfInjury !== undefined && { mechanismOfInjury: data.mechanismOfInjury }),
        ...(data.policeReportNumber !== undefined && { policeReportNumber: data.policeReportNumber }),
        ...(data.emergencyTransport !== undefined && { emergencyTransport: data.emergencyTransport }),
        ...(data.chiefComplaint !== undefined && { chiefComplaint: data.chiefComplaint }),
        ...(data.painDescription !== undefined && { painDescription: Array.isArray(data.painDescription) ? JSON.stringify(data.painDescription) : JSON.stringify([data.painDescription]) }),
        ...(data.injuryBodyParts !== undefined && { injuryBodyParts: data.injuryBodyParts }),
        ...(data.diagnosisCodes !== undefined && { diagnosisCodes: data.diagnosisCodes }),
        ...(data.referringProviderName !== undefined && { referringProviderName: data.referringProviderName }),
        ...(data.referringProviderNpi !== undefined && { referringProviderNpi: data.referringProviderNpi }),
        ...(data.attorneyName !== undefined && { attorneyName: data.attorneyName }),
        ...(data.lawFirm !== undefined && { lawFirm: data.lawFirm }),
        ...(data.attorneyPhone !== undefined && { attorneyPhone: data.attorneyPhone }),
        ...(data.attorneyEmail !== undefined && { attorneyEmail: data.attorneyEmail }),
        ...(data.lawFirmAddress !== undefined && { lawFirmAddress: data.lawFirmAddress }),
        ...(data.litigationStatus !== undefined && { litigationStatus: data.litigationStatus }),
        ...(data.insuranceCompany !== undefined && { insuranceCompany: data.insuranceCompany }),
        ...(data.insurancePolicyNumber !== undefined && { insurancePolicyNumber: data.insurancePolicyNumber }),
        ...(data.insuranceClaimNumber !== undefined && { insuranceClaimNumber: data.insuranceClaimNumber }),
        ...(data.insuranceAdjuster !== undefined && { insuranceAdjuster: data.insuranceAdjuster }),
        ...(data.insuranceAdjusterPhone !== undefined && { insuranceAdjusterPhone: data.insuranceAdjusterPhone }),
        ...(data.liabilityStatus !== undefined && { liabilityStatus: data.liabilityStatus }),
        ...(data.caseNotes !== undefined && { caseNotes: data.caseNotes }),
        ...(data.status !== undefined && { status: data.status })
      },
      include: {
        patient: {
          select: {
            firstName: true,
            middleName: true,
            lastName: true
          }
        }
      }
    });

    return res.status(200).json(formatCase(updated));
  } catch (error) {
    console.error('Error updating case:', error);
    return res.status(500).json({ error: 'Failed to update case.' });
  }
};

/**
 * Delete case by ID
 */
export const deleteCase = async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.case.findFirst({
      where: {
        OR: [{ id }, { caseId: id }]
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Case record not found.' });
    }

    await prisma.case.delete({
      where: { id: existing.id }
    });

    return res.status(200).json({ success: true, message: `Accident Case ${existing.caseId} deleted.` });
  } catch (error) {
    console.error('Error deleting case:', error);
    return res.status(500).json({ error: 'Failed to delete accident case.' });
  }
};
