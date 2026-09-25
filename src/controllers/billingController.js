import { prisma } from '../config/db.js';

/**
 * Helper to calculate effective totals and aging for a bill statement,
 * falling back to itemized serviceLines if stored bill.totals is zero/uninitialized.
 */
const getEffectiveBillTotalsAndAging = (b) => {
  let sumCharges = 0;
  let sumPayments = 0;
  let sumAdjustments = 0;

  const lines = b.serviceLines || [];
  lines.forEach(l => {
    sumCharges += (Number(l.charge) || 0);
    const insPay = Number(l.insurancePayment) || 0;
    const patPay = Number(l.patientPayment) || 0;
    const othPay = Number(l.otherPayment) || 0;
    sumPayments += (insPay + patPay + othPay);
    sumAdjustments += (Number(l.adjustments) || 0);
  });
  const sumBalance = Math.max(0, sumCharges - (sumPayments + sumAdjustments));

  let totals = typeof b.totals === 'string' ? JSON.parse(b.totals) : b.totals;
  if (!totals || (totals.totalCharges === 0 && sumCharges > 0)) {
    totals = {
      totalCharges: Number(sumCharges.toFixed(2)),
      totalPayments: Number(sumPayments.toFixed(2)),
      totalAdjustments: Number(sumAdjustments.toFixed(2)),
      balanceDue: Number(sumBalance.toFixed(2))
    };
  }

  let aging = typeof b.aging === 'string' ? JSON.parse(b.aging) : b.aging;
  const agingSum = (aging?.current || 0) + (aging?.past30 || 0) + (aging?.past60 || 0) + (aging?.past90 || 0);
  if (!aging || (agingSum === 0 && totals?.balanceDue > 0)) {
    aging = {
      current: totals.balanceDue,
      past30: 0,
      past60: 0,
      past90: 0
    };
  }

  return { totals: totals || { totalCharges: 0, totalPayments: 0, totalAdjustments: 0, balanceDue: 0 }, aging: aging || { current: 0, past30: 0, past60: 0, past90: 0 } };
};

/**
 * Format a DB Bill and its ServiceLines to match frontend expectations
 */
const formatBill = (b) => {
  if (!b) return null;

  // Parse provider JSON fields safely
  const provAddr = typeof b.provider?.address === 'string' ? JSON.parse(b.provider.address) : b.provider?.address || {};
  const provContact = typeof b.provider?.contact === 'string' ? JSON.parse(b.provider.contact) : b.provider?.contact || {};
  const provIdentifiers = typeof b.provider?.identifiers === 'string' ? JSON.parse(b.provider.identifiers) : b.provider?.identifiers || {};
  const provRendering = typeof b.provider?.renderingProvider === 'string' ? JSON.parse(b.provider.renderingProvider) : b.provider?.renderingProvider || {};
  const provServiceFacility = typeof b.provider?.serviceFacility === 'string' ? JSON.parse(b.provider.serviceFacility) : b.provider?.serviceFacility || {};
  const provBillingProvider = typeof b.provider?.billingProvider === 'string' ? JSON.parse(b.provider.billingProvider) : b.provider?.billingProvider || {};

  const formattedLines = (b.serviceLines || []).map(l => {
    // Reconstruct payments object for frontend compatibility
    const insPay = Number(l.insurancePayment) || 0;
    const patPay = Number(l.patientPayment) || 0;
    const othPay = Number(l.otherPayment) || 0;

    return {
      dos: l.dos || l.dateOfService || '',
      dateOfService: l.dateOfService || l.dos || '',
      cptCode: l.cptCode,
      description: l.description || '',
      modifier1: l.modifier1 || '',
      modifier2: l.modifier2 || '',
      modifier3: l.modifier3 || '',
      modifier4: l.modifier4 || '',
      diagPointer: l.diagPointer || l.diagnosisPointer || '',
      placeOfService: l.placeOfService || '11',
      units: l.units || 1,
      charge: Number(l.charge),
      payments: {
        insurance: insPay,
        patient: patPay,
        other: othPay
      },
      adjustments: Number(l.adjustments) || 0,
      balance: Number(l.balance),
      lineBalance: Number(l.lineBalance)
    };
  });

  const pt = b.case?.patient;
  const ptAddress = typeof pt?.address === 'string'
    ? (() => { try { return JSON.parse(pt.address); } catch (e) { return {}; } })()
    : (pt?.address || {});

  const ptStreet = pt?.street || ptAddress.street || pt?.addressLine1 || '';
  const ptCity = pt?.city || ptAddress.city || '';
  const ptState = pt?.state || ptAddress.state || '';
  const ptZip = pt?.zipCode || ptAddress.zipCode || '';
  const ptPhone = pt?.phone || ptAddress.phone || pt?.mobile || '';

  const patientFullName = pt ? `${pt.firstName || ''} ${pt.lastName || ''}`.trim() : (b.patientName || '');
  const ptAddr = pt ? `${ptStreet}, ${ptCity} ${ptState} ${ptZip}`.replace(/^, |, $/g, '').trim() : (b.patientAddress || '');

  let dxCodes = [];
  if (b.case?.diagnosisCodes) {
    dxCodes = typeof b.case.diagnosisCodes === 'string'
      ? JSON.parse(b.case.diagnosisCodes)
      : b.case.diagnosisCodes;
  } else if (b.diagnosisCodes) {
    dxCodes = typeof b.diagnosisCodes === 'string'
      ? b.diagnosisCodes.split(/[,;\n]+/).map(d => d.trim()).filter(Boolean)
      : b.diagnosisCodes;
  }

  const { totals: parsedTotals, aging: parsedAging } = getEffectiveBillTotalsAndAging(b);

  return {
    id: b.id,
    caseId: b.caseId,
    providerId: b.providerId,
    providerName: b.provider?.name || '',
    providerBusinessName: b.provider?.businessName || '',
    providerAddress: b.provider?.address ? `${provAddr.street || ''}, ${provAddr.city || ''}` : '',
    providerPhone: provContact.phone || '',
    serviceCategory: b.provider?.serviceCategory || '',
    // CMS-1500: Individual patient name parts for proper LASTNAME, FIRSTNAME MI formatting
    patientFirstName: pt?.firstName || '',
    patientLastName: pt?.lastName || '',
    patientMiddleName: pt?.middleName || '',
    patientId: pt?.id || b.case?.patientId || b.patientId || '',
    patientName: patientFullName,
    patientAddress: ptAddr,
    // CMS-1500: Individual patient address components
    patientStreet: ptStreet || b.patientStreet || '',
    patientCity: ptCity || b.patientCity || '',
    patientState: ptState || b.patientState || '',
    patientZip: ptZip || b.patientZip || '',
    patientPhone: ptPhone || b.patientPhone || '',
    patientDob: pt?.dob || '',
    patientSex: pt?.sex || '',
    patientSystemId: pt?.patientId || '',
    primaryGroupNumber: pt?.primaryGroupNumber || '',
    relationshipToInsured: pt?.relationshipToInsured || '',
    maritalStatus: pt?.maritalStatus || '',
    employmentStatus: pt?.employmentStatus || '',
    accidentType: b.case?.accidentType || '',
    patient: pt,
    case: b.case,
    statementNumber: b.statementNumber || '',
    statementDate: b.statementDate || '',
    billToName: b.billToName || (b.case?.attorneyName ? `${b.case.attorneyName}` : ''),
    billToAddress: b.billToAddress || b.case?.lawFirmAddress || '',
    diagnosisCodes: dxCodes,
    // CMS-1500: Referring provider from Case or Patient (no billing provider fallbacks)
    referringProviderName: b.referringProviderName || b.case?.referringProviderName || pt?.referringProvider || pt?.referringProviderName || '',
    referringProviderNpi: b.referringProviderNpi || b.case?.referringProviderNpi || pt?.referringProviderNpi || '',
    // CMS-1500: Provider identifiers
    providerNpi: provIdentifiers.npi || '',
    providerTaxId: provIdentifiers.taxId || '',
    providerSsnOrEin: provIdentifiers.ssnOrEin || 'EIN',
    // CMS-1500: Provider facility and billing data (structured)
    renderingProvider: provRendering,
    serviceFacility: provServiceFacility,
    billingProvider: provBillingProvider,
    identifiers: provIdentifiers,
    // CMS-1500: Provider address components
    providerStreet: provAddr.street || '',
    providerSuite: provAddr.suite || '',
    providerCity: provAddr.city || '',
    providerState: provAddr.state || '',
    providerZip: provAddr.zipCode || '',
    // CMS-1500: Case details for accident/illness dates and insurance info
    accidentDate: b.case?.accidentDate || '',
    accidentState: b.case?.accidentState || '',
    insuranceCompany: b.case?.insuranceCompany || '',
    insurancePolicyNumber: b.case?.insurancePolicyNumber || '',
    attorneyName: b.case?.attorneyName || '',
    attorneyAddress: b.case?.attorneyAddress || b.case?.lawFirmAddress || '',
    status: b.status,
    lineItems: formattedLines,
    totals: parsedTotals,
    totalPayments: parsedTotals.totalPayments || 0,
    balanceDue: parsedTotals.balanceDue || 0,
    aging: parsedAging,
    cmsSignatures: b.cmsSignatures,
    createdAt: b.createdAt
  };
};

/**
 * Re-calculate Bill totals based on its itemized lines
 */
const recalculateBillTotals = async (billId) => {
  const lines = await prisma.serviceLine.findMany({
    where: { billId }
  });

  let totalCharges = 0;
  let totalPayments = 0;
  let totalAdjustments = 0;

  for (const l of lines) {
    const charge = Number(l.charge) || 0;
    const insPay = Number(l.insurancePayment) || 0;
    const patPay = Number(l.patientPayment) || 0;
    const othPay = Number(l.otherPayment) || 0;
    const adj = Number(l.adjustments) || 0;

    totalCharges += charge;
    totalPayments += (insPay + patPay + othPay);
    totalAdjustments += adj;
  }

  const balanceDue = Math.max(0, totalCharges - (totalPayments + totalAdjustments));

  const totals = {
    totalCharges: Number(totalCharges.toFixed(2)),
    totalPayments: Number(totalPayments.toFixed(2)),
    totalAdjustments: Number(totalAdjustments.toFixed(2)),
    balanceDue: Number(balanceDue.toFixed(2))
  };

  // Keep aging in sync with balance
  const aging = {
    current: Number(balanceDue.toFixed(2)),
    past30: 0,
    past60: 0,
    past90: 0
  };

  await prisma.bill.update({
    where: { id: billId },
    data: {
      totals,
      aging
    }
  });
};

/**
 * Default procedure template generator per provider
 */
const getDefaultServiceLinesForProvider = (providerId, accidentDateStr) => {
  const dos = accidentDateStr || new Date().toISOString().split('T')[0];

  switch (providerId) {
    case 'prov-josmic':
      return [
        {
          cptCode: '99204',
          description: 'Comprehensive Initial Pain Management Evaluation & Medical Decision Making',
          modifier1: '25',
          modifier2: '',
          units: 1,
          charge: 1214.00,
          dos
        },
        {
          cptCode: '97039',
          description: 'High-Frequency Radiofrequency & Deep Tissue Joint Modality (TECAR)',
          modifier1: '59',
          modifier2: '',
          units: 1,
          charge: 2000.00,
          dos
        }
      ];

    case 'prov-davs':
      return [
        {
          cptCode: '0101T',
          description: 'Extracorporeal Shockwave Therapy (ESWT) Musculoskeletal Tissue Regeneration (8 Sessions)',
          modifier1: 'GP',
          modifier2: '',
          units: 8,
          charge: 8000.00,
          dos
        }
      ];

    case 'prov-anik':
      return [
        {
          cptCode: '97039',
          description: 'Class IV High-Intensity Laser Therapy (HILT) Biostimulation (6 Sessions)',
          modifier1: 'GP',
          modifier2: 'RT',
          units: 6,
          charge: 12000.00,
          dos
        },
        {
          cptCode: '97124',
          description: 'Therapeutic Deep Tissue Laser Mobilization & Spinal Decompression Supplies',
          modifier1: '59',
          modifier2: '',
          units: 1,
          charge: 2606.00,
          dos
        }
      ];

    case 'prov-counselor':
      return [
        {
          cptCode: '90791',
          description: 'Psychiatric Diagnostic Evaluation & Motor Vehicle Accident Trauma Assessment',
          modifier1: '',
          modifier2: '',
          units: 1,
          charge: 350.00,
          dos
        },
        {
          cptCode: '90834',
          description: 'Individual Psychotherapy 45 min for Vehicular Phobia & Accident-Related PTSD (4 Sessions)',
          modifier1: '',
          modifier2: '',
          units: 4,
          charge: 790.00,
          dos
        }
      ];

    case 'prov-tpi':
      return [
        {
          cptCode: '20552',
          description: 'Trigger Point Injection - 1 or 2 Muscle Groups (Spinal & Cervical Paravertebral)',
          modifier1: '59',
          modifier2: '',
          units: 1,
          charge: 450.00,
          dos
        }
      ];

    case 'prov-tecar':
      return [
        {
          cptCode: '97039',
          description: 'Targeted Radiofrequency TECAR Therapy Session & Deep Thermal Bio-Modulation',
          modifier1: 'GP',
          modifier2: '',
          units: 1,
          charge: 1500.00,
          dos
        }
      ];

    default:
      return [
        {
          cptCode: '99204',
          description: 'Initial Evaluation & Management',
          modifier1: '25',
          modifier2: '',
          units: 1,
          charge: 1214.00,
          dos
        }
      ];
  }
};

/**
 * Get bills statement for a case
 */
export const getFourBillsByCase = async (req, res) => {
  const { caseId } = req.query;

  try {
    const targetCase = await prisma.case.findFirst({
      where: {
        OR: [
          { id: caseId || 'case-001' },
          { caseId: caseId || 'CASE-2025-1227' }
        ]
      },
      include: {
        patient: true
      }
    });

    if (!targetCase) {
      return res.status(200).json({
        caseId: caseId || 'case-001',
        allBills: []
      });
    }

    const bills = await prisma.bill.findMany({
      where: {
        caseId: targetCase.id
      },
      include: {
        serviceLines: true,
        provider: true,
        case: {
          include: {
            patient: true
          }
        }
      }
    });

    return res.status(200).json({
      caseId: targetCase.caseId || targetCase.id,
      allBills: bills.map(formatBill)
    });
  } catch (error) {
    console.error('Error fetching case bills:', error);
    return res.status(500).json({ error: 'Internal server error fetching bills.' });
  }
};

/**
 * Single High-Performance Endpoint to fetch all CMS-1500 claims directly from Database
 */
export const getAllCmsClaims = async (req, res) => {
  try {
    const bills = await prisma.bill.findMany({
      include: {
        serviceLines: true,
        provider: true,
        case: {
          include: {
            patient: true
          }
        }
      }
    });

    return res.status(200).json({
      success: true,
      bills: bills.map(formatBill)
    });
  } catch (error) {
    console.error('Error fetching all CMS claims:', error);
    return res.status(500).json({ error: 'Internal server error fetching CMS claims.' });
  }
};

/**
 * Get single bill details by ID
 */
export const getBillById = async (req, res) => {
  const { id } = req.params;

  try {
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: {
        serviceLines: true,
        provider: true,
        case: {
          include: {
            patient: true
          }
        }
      }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Billing statement not found.' });
    }

    return res.status(200).json(formatBill(bill));
  } catch (error) {
    console.error('Error fetching bill details:', error);
    return res.status(500).json({ error: 'Failed to retrieve bill.' });
  }
};

/**
 * Create/Generate a new billing statement
 */
export const createBill = async (req, res) => {
  const data = req.body;

  if (!data.caseId || !data.providerId) {
    return res.status(400).json({ error: 'caseId and providerId are required.' });
  }

  const providerKey = data.providerId.replace('prov-', '');
  const generatedId = data.id || `bill-${providerKey}-${data.caseId}`;

  const statementNum = `${Math.floor(100000 + Math.random() * 900000)}`;
  const statementDate = new Date().toLocaleDateString('en-US');

  try {
    if (data.diagnosisCodes && data.caseId) {
      const dxList = typeof data.diagnosisCodes === 'string'
        ? data.diagnosisCodes.split(/[,;\n]+/).map(d => d.trim()).filter(Boolean)
        : data.diagnosisCodes;
      await prisma.case.update({
        where: { id: data.caseId },
        data: { diagnosisCodes: dxList }
      }).catch(() => { });
    }

    // Check if the bill already exists to prevent duplicate insertion error
    const existing = await prisma.bill.findUnique({
      where: { id: generatedId },
      include: {
        serviceLines: true,
        provider: true,
        case: {
          include: {
            patient: true
          }
        }
      }
    });

    if (existing) {
      if (data.diagnosisCodes && existing.case) {
        existing.case.diagnosisCodes = typeof data.diagnosisCodes === 'string'
          ? data.diagnosisCodes.split(/[,;\n]+/).map(d => d.trim()).filter(Boolean)
          : data.diagnosisCodes;
      }
      return res.status(200).json(formatBill(existing));
    }

    const newBill = await prisma.bill.create({
      data: {
        id: generatedId,
        caseId: data.caseId,
        providerId: data.providerId,
        invoiceNumber: `INV-${Date.now()}`,
        statementNumber: statementNum,
        statementDate,
        billToName: data.billToName || 'OJ LAW FIRM & ASSOCIATES',
        billToAddress: data.billToAddress || '11711 Bedford St. Suite 01, Houston TX 77031',
        status: 'ISSUED',
        totals: { totalCharges: 0, totalPayments: 0, totalAdjustments: 0, balanceDue: 0 },
        aging: { current: 0, past30: 0, past60: 0, past90: 0 }
      },
      include: {
        serviceLines: true,
        provider: true,
        case: {
          include: {
            patient: true
          }
        }
      }
    });

    return res.status(201).json(formatBill(newBill));
  } catch (error) {
    console.error('Error creating bill statement:', error);
    return res.status(500).json({ error: 'Failed to generate bill statement.' });
  }
};

/**
 * Add a service line to a billing statement
 */
export const addServiceLine = async (req, res) => {
  const { id } = req.params;
  const line = req.body;

  try {
    const existing = await prisma.bill.findUnique({
      where: { id }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Bill statement not found.' });
    }

    // Support single serviceLine additions or a list of lines (e.g. from CreateBillPage.jsx form submit)
    const linesToAdd = line.serviceLines ? line.serviceLines : [line];

    for (const item of linesToAdd) {
      const lineId = `srv-l-${Date.now()}-${Math.floor(Math.random() * 100)}`;
      const chargeAmount = parseFloat(item.charge) || 180.00;

      await prisma.serviceLine.create({
        data: {
          id: lineId,
          billId: id,
          dos: item.dos || new Date().toLocaleDateString('en-US'),
          dateOfService: item.dos || new Date().toLocaleDateString('en-US'),
          placeOfService: item.placeOfService || '11',
          cptCode: item.cptCode || '99204',
          description: item.description || 'Medical Consultation',
          modifier1: item.modifier1 || item.mod1 || '',
          modifier2: item.modifier2 || item.mod2 || '',
          modifier3: item.modifier3 || item.mod3 || '',
          modifier4: item.modifier4 || item.mod4 || '',
          diagPointer: item.diagPointer || item.diagnosisPointer || '',
          diagnosisPointer: item.diagnosisPointer || item.diagPointer || '',
          units: parseInt(item.units) || 1,
          charge: chargeAmount,
          balance: chargeAmount,
          lineBalance: chargeAmount,
          insurancePayment: 0.00,
          patientPayment: 0.00,
          otherPayment: 0.00,
          adjustments: 0.00
        }
      });
    }

    // Re-calculate parent totals
    await recalculateBillTotals(id);

    const updated = await prisma.bill.findUnique({
      where: { id },
      include: {
        serviceLines: true,
        provider: true,
        case: { include: { patient: true } }
      }
    });

    return res.status(200).json(formatBill(updated));
  } catch (error) {
    console.error('Error adding service line:', error);
    return res.status(500).json({ error: 'Failed to append service line charge.' });
  }
};

/**
 * Post payment to a specific itemized CPT line
 */
export const postPayment = async (req, res) => {
  const { id } = req.params;
  const { lineIndex, amount, payerType, type, method, source, referenceNumber, checkRef } = req.body;

  const actualPayerType = payerType || type || 'INSURANCE';
  const actualMethod = method || source || 'EFT';
  const actualRef = referenceNumber || checkRef || '';

  try {
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { serviceLines: true }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    const pmtAmount = parseFloat(amount);
    if (isNaN(pmtAmount) || pmtAmount <= 0) {
      return res.status(400).json({ error: 'Invalid payment amount.' });
    }

    const lines = bill.serviceLines || [];
    let currentBillBalanceDue = 0;
    if (lines.length > 0) {
      let totalCharges = 0;
      let totalPayments = 0;
      let totalAdjustments = 0;
      for (const l of lines) {
        totalCharges += (Number(l.charge) || 0);
        totalPayments += ((Number(l.insurancePayment) || 0) + (Number(l.patientPayment) || 0) + (Number(l.otherPayment) || 0));
        totalAdjustments += (Number(l.adjustments) || 0);
      }
      currentBillBalanceDue = Math.max(0, totalCharges - (totalPayments + totalAdjustments));
    } else if (bill.totals) {
      let parsedTotals = {};
      if (typeof bill.totals === 'string') {
        try { parsedTotals = JSON.parse(bill.totals); } catch (e) {}
      } else if (typeof bill.totals === 'object') {
        parsedTotals = bill.totals;
      }
      currentBillBalanceDue = Number(parsedTotals.balanceDue) || 0;
    }

    if (Math.round(pmtAmount * 100) > Math.round(currentBillBalanceDue * 100)) {
      return res.status(400).json({
        error: `Payment amount ($${pmtAmount.toFixed(2)}) cannot exceed current bill balance due ($${currentBillBalanceDue.toFixed(2)}).`
      });
    }

    let targetLine = (lineIndex !== undefined && lines[lineIndex])
      ? lines[lineIndex]
      : lines.find(l => Number(l.lineBalance) > 0) || lines[0];

    if (!targetLine) {
      const lineId = `srv-l-${Date.now()}`;
      targetLine = await prisma.serviceLine.create({
        data: {
          id: lineId,
          billId: id,
          dos: new Date().toLocaleDateString('en-US'),
          dateOfService: new Date().toLocaleDateString('en-US'),
          cptCode: '99204',
          description: 'Payment Account Allocation',
          charge: parseFloat(amount) || 0,
          balance: 0,
          lineBalance: 0,
          insurancePayment: actualPayerType === 'INSURANCE' ? (parseFloat(amount) || 0) : 0,
          patientPayment: actualPayerType === 'PATIENT' ? (parseFloat(amount) || 0) : 0,
          otherPayment: (actualPayerType !== 'INSURANCE' && actualPayerType !== 'PATIENT') ? (parseFloat(amount) || 0) : 0
        }
      });
    } else {
      let insurancePayment = Number(targetLine.insurancePayment) || 0;
      let patientPayment = Number(targetLine.patientPayment) || 0;
      let otherPayment = Number(targetLine.otherPayment) || 0;

      if (actualPayerType === 'INSURANCE') {
        insurancePayment += parseFloat(amount);
      } else if (actualPayerType === 'PATIENT') {
        patientPayment += parseFloat(amount);
      } else {
        otherPayment += parseFloat(amount);
      }

      const totalLinePay = insurancePayment + patientPayment + otherPayment;
      const adjustments = Number(targetLine.adjustments) || 0;
      const lineBalance = Math.max(0, Number(targetLine.charge) - (totalLinePay + adjustments));

      await prisma.serviceLine.update({
        where: { id: targetLine.id },
        data: {
          insurancePayment,
          patientPayment,
          otherPayment,
          balance: lineBalance,
          lineBalance
        }
      });
    }

    // Create Transaction Record
    await prisma.transaction.create({
      data: {
        id: `tx-${Date.now()}`,
        billId: id,
        transactionType: 'PAYMENT',
        source: actualMethod,
        amount: parseFloat(amount),
        referenceNumber: actualRef,
        notes: `Payer: ${actualPayerType}. Ref: ${actualRef || 'N/A'}`
      }
    });

    await recalculateBillTotals(id);

    const updated = await prisma.bill.findUnique({
      where: { id },
      include: {
        serviceLines: true,
        provider: true,
        case: { include: { patient: true } }
      }
    });

    return res.status(200).json(formatBill(updated));
  } catch (error) {
    console.error('Error posting payment:', error);
    return res.status(500).json({ error: 'Failed to post transaction payment.' });
  }
};

/**
 * Post adjustment write-off
 */
export const postAdjustment = async (req, res) => {
  const { id } = req.params;
  const { lineIndex, amount, reason } = req.body;

  const adjAmount = parseFloat(amount);
  if (isNaN(adjAmount) || adjAmount <= 0) {
    return res.status(400).json({ error: 'Please enter a valid adjustment amount.' });
  }

  try {
    const bill = await prisma.bill.findUnique({
      where: { id },
      include: { serviceLines: true }
    });

    if (!bill) {
      return res.status(404).json({ error: 'Bill not found.' });
    }

    // Check bill overall remaining balance
    const parsedTotals = typeof bill.totals === 'string' ? JSON.parse(bill.totals) : (bill.totals || {});
    const billBalanceDue = parsedTotals.balanceDue !== undefined ? Number(parsedTotals.balanceDue) : 0;

    if (billBalanceDue <= 0) {
      return res.status(400).json({ error: 'Bill is already fully settled ($0 balance). No further adjustments can be posted.' });
    }

    const lines = bill.serviceLines || [];
    let targetLine = (lineIndex !== undefined && lines[lineIndex])
      ? lines[lineIndex]
      : lines.find(l => Number(l.lineBalance) > 0) || lines[0];

    if (!targetLine) {
      return res.status(400).json({ error: 'No active service lines available for adjustment.' });
    }

    const insurancePayment = Number(targetLine.insurancePayment) || 0;
    const patientPayment = Number(targetLine.patientPayment) || 0;
    const otherPayment = Number(targetLine.otherPayment) || 0;
    const currentLineAdj = Number(targetLine.adjustments) || 0;
    const totalLinePay = insurancePayment + patientPayment + otherPayment;
    const lineCharge = Number(targetLine.charge) || 0;

    // Remaining balance on the target line
    const maxLineAdjAllowed = Math.max(0, lineCharge - (totalLinePay + currentLineAdj));

    // Effective maximum allowed adjustment (cannot exceed remaining bill balance OR remaining line balance)
    const maxAllowed = Math.min(billBalanceDue, maxLineAdjAllowed);

    if (maxAllowed <= 0) {
      return res.status(400).json({ error: 'Target service line has a $0 balance. No further adjustments can be applied.' });
    }

    if (adjAmount > maxAllowed) {
      return res.status(400).json({
        error: `Adjustment amount ($${adjAmount.toFixed(2)}) exceeds maximum allowable remaining balance ($${maxAllowed.toFixed(2)}).`
      });
    }

    const adjustments = currentLineAdj + adjAmount;
    const lineBalance = Math.max(0, lineCharge - (totalLinePay + adjustments));

    await prisma.serviceLine.update({
      where: { id: targetLine.id },
      data: {
        adjustments,
        balance: lineBalance,
        lineBalance
      }
    });

    // Create Transaction Record
    await prisma.transaction.create({
      data: {
        id: `tx-${Date.now()}`,
        billId: id,
        transactionType: 'ADJUSTMENT',
        source: 'WRITE_OFF',
        amount: adjAmount,
        notes: reason || 'Adjustment write off'
      }
    });

    await recalculateBillTotals(id);

    const updated = await prisma.bill.findUnique({
      where: { id },
      include: {
        serviceLines: true,
        provider: true,
        case: { include: { patient: true } }
      }
    });

    return res.status(200).json(formatBill(updated));
  } catch (error) {
    console.error('Error posting adjustment:', error);
    return res.status(500).json({ error: 'Failed to post transaction adjustment.' });
  }
};

/**
 * Finalise bill
 */
export const finaliseBill = async (req, res) => {
  const { id } = req.params;

  try {
    const updated = await prisma.bill.update({
      where: { id },
      data: {
        status: 'FINALISED_DEMO'
      },
      include: {
        serviceLines: true,
        provider: true,
        case: { include: { patient: true } }
      }
    });

    return res.status(200).json(formatBill(updated));
  } catch (error) {
    console.error('Error finalising bill:', error);
    return res.status(500).json({ error: 'Failed to finalise billing statement.' });
  }
};

/**
 * Get aging summary metrics grouped by provider
 */
export const getAgingSummary = async (req, res) => {
  const { providerId } = req.query;

  try {
    const where = {};
    if (providerId && providerId !== 'ALL') {
      where.providerId = providerId;
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        provider: true,
        serviceLines: true,
        case: {
          include: { patient: true }
        }
      }
    });

    const cases = await prisma.case.findMany({
      include: {
        patient: true,
        bills: {
          include: { serviceLines: true }
        }
      }
    });

    let grandTotal = 0;
    let current = 0;
    let past30 = 0;
    let past60 = 0;
    let past90 = 0;

    const providerMap = {};

    for (const b of bills) {
      const { totals, aging } = getEffectiveBillTotalsAndAging(b);

      const bal = Number(totals.balanceDue || 0);
      const c = Number(aging.current || 0);
      const p30 = Number(aging.past30 || 0);
      const p60 = Number(aging.past60 || 0);
      const p90 = Number(aging.past90 || 0);

      grandTotal += bal;
      current += c;
      past30 += p30;
      past60 += p60;
      past90 += p90;

      if (!providerMap[b.providerId]) {
        providerMap[b.providerId] = {
          provider: b.provider?.name || b.providerId,
          category: b.provider?.serviceCategory || 'Medical Services',
          statement: b.statementNumber || 'N/A',
          current: 0,
          past30: 0,
          past60: 0,
          past90: 0,
          total: 0,
          status: b.status === 'ISSUED' ? 'Issued' : 'Finalised',
          risk: 'low'
        };
      }

      providerMap[b.providerId].current += c;
      providerMap[b.providerId].past30 += p30;
      providerMap[b.providerId].past60 += p60;
      providerMap[b.providerId].past90 += p90;
      providerMap[b.providerId].total += bal;
      if (b.statementNumber) providerMap[b.providerId].statement = b.statementNumber;

      if (providerMap[b.providerId].past90 > 0 || providerMap[b.providerId].past60 > 0) {
        providerMap[b.providerId].risk = 'high';
      }
    }

    const patientAgingLedger = cases.map(c => {
      let caseBal = 0;
      let caseCurrent = 0;
      let casePast30 = 0;
      let casePast60 = 0;
      let casePast90 = 0;

      (c.bills || []).forEach(b => {
        const { totals, aging } = getEffectiveBillTotalsAndAging(b);
        caseBal += Number(totals.balanceDue || 0);
        caseCurrent += Number(aging.current || 0);
        casePast30 += Number(aging.past30 || 0);
        casePast60 += Number(aging.past60 || 0);
        casePast90 += Number(aging.past90 || 0);
      });

      return {
        patientId: c.patient?.patientId || c.patientId || 'PAT-100',
        name: c.patient ? `${c.patient.firstName} ${c.patient.lastName}`.trim() : (c.patientName || 'SAMPLE TESTING'),
        caseId: c.caseId,
        attorney: c.lawFirm || c.attorneyName || 'Self-Represented / Direct Billing',
        insurance: c.insuranceCompany || 'Auto Insurance Carrier',
        current: Number(caseCurrent.toFixed(2)),
        past30: Number(casePast30.toFixed(2)),
        past60: Number(casePast60.toFixed(2)),
        past90: Number(casePast90.toFixed(2)),
        total: Number(caseBal.toFixed(2))
      };
    });

    return res.status(200).json({
      grandTotal: Number(grandTotal.toFixed(2)),
      current: Number(current.toFixed(2)),
      past30: Number(past30.toFixed(2)),
      past60: Number(past60.toFixed(2)),
      past90: Number(past90.toFixed(2)),
      providerAgingBreakdown: Object.values(providerMap),
      patientAgingLedger
    });
  } catch (error) {
    console.error('Error fetching aging summary:', error);
    return res.status(500).json({ error: 'Failed to calculate aging statistics summary.' });
  }
};

/**
 * GET /v1/billing/overview-stats
 * Comprehensive financial summary across all practice provider ledgers
 */
export const getOverviewStats = async (req, res) => {
  try {
    const bills = await prisma.bill.findMany({
      include: {
        provider: true,
        serviceLines: true
      }
    });

    const allProviders = await prisma.provider.findMany();

    let totalBilled = 0;
    let totalPayments = 0;
    let totalAdjustments = 0;
    let balanceDue = 0;

    const providerMap = {};
    const colors = ['teal', 'blue', 'violet', 'amber', 'emerald', 'rose', 'indigo', 'cyan'];
    
    allProviders.forEach((p, idx) => {
      providerMap[p.id] = {
        name: p.name || 'Unknown',
        specialty: p.serviceCategory || 'Practice Provider',
        total: 0,
        paid: 0,
        balance: 0,
        status: 'Issued',
        color: colors[idx % colors.length]
      };
    });

    let current = 0;
    let past30 = 0;
    let past60 = 0;
    let past90 = 0;

    for (const b of bills) {
      const { totals, aging } = getEffectiveBillTotalsAndAging(b);

      const chg = Number(totals.totalCharges || 0);
      const pmt = Number(totals.totalPayments || 0);
      const adj = Number(totals.totalAdjustments || 0);
      
      // Outstanding Balance = Total Billed - (Amount Collected + Adjustments)
      const bal = Math.max(0, chg - (pmt + adj));

      totalBilled += chg;
      totalPayments += pmt;
      totalAdjustments += adj;
      balanceDue += bal;

      current += Number(aging.current || 0);
      past30 += Number(aging.past30 || 0);
      past60 += Number(aging.past60 || 0);
      past90 += Number(aging.past90 || 0);

      if (!providerMap[b.providerId]) {
        providerMap[b.providerId] = {
          name: b.provider?.name || 'Unknown',
          specialty: b.provider?.serviceCategory || 'Practice Provider',
          total: 0,
          paid: 0,
          balance: 0,
          status: 'Issued',
          color: 'slate'
        };
      }
      
      providerMap[b.providerId].total += chg;
      providerMap[b.providerId].paid += pmt;
      providerMap[b.providerId].balance += bal;
      if (b.status === 'FINALISED_DEMO' || b.status === 'Finalised') {
        providerMap[b.providerId].status = 'Finalised';
      }
    }

    return res.status(200).json({
      kpis: {
        totalBilled: Number(totalBilled.toFixed(2)),
        amountCollected: Number(totalPayments.toFixed(2)),
        totalAdjustments: Number(totalAdjustments.toFixed(2)),
        outstandingBalance: Number(balanceDue.toFixed(2)),
        past90Overdue: Number(past90.toFixed(2))
      },
      agingBuckets: {
        current: Number(current.toFixed(2)),
        past30: Number(past30.toFixed(2)),
        past60: Number(past60.toFixed(2)),
        past90: Number(past90.toFixed(2)),
        grandTotal: Number(balanceDue.toFixed(2))
      },
      providers: Object.values(providerMap)
    });
  } catch (error) {
    console.error('Error fetching overview stats:', error);
    return res.status(500).json({ error: 'Failed to calculate billing overview metrics.' });
  }
};

/**
 * GET /v1/billing/transactions
 * Retrieve all payment transactions & adjustment write-offs
 */
export const getPaymentsList = async (req, res) => {
  try {
    const transactions = await prisma.transaction.findMany({
      include: {
        bill: {
          include: {
            provider: true,
            case: { include: { patient: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const formatPayerType = (t) => {
      if (t.transactionType !== 'PAYMENT') {
        return 'Contractual Write-off / Adjustment';
      }
      const notes = t.notes || '';
      if (notes.includes('Payer: INSURANCE')) return 'Insurance Payment';
      if (notes.includes('Payer: PATIENT')) return 'Patient Payment';
      if (notes.includes('Payer: ATTORNEY')) return 'Attorney Settlement';
      if (notes.includes('Payer: WORKERS_COMP')) return "Workers' Comp";
      return 'Insurance / Patient Payment';
    };

    const formatted = transactions.map(t => ({
      id: t.id,
      date: t.createdAt.toISOString().split('T')[0],
      provider: t.bill?.provider?.name || 'JOSMIC Wellness Center',
      patient: t.bill?.case?.patient ? `${t.bill.case.patient.firstName} ${t.bill.case.patient.lastName}`.trim() : 'SAMPLE TESTING',
      type: formatPayerType(t),
      amount: Number(t.amount),
      method: t.source || 'EFT',
      status: 'Posted',
      ref: t.referenceNumber || t.notes || 'REF-N/A'
    }));

    return res.status(200).json(formatted);
  } catch (error) {
    console.error('Error fetching transactions list:', error);
    return res.status(500).json({ error: 'Failed to retrieve transactions.' });
  }
};

/**
 * GET /v1/billing/reports
 * Comprehensive reports data including provider billing, monthly trend, sessions, and claims status
 */
export const getPracticeReports = async (req, res) => {
  const { providerId } = req.query;
  try {
    const where = {};
    if (providerId && providerId !== 'ALL') {
      where.providerId = providerId;
    }

    const bills = await prisma.bill.findMany({
      where,
      include: {
        provider: true,
        serviceLines: true,
        case: { include: { patient: true } }
      }
    });

    const allProviders = await prisma.provider.findMany();
    const providerMap = {};
    const colors = ['#0d9488', '#3b82f6', '#7c3aed', '#f59e0b', '#10b981', '#f43f5e', '#6366f1', '#06b6d4'];

    allProviders.forEach((p, idx) => {
      providerMap[p.id] = {
        provider: p.name || 'Unknown',
        charges: 0,
        payments: 0,
        adjustments: 0,
        balance: 0,
        sessions: 0,
        color: colors[idx % colors.length]
      };
    });

    const monthlyMap = {};
    const sessionMap = {};
    const claimStatusCounts = {
      'Generated': 0,
      'Submitted': 0,
      'Approved': 0,
      'Denied': 0,
      'Pending': 0
    };

    let current = 0;
    let past30 = 0;
    let past60 = 0;
    let past90 = 0;

    for (const b of bills) {
      const totals = typeof b.totals === 'string' ? JSON.parse(b.totals) : b.totals || {};
      const aging = typeof b.aging === 'string' ? JSON.parse(b.aging) : b.aging || {};

      const chg = totals.totalCharges || 0;
      const pmt = totals.totalPayments || 0;
      const adj = totals.totalAdjustments || 0;
      const bal = totals.balanceDue || (chg - pmt - adj);

      current += (aging.current || 0);
      past30 += (aging.past30 || 0);
      past60 += (aging.past60 || 0);
      past90 += (aging.past90 || 0);

      // Claim Status Approximation based on Bill Status
      if (b.status === 'FINALIZED' || b.status === 'FINALISED' || b.status === 'FINALISED_DEMO') claimStatusCounts['Generated'] += 1;
      else if (b.status === 'SUBMITTED') claimStatusCounts['Submitted'] += 1;
      else if (b.status === 'APPROVED') claimStatusCounts['Approved'] += 1;
      else if (b.status === 'DENIED') claimStatusCounts['Denied'] += 1;
      else claimStatusCounts['Pending'] += 1;

      // Provider Billing
      if (providerMap[b.providerId]) {
        providerMap[b.providerId].charges += chg;
        providerMap[b.providerId].payments += pmt;
        providerMap[b.providerId].adjustments += adj;
        providerMap[b.providerId].balance += bal;
        providerMap[b.providerId].sessions += b.serviceLines ? b.serviceLines.length : 0;
      }

      // Monthly Trend using bill createdAt
      const date = new Date(b.createdAt);
      const monthYear = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (!monthlyMap[monthYear]) {
        monthlyMap[monthYear] = { month: monthYear, billed: 0, collected: 0, outstanding: 0 };
      }
      monthlyMap[monthYear].billed += chg;
      monthlyMap[monthYear].collected += pmt;
      monthlyMap[monthYear].outstanding += bal;

      // Session Breakdown from Service Lines
      if (b.serviceLines) {
        for (const line of b.serviceLines) {
          const type = line.description || line.cptCode || 'Service';
          if (!sessionMap[type]) {
            sessionMap[type] = {
              type,
              count: 0,
              provider: providerMap[b.providerId]?.provider || 'Unknown',
              charge: 0,
              cpt: line.cptCode
            };
          }
          sessionMap[type].count += line.units || 1;
          sessionMap[type].charge += Number(line.charge) || 0;
        }
      }
    }

    const claimStatus = [
      { name: 'Generated', value: claimStatusCounts['Generated'], color: '#0d9488' },
      { name: 'Submitted', value: claimStatusCounts['Submitted'], color: '#3b82f6' },
      { name: 'Approved', value: claimStatusCounts['Approved'], color: '#10b981' },
      { name: 'Denied', value: claimStatusCounts['Denied'], color: '#ef4444' },
      { name: 'Pending', value: claimStatusCounts['Pending'], color: '#f59e0b' }
    ];

    const agingData = [
      { bucket: 'Current', amount: Number(current.toFixed(2)), color: '#10b981' },
      { bucket: '1–30 Days', amount: Number(past30.toFixed(2)), color: '#3b82f6' },
      { bucket: '31–60 Days', amount: Number(past60.toFixed(2)), color: '#f59e0b' },
      { bucket: '61–90 Days', amount: Number(past90.toFixed(2)), color: '#f97316' },
      { bucket: '90+ Days', amount: 0, color: '#ef4444' } // Assuming no 90+ bucket logic
    ];

    const providerBilling = Object.values(providerMap).map(p => ({
      ...p,
      charges: Number(p.charges.toFixed(2)),
      payments: Number(p.payments.toFixed(2)),
      adjustments: Number(p.adjustments.toFixed(2)),
      balance: Number(p.balance.toFixed(2))
    }));

    const monthlyBilling = Object.values(monthlyMap).map(m => ({
      ...m,
      billed: Number(m.billed.toFixed(2)),
      collected: Number(m.collected.toFixed(2)),
      outstanding: Number(m.outstanding.toFixed(2))
    }));

    // Ensure at least some default months exist for the graph
    if (monthlyBilling.length === 0) {
      const now = new Date();
      monthlyBilling.push({
        month: now.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        billed: 0, collected: 0, outstanding: 0
      });
    }

    const sessionBreakdown = Object.values(sessionMap).map(s => ({
      ...s,
      charge: Number(s.charge.toFixed(2))
    }));

    const recentClaims = bills.map(b => {
      const pat = b.case?.patient;
      const patientName = pat ? `${pat.firstName} ${pat.lastName}`.trim() : (b.case?.patientName || 'Unknown Patient');
      const totals = typeof b.totals === 'string' ? JSON.parse(b.totals) : b.totals || {};
      return {
        dos: b.createdAt ? new Date(b.createdAt).toLocaleDateString('en-US') : 'N/A',
        provider: providerMap[b.providerId]?.provider || b.providerId,
        patient: patientName,
        dx: 'N/A', // Usually from diagnosis codes, simplified here
        charge: Number(totals.totalCharges || 0),
        status: b.status || 'Generated'
      };
    });

    return res.status(200).json({
      providerBilling,
      monthlyBilling,
      sessionBreakdown,
      claimStatus,
      agingData,
      recentClaims
    });

  } catch (error) {
    console.error('Error generating practice reports:', error);
    return res.status(500).json({ error: 'Failed to generate practice reports.' });
  }
};

/**
 * PUT /api/billing/bills/:id
 * Edit bill charges, service lines, or total amounts
 */
export const updateBill = async (req, res) => {
  const { id } = req.params;
  const { totalCharges, lineItems, status } = req.body;

  try {
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    if (Array.isArray(lineItems) && lineItems.length > 0) {
      await prisma.serviceLine.deleteMany({ where: { billId: id } });
      for (const line of lineItems) {
        await prisma.serviceLine.create({
          data: {
            id: `line-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            billId: id,
            dos: line.dos || line.dateOfService || new Date().toISOString().split('T')[0],
            cptCode: line.cptCode || '99204',
            description: line.description || 'Medical Modality Service',
            units: Number(line.units) || 1,
            charge: Number(line.charge) || 0,
            insurancePayment: Number(line.payments?.insurance) || 0,
            patientPayment: Number(line.payments?.patient) || 0,
            otherPayment: Number(line.payments?.other) || 0,
            adjustments: Number(line.adjustments) || 0,
            balance: Number(line.charge) || 0,
            lineBalance: Number(line.charge) || 0
          }
        });
      }
    } else if (totalCharges !== undefined && Number(totalCharges) > 0) {
      const firstLine = await prisma.serviceLine.findFirst({ where: { billId: id } });
      if (firstLine) {
        await prisma.serviceLine.update({
          where: { id: firstLine.id },
          data: {
            charge: Number(totalCharges),
            balance: Number(totalCharges),
            lineBalance: Number(totalCharges)
          }
        });
      }
    }

    await recalculateBillTotals(id);

    if (status || req.body.cmsSignatures) {
      const dataToUpdate = {};
      if (status) dataToUpdate.status = status;
      if (req.body.cmsSignatures) {
        dataToUpdate.cmsSignatures = typeof req.body.cmsSignatures === 'string' 
          ? req.body.cmsSignatures 
          : JSON.stringify(req.body.cmsSignatures);
      }

      await prisma.bill.update({
        where: { id },
        data: dataToUpdate
      });
    }

    const updatedBill = await prisma.bill.findUnique({
      where: { id },
      include: {
        provider: true,
        case: { include: { patient: true } },
        serviceLines: true
      }
    });

    return res.status(200).json(formatBill(updatedBill));
  } catch (error) {
    console.error('Error updating bill charges:', error);
    return res.status(500).json({ error: 'Failed to update bill charges.' });
  }
};

/**
 * DELETE /api/billing/bills/:id
 * Delete a bill statement and its service lines cleanly
 */
export const deleteBill = async (req, res) => {
  const { id } = req.params;
  try {
    const existing = await prisma.bill.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ error: 'Bill not found' });
    }

    await prisma.$transaction([
      prisma.serviceLine.deleteMany({ where: { billId: id } }),
      prisma.bill.delete({ where: { id } })
    ]);

    return res.status(200).json({ success: true, message: 'Bill statement deleted successfully.' });
  } catch (error) {
    console.error('Error deleting bill:', error);
    return res.status(500).json({ error: 'Failed to delete bill.' });
  }
};
