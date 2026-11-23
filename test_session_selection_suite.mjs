import {
  filterAndSortCounselingVisits,
  getEligibleCounselingVisits,
  resolveVisitBillingRow,
  buildPart1StatementRows,
  buildPart2StatementRows,
  calculateReconciledStatementTotals
} from '../medcare-billing-/src/utils/counselingBillingHelper.js';

console.log('================================================================');
console.log('TEST SUITE: SESSION SELECTION & BILLING SYNCHRONIZATION');
console.log('================================================================\n');

// 1. Mock 10 completed visits
const mockVisits = Array.from({ length: 10 }).map((_, i) => ({
  id: `apt-coun-${i + 1}`,
  date: `2026-11-${String(i + 1).padStart(2, '0')}`,
  status: 'COMPLETED',
  cptCode: i === 0 ? '90791' : '90834',
  appointmentType: i === 0 ? 'Psychiatric Diagnostic Evaluation' : 'Individual Psychotherapy 45 min'
}));

// Test 1: All 10 visits included
const allTotals = calculateReconciledStatementTotals(mockVisits);
const allRows = buildPart1StatementRows(mockVisits);
const populatedAll = allRows.filter(r => r.dos && r.cpt);

console.log(`[PASS] 10 Completed Visits -> Total Visits: ${allTotals.totalVisitCount}, Populated Rows: ${populatedAll.length}, Total Charges: ${allTotals.totalCharges}`);
if (allTotals.totalVisitCount !== 10 || populatedAll.length !== 10) {
  throw new Error('Test 1 Failed');
}

// Test 2: Select 6 visits
const selected6Ids = mockVisits.slice(0, 6).map(v => v.id);
const rows6 = buildPart1StatementRows(mockVisits, null, selected6Ids);
const totals6 = calculateReconciledStatementTotals(mockVisits, null, selected6Ids);
const populated6 = rows6.filter(r => r.dos && r.cpt);

console.log(`[PASS] Selected 6 Visits -> Total Visits: ${totals6.totalVisitCount}, Populated Rows: ${populated6.length}, Total Charges: ${totals6.totalCharges}`);
if (totals6.totalVisitCount !== 6 || populated6.length !== 6 || totals6.totalCharges !== '$1250.00') {
  throw new Error(`Test 2 Failed: expected 6 rows and $1250.00, got ${populated6.length} rows and ${totals6.totalCharges}`);
}

// Test 3: Remove 1 visit (now 5 visits selected)
const selected5Ids = mockVisits.slice(0, 5).map(v => v.id);
const rows5 = buildPart1StatementRows(mockVisits, null, selected5Ids);
const totals5 = calculateReconciledStatementTotals(mockVisits, null, selected5Ids);
const populated5 = rows5.filter(r => r.dos && r.cpt);

console.log(`[PASS] Removed 1 Visit (5 Selected) -> Total Visits: ${totals5.totalVisitCount}, Populated Rows: ${populated5.length}, Total Charges: ${totals5.totalCharges}`);
if (totals5.totalVisitCount !== 5 || populated5.length !== 5 || totals5.totalCharges !== '$1070.00') {
  throw new Error(`Test 3 Failed: expected 5 rows and $1070.00, got ${populated5.length} rows and ${totals5.totalCharges}`);
}

// Test 4: Fixed 13-row grid integrity
console.log(`[PASS] Layout structure maintained: exactly 13 rows on Part 1 (${rows5.length} rows total, ${13 - populated5.length} empty padding rows)`);
if (rows5.length !== 13) {
  throw new Error('Test 4 Failed: layout row count must be 13');
}

// Test 5: Ineligible visits (CANCELLED, SCHEDULED) exclusion
const mixed = [
  ...mockVisits.slice(0, 3),
  { id: 'apt-canc', date: '2026-11-20', status: 'CANCELLED', cptCode: '90834' },
  { id: 'apt-sched', date: '2026-11-22', status: 'SCHEDULED', cptCode: '90834' }
];
const eligibleMixed = getEligibleCounselingVisits(filterAndSortCounselingVisits(mixed));
console.log(`[PASS] Filter excludes cancelled and scheduled visits: ${eligibleMixed.length} eligible visits out of ${mixed.length}`);
if (eligibleMixed.length !== 3) {
  throw new Error('Test 5 Failed');
}

console.log('\n================================================================');
console.log('ALL 5 SESSION SELECTION & BILLING TESTS PASSED (100%)');
console.log('================================================================\n');
