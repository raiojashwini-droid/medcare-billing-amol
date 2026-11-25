// medcare-billing-amol/scripts/test_e2e_full_workflow_suite.mjs
import 'dotenv/config';
import assert from 'assert';
import { prisma } from '../src/config/db.js';

const API_BASE = 'http://localhost:5000/v1';

async function main() {
  console.log('================================================================');
  console.log('MEDCARE BILLING — COMPREHENSIVE END-TO-END WORKFLOW TEST SUITE');
  console.log('================================================================\n');

  let passedTests = 0;
  let failedTests = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`[PASS] ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`[FAIL] ${name}: ${err.message}`);
      failedTests++;
    }
  }

  // Record pre-test baseline counts
  const preBillsCount = await prisma.bill.count();
  const preLinesCount = await prisma.serviceLine.count();
  const prePatientsCount = await prisma.patient.count();
  const preCasesCount = await prisma.case.count();

  console.log('Baseline Database State:');
  console.log(`- Patients: ${prePatientsCount}`);
  console.log(`- Cases: ${preCasesCount}`);
  console.log(`- Bills: ${preBillsCount}`);
  console.log(`- Service Lines: ${preLinesCount}\n`);

  let testPatientId = null;
  let testCaseId = null;
  const createdBillIds = [];

  try {
    // -------------------------------------------------------------
    // PHASE 1: Isolated Patient Creation
    // -------------------------------------------------------------
    console.log('PHASE 1: Patient Creation...');
    const patientPayload = {
      firstName: 'AuditTest',
      lastName: `Patient-${Date.now()}`,
      dob: '1988-06-15',
      gender: 'MALE',
      phone: '713-555-0199',
      email: `audit.${Date.now()}@testpractice.org`,
      address: '456 Healthcare Blvd, Houston, TX 77002'
    };

    const ptRes = await fetch(`${API_BASE}/patients`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patientPayload)
    });
    assert(ptRes.ok, `Failed to create patient: ${ptRes.status}`);
    const ptData = await ptRes.json();
    testPatientId = ptData.id || ptData.patientId;

    test('Patient created with valid ID and demographic data', () => {
      assert(testPatientId, 'Missing patientId in response');
      assert.strictEqual(ptData.firstName, patientPayload.firstName);
    });

    // -------------------------------------------------------------
    // PHASE 2: Clinical Case Creation & Provider Assignment
    // -------------------------------------------------------------
    console.log('\nPHASE 2: Clinical Case Creation & Provider Assignment...');
    testCaseId = `case-audit-${Date.now()}`;
    const clinicalProviders = [
      'prov-anik',       // FM Laser Therapy
      'prov-counselor',  // FM Counselor Practice
      'prov-davs',       // FM DAV'S Anatomy
      'prov-josmic',     // FM HEALTH AND WELLNESS CENTER
      'prov-tecar',      // FM TECAR Radiofrequency Practice
      'prov-tpi'         // FM Trigger Point Injection Practice
    ];

    const casePayload = {
      patientId: testPatientId,
      accidentType: 'Auto Accident (MVA)',
      accidentState: 'TX',
      caseType: 'Personal Injury',
      accidentDate: '2026-10-01',
      dateOfInjury: '2026-10-01',
      primaryDiagnosis: 'M54.5',
      diagnosisCodes: ['M54.5', 'M54.2'],
      assignedProviders: clinicalProviders,
      status: 'ACTIVE'
    };

    const caseRes = await fetch(`${API_BASE}/cases`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(casePayload)
    });
    if (!caseRes.ok) {
      const errBody = await caseRes.text();
      console.error('Case creation failed:', errBody);
    }
    assert(caseRes.ok, `Failed to create case: ${caseRes.status}`);
    const caseData = await caseRes.json();
    testCaseId = caseData.id || caseData.caseId;

    test('Clinical case created with assigned providers', () => {
      assert(testCaseId, 'Missing case ID');
      assert.strictEqual(caseData.patientId, testPatientId);
    });

    // Verify ZERO unwanted default bills/charges
    const caseBillsAfterCreation = await prisma.bill.findMany({ where: { caseId: testCaseId } });
    test('Zero default bills or unwanted charges generated upon case creation', () => {
      assert.strictEqual(caseBillsAfterCreation.length, 0, `Expected 0 bills, found ${caseBillsAfterCreation.length}`);
    });

    // -------------------------------------------------------------
    // PHASE 3: Appointments & Visits (Scheduled vs Completed)
    // -------------------------------------------------------------
    console.log('\nPHASE 3: Appointments & Visits Verification...');
    const appt = await prisma.appointment.create({
      data: {
        id: `appt-audit-${Date.now()}`,
        patientId: testPatientId,
        caseId: testCaseId,
        providerId: 'prov-josmic',
        appointmentDate: new Date('2026-11-28T10:00:00Z'),
        startTime: '10:00',
        endTime: '11:00',
        status: 'SCHEDULED',
        appointmentType: 'INITIAL_EVAL'
      }
    });

    // Verify scheduled visits do NOT generate fabricated charges in billing
    const billsAfterScheduledAppt = await prisma.bill.findMany({ where: { caseId: testCaseId } });
    test('Scheduled visit does NOT fabricate unposted billing charges', () => {
      assert.strictEqual(billsAfterScheduledAppt.length, 0);
    });

    // -------------------------------------------------------------
    // PHASE 4: Atomic Provider Bills Creation across all 6 Providers
    // -------------------------------------------------------------
    console.log('\nPHASE 4: Atomic Bill Creation Across All 6 Clinical Providers...');
    const providerBillDefinitions = [
      {
        providerId: 'prov-anik',
        name: 'FM Laser Therapy',
        lines: [
          { cptCode: '97026', description: 'Class IV High-Intensity Laser Therapy (HILT) Biostimulation (6 Sessions)', units: 3, charge: 150.00, dos: '2026-11-20', diagnosisPointer: 'A', icd10: 'M54.5' }
        ],
        expectedTotal: 450.00
      },
      {
        providerId: 'prov-counselor',
        name: 'FM Counselor Practice',
        lines: [
          { cptCode: '90834', description: 'Individual Psychotherapy 45 min for Vehicular Phobia', units: 1, charge: 180.00, dos: '2026-11-21', diagnosisPointer: 'B', icd10: 'M54.2' }
        ],
        expectedTotal: 180.00
      },
      {
        providerId: 'prov-davs',
        name: "FM DAV'S Anatomy",
        lines: [
          { cptCode: '0295T', description: 'Extracorporeal Shockwave Therapy (ESWT) Musculoskeletal Tissue Regeneration', units: 1, charge: 350.00, dos: '2026-11-22', diagnosisPointer: 'A', icd10: 'M54.5' }
        ],
        expectedTotal: 350.00
      },
      {
        providerId: 'prov-josmic',
        name: 'FM HEALTH AND WELLNESS CENTER',
        lines: [
          { cptCode: '99204', description: 'Comprehensive Initial Pain Management Evaluation & Medical Decision Making', units: 1, charge: 250.00, dos: '2026-11-22', diagnosisPointer: 'A,B', icd10: 'M54.5' }
        ],
        expectedTotal: 250.00
      },
      {
        providerId: 'prov-tecar',
        name: 'FM TECAR Radiofrequency Practice',
        lines: [
          { cptCode: '97032', description: 'Targeted Radiofrequency TECAR Therapy Session & Deep Thermal Bio-Modulation', units: 2, charge: 120.00, dos: '2026-11-23', diagnosisPointer: 'A', icd10: 'M54.5' }
        ],
        expectedTotal: 240.00
      },
      {
        providerId: 'prov-tpi',
        name: 'FM Trigger Point Injection Practice',
        lines: [
          { cptCode: '20552', description: 'Trigger Point Injection - 1 or 2 Muscle Groups (Spinal & Cervical Paravertebral)', units: 2, charge: 100.00, dos: '2026-11-24', diagnosisPointer: 'B', icd10: 'M54.2' }
        ],
        expectedTotal: 200.00
      }
    ];

    let expectedGrandTotal = 0;

    for (const def of providerBillDefinitions) {
      const billRes = await fetch(`${API_BASE}/billing/bills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          caseId: testCaseId,
          providerId: def.providerId,
          serviceLines: def.lines
        })
      });

      assert(billRes.ok, `Failed to create bill for ${def.name}: ${billRes.status}`);
      const billData = await billRes.json();
      createdBillIds.push(billData.id);
      expectedGrandTotal += def.expectedTotal;

      test(`Bill atomically saved for ${def.name} with exact charges (${def.expectedTotal})`, () => {
        assert.strictEqual(billData.providerId, def.providerId);
        assert.strictEqual(billData.totals?.totalCharges, def.expectedTotal);
        assert.strictEqual(billData.serviceLines?.length, def.lines.length);
        assert.strictEqual(billData.totals?.balanceDue, def.expectedTotal);
      });
    }

    // Test legitimate service-line addition with description containing procedure keyword
    console.log('\nTesting service line addition without dummy description deletion...');
    const anikBillId = createdBillIds[0];
    const addLineRes = await fetch(`${API_BASE}/billing/bills/${anikBillId}/service-lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cptCode: '97110',
        description: 'Therapeutic Exercise Mobilization & Biostimulation Follow-up',
        units: 1,
        charge: 90.00,
        dos: '2026-11-25',
        diagnosisPointer: 'A'
      })
    });
    assert(addLineRes.ok, 'Failed to add service line');
    const anikRefreshed = await prisma.bill.findUnique({
      where: { id: anikBillId },
      include: { serviceLines: true }
    });

    test('addServiceLine appends line and does NOT delete existing lines matching procedure keywords', () => {
      assert.strictEqual(anikRefreshed.serviceLines.length, 2, `Expected 2 lines, got ${anikRefreshed.serviceLines.length}`);
      assert.strictEqual(anikRefreshed.totals.totalCharges, 540.00, `Expected 540.00, got ${anikRefreshed.totals.totalCharges}`);
    });
    expectedGrandTotal += 90.00; // Anik now 540

    // Test posting payment ($50 on Anik bill)
    console.log('\nTesting Payment and Adjustment Posting...');
    const payRes = await fetch(`${API_BASE}/billing/bills/${anikBillId}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 50.00,
        method: 'CHECK',
        referenceNumber: 'CHK-1001',
        paymentSource: 'INSURANCE'
      })
    });
    assert(payRes.ok, 'Failed to post payment');
    const anikPaid = await prisma.bill.findUnique({ where: { id: anikBillId } });

    test('Payment of $50 recorded correctly: amountCollected=50, balanceDue=490', () => {
      assert.strictEqual(anikPaid.totals.totalPayments, 50.00);
      assert.strictEqual(anikPaid.totals.balanceDue, 490.00);
    });

    // Test posting adjustment ($20 on Counselor bill)
    const counselorBillId = createdBillIds[1];
    const adjRes = await fetch(`${API_BASE}/billing/bills/${counselorBillId}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: 20.00,
        reason: 'Contractual write-off'
      })
    });
    assert(adjRes.ok, 'Failed to post adjustment');
    const counselorAdj = await prisma.bill.findUnique({ where: { id: counselorBillId } });

    test('Adjustment of $20 recorded correctly: totalAdjustments=20, balanceDue=160', () => {
      assert.strictEqual(counselorAdj.totals.totalAdjustments, 20.00);
      assert.strictEqual(counselorAdj.totals.balanceDue, 160.00);
    });

    // -------------------------------------------------------------
    // PHASE 5: Finalized Bill Protection
    // -------------------------------------------------------------
    console.log('\nPHASE 5: Finalized Bill Protection...');
    const josmicBillId = createdBillIds[3];
    const finRes = await fetch(`${API_BASE}/billing/bills/${josmicBillId}/finalise`, { method: 'POST' });
    assert(finRes.ok, 'Failed to finalise bill');

    const blockedLineRes = await fetch(`${API_BASE}/billing/bills/${josmicBillId}/service-lines`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cptCode: '99213',
        description: 'Late added follow up',
        units: 1,
        charge: 100.00
      })
    });

    test('Appending service lines to finalized bill is rejected with 400', () => {
      assert.strictEqual(blockedLineRes.status, 400);
    });

    // -------------------------------------------------------------
    // PHASE 6: CMS-1500 Claims Queue Integration
    // -------------------------------------------------------------
    console.log('\nPHASE 6: CMS-1500 Claims Integration...');
    const cmsRes = await fetch(`${API_BASE}/billing/cms-claims`);
    assert(cmsRes.ok, 'Failed to fetch CMS claims');
    const cmsData = await cmsRes.json();
    const caseCmsBills = (cmsData.bills || []).filter(b => b.caseId === testCaseId);

    test('All 6 clinical provider bills appear in CMS-1500 claims queue', () => {
      assert.strictEqual(caseCmsBills.length, 6, `Expected 6 CMS claims, got ${caseCmsBills.length}`);
    });

    test('CMS-1500 Box 24 & Box 28 calculations: exact charges, no double multiplication', () => {
      const anikCms = caseCmsBills.find(b => b.providerId === 'prov-anik');
      assert(anikCms, 'Anik CMS bill not found');
      // Box 24: 3 units * 150 = 450 + 1 unit * 90 = 90 => Box 28 = 540
      assert.strictEqual(anikCms.totals.totalCharges, 540.00);
      assert.strictEqual(anikCms.totals.totalPayments, 50.00);
      assert.strictEqual(anikCms.totals.balanceDue, 490.00);
    });

    // -------------------------------------------------------------
    // PHASE 7: Global Provider Filtering & Billing Overview
    // -------------------------------------------------------------
    console.log('\nPHASE 7: Global Provider Filtering & Billing Overview...');
    for (const provId of clinicalProviders) {
      const provOverviewRes = await fetch(`${API_BASE}/billing/overview-stats?providerId=${provId}`);
      assert(provOverviewRes.ok);
      const provOverview = await provOverviewRes.json();
      test(`Overview Stats filtered by ${provId} returns strictly matching provider records`, () => {
        assert.strictEqual(provOverview.providers.length, 1);
        assert.strictEqual(provOverview.providers[0].id, provId);
        assert(provOverview.kpis.totalBilled > 0, `${provId} totalBilled should be > 0`);
      });
    }

    // Practice-wide overview verification
    const allOverviewRes = await fetch(`${API_BASE}/billing/overview-stats`);
    assert(allOverviewRes.ok);
    const allOverview = await allOverviewRes.json();

    test('Practice-wide Overview reconciles mathematical balance across all providers', () => {
      const calcBal = Number((allOverview.kpis.totalBilled - (allOverview.kpis.amountCollected + allOverview.kpis.totalAdjustments)).toFixed(2));
      assert.strictEqual(allOverview.kpis.outstandingBalance, calcBal);
      const sumAging = Number((
        (allOverview.agingBuckets.current || 0) +
        (allOverview.agingBuckets.past30 || 0) +
        (allOverview.agingBuckets.past60 || 0) +
        (allOverview.agingBuckets.past90 || 0) +
        (allOverview.agingBuckets.over90 || 0)
      ).toFixed(2));
      assert.strictEqual(sumAging, allOverview.kpis.outstandingBalance);
    });

  } finally {
    // -------------------------------------------------------------
    // PHASE 8: Clean Cleanup & Database Integrity Verification
    // -------------------------------------------------------------
    console.log('\nPHASE 8: Isolated Test Data Cleanup...');
    if (createdBillIds.length > 0) {
      await prisma.serviceLine.deleteMany({
        where: { billId: { in: createdBillIds } }
      });
      await prisma.transaction.deleteMany({
        where: { billId: { in: createdBillIds } }
      });
      await prisma.bill.deleteMany({
        where: { id: { in: createdBillIds } }
      });
    }
    if (testCaseId) {
      await prisma.appointment.deleteMany({ where: { caseId: testCaseId } });
      await prisma.case.deleteMany({ where: { id: testCaseId } });
    }
    if (testPatientId) {
      await prisma.patient.deleteMany({ where: { id: testPatientId } });
    }

    console.log('Cleanup completed.');

    // Verify baseline database integrity
    const postBillsCount = await prisma.bill.count();
    const postLinesCount = await prisma.serviceLine.count();
    const postPatientsCount = await prisma.patient.count();
    const postCasesCount = await prisma.case.count();

    test('Post-cleanup database integrity: all original 26 bills intact', () => {
      assert.strictEqual(postBillsCount, preBillsCount, `Bills count changed: was ${preBillsCount}, now ${postBillsCount}`);
    });
    test('Post-cleanup database integrity: all original 34 service lines intact', () => {
      assert.strictEqual(postLinesCount, preLinesCount, `Service lines count changed: was ${preLinesCount}, now ${postLinesCount}`);
    });
    test('Post-cleanup database integrity: original patients and cases intact', () => {
      assert.strictEqual(postPatientsCount, prePatientsCount);
      assert.strictEqual(postCasesCount, preCasesCount);
    });

    const targetBill = await prisma.bill.findUnique({
      where: { id: 'bill-tpi-case-1790166089540' },
      include: { serviceLines: true }
    });
    test('bill-tpi-case-1790166089540 integrity verified post-cleanup', () => {
      assert(targetBill, 'bill-tpi-case-1790166089540 missing!');
      assert.strictEqual(targetBill.totals.totalCharges, 450);
      assert.strictEqual(targetBill.serviceLines.length, 1);
    });
  }

  console.log(`\n================================================================`);
  console.log(`WORKFLOW TEST SUITE SUMMARY: ${passedTests} PASSED, ${failedTests} FAILED`);
  console.log(`================================================================\n`);

  if (failedTests > 0) process.exit(1);
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
