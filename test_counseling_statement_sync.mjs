import { prisma } from './src/config/db.js';
import {
  filterAndSortCounselingVisits,
  getEligibleCounselingVisits,
  resolveVisitBillingRow,
  buildPart1StatementRows,
  buildPart2StatementRows,
  calculateReconciledStatementTotals
} from '../medcare-billing-/src/utils/counselingBillingHelper.js';

async function runTests() {
  console.log('================================================================');
  console.log('MEDCAR BILLING – ISSUE 2 VERIFICATION SUITE');
  console.log('================================================================\n');

  let passes = 0;
  let fails = 0;

  function assert(condition, testName, details = '') {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      if (details) console.log(`       ${details}`);
      passes++;
    } else {
      console.error(`[FAIL] ${testName}`);
      if (details) console.error(`       ${details}`);
      fails++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Melany Arevalo Real Appointments & Statement Sync
  // -------------------------------------------------------------
  console.log('--- TEST 1: Melany Arevalo Real Appointments & Statement Sync ---');
  const melanyPatientId = 'pat-1790183265830';
  const melanyCaseId = 'case-1791866905705';

  const melanyAppts = await prisma.appointment.findMany({
    where: { patientId: melanyPatientId }
  });
  const melanyBill = await prisma.bill.findFirst({
    where: { caseId: melanyCaseId, providerId: 'prov-counselor' },
    include: { serviceLines: true }
  });

  const melanyFiltered = filterAndSortCounselingVisits(melanyAppts, melanyCaseId);
  const melanyEligible = getEligibleCounselingVisits(melanyFiltered);

  assert(
    melanyFiltered.length === 4,
    'Melany Arevalo Counseling Visits Count',
    `Found ${melanyFiltered.length} counseling visits (expected 4)`
  );

  assert(
    melanyEligible.length === 4,
    'Melany Arevalo Eligible Billable Visits Count',
    `Found ${melanyEligible.length} completed visits (all 4 eligible)`
  );

  const part1Rows = buildPart1StatementRows(melanyFiltered, melanyBill);
  assert(
    part1Rows.length === 13,
    'Page 1 Statement Layout Structure',
    `Page 1 has exactly 13 rows (lock preserved)`
  );

  // Check rows 0 to 3 for real visit data
  const populatedRows = part1Rows.filter(r => r.dos && r.cpt);
  assert(
    populatedRows.length === 4,
    'Page 1 Populated Rows Count Matches Real Visits',
    `4 rows populated with actual DOS ${populatedRows[0].dos}, CPT ${populatedRows[0].cpt}, Charge ${populatedRows[0].charge}`
  );

  assert(
    populatedRows[0].dos === '2026-11-17' && populatedRows[0].cpt === '90834' && populatedRows[0].charge === '$790.00',
    'Page 1 First Row Accurate Real Appointment Data',
    `DOS: ${populatedRows[0].dos}, CPT: ${populatedRows[0].cpt}, Desc: ${populatedRows[0].desc}, Charge: ${populatedRows[0].charge}`
  );

  // Check remaining rows 4 to 12 are empty
  const emptyRows = part1Rows.slice(4);
  const allEmpty = emptyRows.every(r => r.dos === '' && r.cpt === '' && r.charge === '');
  assert(
    allEmpty && emptyRows.length === 9,
    'Page 1 Remaining Rows Empty Padding (Rows 5-13)',
    `9 empty padding rows maintain exact 13-row grid layout`
  );

  // Page 2 continuation rows & layout lock
  const part2Rows = buildPart2StatementRows(melanyFiltered, melanyBill);
  assert(
    part2Rows.length === 4,
    'Page 2 Continuation Rows Layout Preservation',
    `Page 2 has exactly 4 rows (minimum layout height preserved)`
  );

  // Totals reconciliation
  const totals = calculateReconciledStatementTotals(melanyFiltered, melanyBill);
  assert(
    totals.totalCharges === '$3160.00',
    'Financial Totals: Reconciled Total Charges',
    `Total Charges = 4 x $790.00 = ${totals.totalCharges}`
  );
  assert(
    totals.paymentsCredits === '$0.00',
    'Financial Totals: Payments / Credits',
    `Payments = ${totals.paymentsCredits}`
  );
  assert(
    totals.balanceDue === '$3160.00',
    'Financial Totals: Balance Due Reconciliation',
    `Balance Due = Total Charges - Payments = ${totals.balanceDue}`
  );

  // Cross-check: Sum of displayed row charges equals displayed Total Charges
  const sumPart1Charges = part1Rows.reduce((sum, r) => sum + (r.chargeNum || 0), 0);
  const sumPart2Charges = part2Rows.reduce((sum, r) => sum + (r.chargeNum || 0), 0);
  const totalDisplayCharges = sumPart1Charges + sumPart2Charges;
  assert(
    totalDisplayCharges === totals.totalChargesNum,
    'Cross-Verification: Statement Row Sum Equals Totals Box',
    `Row Sum ($${totalDisplayCharges.toFixed(2)}) == Totals Box (${totals.totalCharges})`
  );

  // -------------------------------------------------------------
  // TEST 2: Zero-Visit Patient
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Zero-Visit Patient ---');
  const zeroAppts = [];
  const zeroBill = { totals: { totalPayments: 0 } };

  const zeroFiltered = filterAndSortCounselingVisits(zeroAppts, 'case-zero');
  const zeroPart1 = buildPart1StatementRows(zeroFiltered, zeroBill);
  const zeroPart2 = buildPart2StatementRows(zeroFiltered, zeroBill);
  const zeroTotals = calculateReconciledStatementTotals(zeroFiltered, zeroBill);

  assert(
    zeroPart1.length === 13 && zeroPart1.every(r => r.dos === '' && r.cpt === '' && r.charge === ''),
    'Zero Visits: Page 1 shows 13 clean empty rows',
    'No static mock rows or phantom charges displayed'
  );

  assert(
    zeroPart2.length === 4 && zeroPart2.every(r => r.dos === '' && r.cpt === '' && r.charge === ''),
    'Zero Visits: Page 2 preserves 4 empty continuation rows',
    'Continuation table layout remains intact'
  );

  assert(
    zeroTotals.totalCharges === '$0.00' && zeroTotals.balanceDue === '$0.00',
    'Zero Visits: Totals reconcile to $0.00',
    `Total Charges: ${zeroTotals.totalCharges}, Balance Due: ${zeroTotals.balanceDue}`
  );

  // -------------------------------------------------------------
  // TEST 3: Status Filtering (Scheduled, Cancelled, No-Show)
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Status Handling & Billing Eligibility ---');
  const mixedAppts = [
    {
      id: 'apt-c1',
      providerId: 'prov-counselor',
      date: '2026-11-10',
      startTime: '09:00 AM',
      status: 'COMPLETED',
      cptCode: '90791',
      fee: 350
    },
    {
      id: 'apt-c2',
      providerId: 'prov-counselor',
      date: '2026-11-12',
      startTime: '10:00 AM',
      status: 'SCHEDULED', // Future / pending appointment: not billable yet
      cptCode: '90834',
      fee: 180
    },
    {
      id: 'apt-c3',
      providerId: 'prov-counselor',
      date: '2026-11-14',
      startTime: '11:00 AM',
      status: 'CANCELLED', // Cancelled: excluded
      cptCode: '90834',
      fee: 180
    },
    {
      id: 'apt-c4',
      providerId: 'prov-counselor',
      date: '2026-11-15',
      startTime: '11:00 AM',
      status: 'NO_SHOW', // No-show: excluded
      cptCode: '90834',
      fee: 180
    },
    {
      id: 'apt-c5',
      providerId: 'prov-counselor',
      date: '2026-11-17',
      startTime: '09:00 AM',
      status: 'COMPLETED', // Completed: billable
      cptCode: '90834',
      fee: 180
    }
  ];

  const mixedFiltered = filterAndSortCounselingVisits(mixedAppts);
  const mixedEligible = getEligibleCounselingVisits(mixedFiltered);

  assert(
    mixedFiltered.length === 3,
    'filterAndSortCounselingVisits excludes CANCELLED and NO_SHOW',
    `Retained 3 non-cancelled visits out of 5`
  );

  assert(
    mixedEligible.length === 2,
    'getEligibleCounselingVisits excludes SCHEDULED from billing statement',
    `Only 2 COMPLETED visits eligible for statement billing`
  );

  const mixedPart1 = buildPart1StatementRows(mixedFiltered);
  const mixedPopulated = mixedPart1.filter(r => r.dos && r.cpt);
  assert(
    mixedPopulated.length === 2,
    'Statement Only Populates Eligible (Completed) Rows',
    `Row 1: ${mixedPopulated[0].cpt} ($${mixedPopulated[0].chargeNum}), Row 2: ${mixedPopulated[1].cpt} ($${mixedPopulated[1].chargeNum})`
  );

  const mixedTotals = calculateReconciledStatementTotals(mixedFiltered);
  assert(
    mixedTotals.totalCharges === '$530.00',
    'Mixed Status Total Charges Accurate',
    `$350 (90791) + $180 (90834) = $530.00 (Scheduled visit $180 correctly excluded)`
  );

  // -------------------------------------------------------------
  // TEST 4: Pagination & Overflow Handling (> 13 visits)
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Pagination & Continuation (> 13 visits) ---');
  const manyAppts = Array.from({ length: 16 }).map((_, i) => ({
    id: `apt-bulk-${i + 1}`,
    providerId: 'prov-counselor',
    date: `2026-11-${String(i + 1).padStart(2, '0')}`,
    startTime: '09:00 AM',
    status: 'COMPLETED',
    cptCode: i === 0 ? '90791' : '90834',
    fee: i === 0 ? 350 : 180
  }));

  const manyFiltered = filterAndSortCounselingVisits(manyAppts);
  const manyPart1 = buildPart1StatementRows(manyFiltered);
  const manyPart2 = buildPart2StatementRows(manyFiltered);
  const manyTotals = calculateReconciledStatementTotals(manyFiltered);

  assert(
    manyPart1.length === 13 && manyPart1.every(r => r.dos && r.cpt),
    'Page 1 Fixed 13-row Table Filled Exactly to 13 Visits',
    `Page 1 holds visits 1 through 13`
  );

  assert(
    manyPart2.length === 4,
    'Page 2 Continuation Table Receives Remaining Visits (14-16) + Padding',
    `Page 2 holds visits 14, 15, 16 in rows 1-3, plus 1 empty row (total 4 rows)`
  );

  assert(
    manyPart2[0].dos === '2026-11-14' && manyPart2[1].dos === '2026-11-15' && manyPart2[2].dos === '2026-11-16' && manyPart2[3].dos === '',
    'Page 2 Continuation Data Integrity',
    `Visit 14: ${manyPart2[0].dos}, Visit 15: ${manyPart2[1].dos}, Visit 16: ${manyPart2[2].dos}, Row 4: empty padding`
  );

  const expectedManyTotal = 350 + (15 * 180); // $3050.00
  assert(
    manyTotals.totalCharges === `$${expectedManyTotal.toFixed(2)}`,
    'Multi-Page Financial Reconciliation',
    `Total Charges across Page 1 + Page 2 = ${manyTotals.totalCharges} (Reconciles 100%)`
  );

  console.log('\n================================================================');
  console.log(`TOTAL PASSES: ${passes} | TOTAL FAILS: ${fails}`);
  console.log('================================================================\n');

  if (fails > 0) {
    process.exit(1);
  }
}

runTests()
  .catch(err => {
    console.error('Test suite failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
