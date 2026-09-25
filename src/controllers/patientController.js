import { prisma } from '../config/db.js';

/**
 * Format a DB patient object to match frontend model (with nested address)
 */
const formatPatient = (p) => {
  if (!p) return null;
  let totalPracticeAR = 0;
  let uniqueProviders = new Set();

  if (p.cases && Array.isArray(p.cases)) {
    p.cases.forEach(c => {
      if (c.bills && Array.isArray(c.bills)) {
        c.bills.forEach(bill => {
          uniqueProviders.add(bill.providerId);
          if (bill.totals) {
            const t = typeof bill.totals === 'string' ? JSON.parse(bill.totals) : bill.totals;
            if (t.totalCharges) {
              totalPracticeAR += parseFloat(t.totalCharges) || 0;
            }
          }
        });
      }
    });
  }

  return {
    id: p.id,
    patientId: p.patientId,
    firstName: p.firstName,
    middleName: p.middleName,
    lastName: p.lastName,
    dob: p.dob,
    sex: p.sex,
    phone: p.phone,
    email: p.email,
    ssn: p.ssn,
    primaryGroupNumber: p.primaryGroupNumber || '',
    address: {
      street: p.street || '',
      suite: p.suite || '',
      city: p.city || '',
      state: p.state || '',
      zipCode: p.zipCode || ''
    },
    location: p.location || '',
    maritalStatus: p.maritalStatus || '',
    relationshipToInsured: p.relationshipToInsured || '',
    employmentStatus: p.employmentStatus || '',
    policyHolderName: p.policyHolderName || '',
    policyHolderDob: p.policyHolderDob || '',
    secondaryInsuranceCompany: p.secondaryInsuranceCompany || '',
    secondaryPolicyNumber: p.secondaryPolicyNumber || '',
    communicationPref: p.communicationPref,
    consentStatus: p.consentStatus,
    maritalStatus: p.maritalStatus || 'SINGLE',
    driversLicense: p.driversLicense || '',
    driversLicenseState: p.driversLicenseState || 'TX',
    language: p.language || 'English',
    ethnicity: p.ethnicity || 'Non-Hispanic',
    employmentStatus: p.employmentStatus || '',
    employerName: p.employerName || '',
    emergencyContactName: p.emergencyContactName || '',
    emergencyContactRelation: p.emergencyContactRelation || '',
    emergencyContactPhone: p.emergencyContactPhone || '',
    insuranceType: p.insuranceType || '',
    primaryInsuranceCompany: p.primaryInsuranceCompany || '',
    primaryPolicyNumber: p.primaryPolicyNumber || '',
    primaryInsuranceMemberId: p.primaryInsuranceMemberId || '',
    policyHolderName: p.policyHolderName || '',
    policyHolderDob: p.policyHolderDob || '',
    insuranceAdjusterName: p.insuranceAdjusterName || '',
    insuranceAdjusterPhone: p.insuranceAdjusterPhone || '',
    secondaryInsuranceCompany: p.secondaryInsuranceCompany || '',
    secondaryPolicyNumber: p.secondaryPolicyNumber || '',
    referringProvider: p.referringProvider || p.cases?.[0]?.referringProviderName || '',
    referringProviderNpi: p.referringProviderNpi || p.cases?.[0]?.referringProviderNpi || '',
    assignedProviderIds: typeof p.assignedProviderIds === 'string' ? JSON.parse(p.assignedProviderIds) : p.assignedProviderIds,
    knownAllergies: p.knownAllergies || '',
    allergyReactionSeverity: p.allergyReactionSeverity || '',
    currentMedications: p.currentMedications || '',
    pastMedicalHistory: p.pastMedicalHistory || '',
    selectedInjuryAreas: typeof p.selectedInjuryAreas === 'string' ? JSON.parse(p.selectedInjuryAreas) : (p.selectedInjuryAreas || []),
    accidentDate: p.accidentDate || '',
    mechanismOfInjury: p.mechanismOfInjury || '',
    patientNotes: p.patientNotes || '',
    hipaaConsentSigned: p.hipaaConsentSigned ?? true,
    status: p.status,
    createdAt: p.createdAt,
    totalPracticeAR,
    connectedProviderBillsCount: uniqueProviders.size
  };
};

/**
 * Get patients list (with filters & search)
 */
export const getPatients = async (req, res) => {
  const { search, status, providerId } = req.query;

  try {
    const where = {};

    if (status) {
      where.status = status;
    }

    if (search) {
      const q = search.trim();
      where.OR = [
        { patientId: { contains: q } },
        { id: { contains: q } },
        { firstName: { contains: q } },
        { lastName: { contains: q } },
        { middleName: { contains: q } },
        { phone: { contains: q } },
        { email: { contains: q } },
        { city: { contains: q } },
        { ssn: { contains: q } }
      ];
    }

    let patients = await prisma.patient.findMany({
      where,
      include: {
        cases: {
          include: {
            bills: true
          }
        }
      },
      orderBy: { createdAtDate: 'desc' }
    });

    // Client-side provider ID filter mapping if requested
    if (providerId) {
      patients = patients.filter(p => {
        const ids = typeof p.assignedProviderIds === 'string' ? JSON.parse(p.assignedProviderIds) : p.assignedProviderIds;
        return Array.isArray(ids) && ids.includes(providerId);
      });
    }

    return res.status(200).json(patients.map(formatPatient));
  } catch (error) {
    console.error('Error fetching patients:', error);
    return res.status(500).json({ error: 'Internal server error fetching patients.' });
  }
};

/**
 * Get patient profile details by ID
 */
export const getPatientById = async (req, res) => {
  const { id } = req.params;

  try {
    const patient = await prisma.patient.findFirst({
      where: {
        OR: [
          { id },
          { patientId: id }
        ]
      },
      include: {
        cases: {
          include: {
            bills: true
          }
        }
      }
    });

    if (!patient) {
      return res.status(404).json({ error: 'Patient profile not found.' });
    }

    return res.status(200).json(formatPatient(patient));
  } catch (error) {
    console.error('Error fetching patient profile:', error);
    return res.status(500).json({ error: 'Failed to retrieve patient profile.' });
  }
};

/**
 * Register new patient profile
 */
export const createPatient = async (req, res) => {
  const data = req.body;

  if (!data.firstName || !data.lastName) {
    return res.status(400).json({ error: 'firstName and lastName are required.' });
  }

  const generatedId = `pat-${Date.now()}`;
  const generatedMrn = `${Math.floor(100000000 + Math.random() * 900000000)}`;
  
  // Extract address if provided nested or flat
  const nestedAddress = data.address || {};
  const street = nestedAddress.street || data.street || '';
  const suite = nestedAddress.suite || data.suite || '';
  const city = nestedAddress.city || data.city || '';
  const state = nestedAddress.state || data.state || '';
  const zipCode = nestedAddress.zipCode || data.zipCode || '';

  try {
    const newPatient = await prisma.patient.create({
      data: {
        id: generatedId,
        patientId: generatedMrn,
        firstName: data.firstName,
        middleName: data.middleName || '',
        lastName: data.lastName,
        dob: data.dob || '',
        sex: data.sex || 'M',
        phone: data.phone || '',
        email: data.email || '',
        ssn: data.ssn || '',
        primaryGroupNumber: data.primaryGroupNumber || '',
        street,
        suite,
        city,
        state,
        zipCode,
        location: data.location || '',
        maritalStatus: data.maritalStatus || '',
        relationshipToInsured: data.relationshipToInsured || '',
        employmentStatus: data.employmentStatus || '',
        policyHolderName: data.policyHolderName || '',
        policyHolderDob: data.policyHolderDob || '',
        secondaryInsuranceCompany: data.secondaryInsuranceCompany || '',
        secondaryPolicyNumber: data.secondaryPolicyNumber || '',
        communicationPref: data.communicationPref || 'SMS',
        consentStatus: data.consentStatus || 'SIGNED',
        maritalStatus: data.maritalStatus || 'SINGLE',
        driversLicense: data.driversLicense || '',
        driversLicenseState: data.driversLicenseState || 'TX',
        language: data.language || 'English',
        ethnicity: data.ethnicity || 'Non-Hispanic',
        employmentStatus: data.employmentStatus || '',
        employerName: data.employerName || '',
        emergencyContactName: data.emergencyContactName || '',
        emergencyContactRelation: data.emergencyContactRelation || '',
        emergencyContactPhone: data.emergencyContactPhone || '',
        insuranceType: data.insuranceType || '',
        primaryInsuranceCompany: data.primaryInsuranceCompany || '',
        primaryPolicyNumber: data.primaryPolicyNumber || '',
        primaryInsuranceMemberId: data.primaryInsuranceMemberId || '',
        policyHolderName: data.policyHolderName || '',
        policyHolderDob: data.policyHolderDob || '',
        insuranceAdjusterName: data.insuranceAdjusterName || '',
        insuranceAdjusterPhone: data.insuranceAdjusterPhone || '',
        secondaryInsuranceCompany: data.secondaryInsuranceCompany || '',
        secondaryPolicyNumber: data.secondaryPolicyNumber || '',
        assignedProviderIds: data.assignedProviderIds || [],
        knownAllergies: data.knownAllergies || '',
        allergyReactionSeverity: data.allergyReactionSeverity || '',
        currentMedications: data.currentMedications || '',
        pastMedicalHistory: data.pastMedicalHistory || '',
        selectedInjuryAreas: data.selectedInjuryAreas || [],
        accidentDate: data.accidentDate || '',
        mechanismOfInjury: data.mechanismOfInjury || '',
        patientNotes: data.patientNotes || '',
        hipaaConsentSigned: data.hipaaConsentSigned ?? true,
        status: 'ACTIVE',
        createdAt: new Date().toISOString().split('T')[0]
      }
    });

    // Create initial active Case for patient to store referring physician, NPI, and attorney info
    const generatedCaseId = `case-${Date.now()}`;
    const generatedCaseNum = `CASE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    await prisma.case.create({
      data: {
        id: generatedCaseId,
        caseId: generatedCaseNum,
        patientId: newPatient.id,
        accidentType: data.accidentType || 'AUTO_ACCIDENT',
        accidentState: state || 'TX',
        referringProviderName: data.referringProvider || data.referringProviderName || '',
        referringProviderNpi: data.referringProviderNpi || '',
        attorneyName: data.referringAttorney || data.attorneyName || '',
        lawFirm: data.lawFirm || (data.referringAttorney ? `${data.referringAttorney}` : ''),
        assignedProviderIds: data.assignedProviderIds || [],
        status: 'ACTIVE'
      }
    });

    const resPatient = {
      ...newPatient,
      referringProvider: data.referringProvider || data.referringProviderName || '',
      referringProviderNpi: data.referringProviderNpi || ''
    };

    return res.status(201).json(formatPatient(resPatient));
  } catch (error) {
    console.error('Error registering patient profile:', error);
    return res.status(500).json({ error: 'Failed to create patient profile.' });
  }
};

/**
 * Update patient profile settings
 */
export const updatePatient = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const existing = await prisma.patient.findFirst({
      where: {
        OR: [
          { id },
          { patientId: id }
        ]
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Patient profile not found.' });
    }

    const nestedAddress = updates.address || {};
    const street = nestedAddress.street || updates.street || existing.street;
    const suite = nestedAddress.suite || updates.suite || existing.suite;
    const city = nestedAddress.city || updates.city || existing.city;
    const state = nestedAddress.state || updates.state || existing.state;
    const zipCode = nestedAddress.zipCode || updates.zipCode || existing.zipCode;

    const updated = await prisma.patient.update({
      where: { id: existing.id },
      data: {
        firstName: updates.firstName || existing.firstName,
        middleName: updates.middleName !== undefined ? updates.middleName : existing.middleName,
        lastName: updates.lastName || existing.lastName,
        dob: updates.dob || existing.dob,
        sex: updates.sex || existing.sex,
        phone: updates.phone || existing.phone,
        email: updates.email || existing.email,
        ssn: updates.ssn || existing.ssn,
        primaryGroupNumber: updates.primaryGroupNumber !== undefined ? updates.primaryGroupNumber : existing.primaryGroupNumber,
        street,
        suite,
        city,
        state,
        zipCode,
        location: updates.location !== undefined ? updates.location : existing.location,
        maritalStatus: updates.maritalStatus !== undefined ? updates.maritalStatus : existing.maritalStatus,
        relationshipToInsured: updates.relationshipToInsured !== undefined ? updates.relationshipToInsured : existing.relationshipToInsured,
        employmentStatus: updates.employmentStatus !== undefined ? updates.employmentStatus : existing.employmentStatus,
        policyHolderName: updates.policyHolderName !== undefined ? updates.policyHolderName : existing.policyHolderName,
        policyHolderDob: updates.policyHolderDob !== undefined ? updates.policyHolderDob : existing.policyHolderDob,
        secondaryInsuranceCompany: updates.secondaryInsuranceCompany !== undefined ? updates.secondaryInsuranceCompany : existing.secondaryInsuranceCompany,
        secondaryPolicyNumber: updates.secondaryPolicyNumber !== undefined ? updates.secondaryPolicyNumber : existing.secondaryPolicyNumber,
        communicationPref: updates.communicationPref || existing.communicationPref,
        consentStatus: updates.consentStatus || existing.consentStatus,
        maritalStatus: updates.maritalStatus !== undefined ? updates.maritalStatus : existing.maritalStatus,
        driversLicense: updates.driversLicense !== undefined ? updates.driversLicense : existing.driversLicense,
        driversLicenseState: updates.driversLicenseState !== undefined ? updates.driversLicenseState : existing.driversLicenseState,
        language: updates.language !== undefined ? updates.language : existing.language,
        ethnicity: updates.ethnicity !== undefined ? updates.ethnicity : existing.ethnicity,
        employmentStatus: updates.employmentStatus !== undefined ? updates.employmentStatus : existing.employmentStatus,
        employerName: updates.employerName !== undefined ? updates.employerName : existing.employerName,
        emergencyContactName: updates.emergencyContactName !== undefined ? updates.emergencyContactName : existing.emergencyContactName,
        emergencyContactRelation: updates.emergencyContactRelation !== undefined ? updates.emergencyContactRelation : existing.emergencyContactRelation,
        emergencyContactPhone: updates.emergencyContactPhone !== undefined ? updates.emergencyContactPhone : existing.emergencyContactPhone,
        insuranceType: updates.insuranceType !== undefined ? updates.insuranceType : existing.insuranceType,
        primaryInsuranceCompany: updates.primaryInsuranceCompany !== undefined ? updates.primaryInsuranceCompany : existing.primaryInsuranceCompany,
        primaryPolicyNumber: updates.primaryPolicyNumber !== undefined ? updates.primaryPolicyNumber : existing.primaryPolicyNumber,
        primaryInsuranceMemberId: updates.primaryInsuranceMemberId !== undefined ? updates.primaryInsuranceMemberId : existing.primaryInsuranceMemberId,
        policyHolderName: updates.policyHolderName !== undefined ? updates.policyHolderName : existing.policyHolderName,
        policyHolderDob: updates.policyHolderDob !== undefined ? updates.policyHolderDob : existing.policyHolderDob,
        insuranceAdjusterName: updates.insuranceAdjusterName !== undefined ? updates.insuranceAdjusterName : existing.insuranceAdjusterName,
        insuranceAdjusterPhone: updates.insuranceAdjusterPhone !== undefined ? updates.insuranceAdjusterPhone : existing.insuranceAdjusterPhone,
        secondaryInsuranceCompany: updates.secondaryInsuranceCompany !== undefined ? updates.secondaryInsuranceCompany : existing.secondaryInsuranceCompany,
        secondaryPolicyNumber: updates.secondaryPolicyNumber !== undefined ? updates.secondaryPolicyNumber : existing.secondaryPolicyNumber,
        assignedProviderIds: updates.assignedProviderIds || existing.assignedProviderIds,
        knownAllergies: updates.knownAllergies !== undefined ? updates.knownAllergies : existing.knownAllergies,
        allergyReactionSeverity: updates.allergyReactionSeverity !== undefined ? updates.allergyReactionSeverity : existing.allergyReactionSeverity,
        currentMedications: updates.currentMedications !== undefined ? updates.currentMedications : existing.currentMedications,
        pastMedicalHistory: updates.pastMedicalHistory !== undefined ? updates.pastMedicalHistory : existing.pastMedicalHistory,
        selectedInjuryAreas: updates.selectedInjuryAreas !== undefined ? updates.selectedInjuryAreas : existing.selectedInjuryAreas,
        accidentDate: updates.accidentDate !== undefined ? updates.accidentDate : existing.accidentDate,
        mechanismOfInjury: updates.mechanismOfInjury !== undefined ? updates.mechanismOfInjury : existing.mechanismOfInjury,
        patientNotes: updates.patientNotes !== undefined ? updates.patientNotes : existing.patientNotes,
        hipaaConsentSigned: updates.hipaaConsentSigned !== undefined ? updates.hipaaConsentSigned : existing.hipaaConsentSigned,
        status: updates.status || existing.status
      }
    });

    if (updates.referringProvider !== undefined || updates.referringProviderName !== undefined || updates.referringProviderNpi !== undefined) {
      const refName = updates.referringProvider || updates.referringProviderName;
      const refNpi = updates.referringProviderNpi;
      await prisma.case.updateMany({
        where: { patientId: existing.id },
        data: {
          ...(refName !== undefined ? { referringProviderName: refName } : {}),
          ...(refNpi !== undefined ? { referringProviderNpi: refNpi } : {}),
          ...(updates.assignedProviderIds ? { assignedProviderIds: updates.assignedProviderIds } : {})
        }
      });
    } else if (updates.assignedProviderIds) {
      await prisma.case.updateMany({
        where: { patientId: existing.id },
        data: { assignedProviderIds: updates.assignedProviderIds }
      });
    }

    const updatedRes = {
      ...updated,
      referringProvider: updates.referringProvider || updates.referringProviderName || existing.referringProvider || '',
      referringProviderNpi: updates.referringProviderNpi || existing.referringProviderNpi || ''
    };

    return res.status(200).json(formatPatient(updatedRes));
  } catch (error) {
    console.error('Error updating patient profile:', error);
    return res.status(500).json({ error: 'Failed to update patient profile.' });
  }
};

/**
 * DELETE /api/patients/:id
 * Cascades deletion across cases, appointments, notes, and documents without foreign key conflicts
 */
export const deletePatient = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.patient.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Patient not found' });
    }

    await prisma.$transaction([
      prisma.clinicalNote.deleteMany({ where: { patientId: id } }),
      prisma.appointment.deleteMany({ where: { patientId: id } }),
      prisma.case.deleteMany({ where: { patientId: id } }),
      prisma.patient.delete({ where: { id } })
    ]);

    return res.status(200).json({ success: true, message: 'Patient and all associated records deleted cleanly.' });
  } catch (error) {
    console.error('Error deleting patient record:', error);
    return res.status(500).json({ error: 'Failed to delete patient record.' });
  }
};
