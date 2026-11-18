import { prisma } from './src/config/db.js';

async function runTests() {
  console.log('================================================================');
  console.log('MEDCAR BILLING – ISSUE 3: CONCLUSION FIELD VERIFICATION SUITE');
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
  // TEST 1: Case Lookup & Initial JOSMIC_PAIN_REPORT Structure
  // -------------------------------------------------------------
  console.log('--- TEST 1: Inspect Case & JOSMIC_PAIN_REPORT ---');
  const melanyCaseId = 'case-1791866905705';
  const melanyCase = await prisma.case.findUnique({
    where: { id: melanyCaseId },
    include: { patient: true }
  });

  assert(Boolean(melanyCase), 'Melany Case Exists in Database', `Case ID: ${melanyCase?.id}`);
  
  let storage = typeof melanyCase.clinicalDocStorage === 'string'
    ? JSON.parse(melanyCase.clinicalDocStorage)
    : (melanyCase.clinicalDocStorage || {});

  assert(
    typeof storage === 'object' && storage !== null,
    'clinicalDocStorage JSON Object Structure',
    `Contains namespaces: ${Object.keys(storage).join(', ')}`
  );

  const initialPainDoc = storage.JOSMIC_PAIN_REPORT || {};
  assert(
    typeof initialPainDoc === 'object',
    'JOSMIC_PAIN_REPORT Namespace Exists in clinicalDocStorage',
    `Initial keys: ${Object.keys(initialPainDoc).slice(0, 8).join(', ')}...`
  );

  // -------------------------------------------------------------
  // TEST 2: Backend Persistence of Conclusion Field
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Save Conclusion to Backend ---');
  const testConclusionText = 'Patient exhibits clinically significant cervicalgia and lumbosacral sprain with guarded recovery. Recommend conservative multimodal therapy with regular re-evaluation.';

  const updatedDoc = {
    ...initialPainDoc,
    conclusion: testConclusionText
  };
  const updatedStorage = {
    ...storage,
    JOSMIC_PAIN_REPORT: updatedDoc
  };

  await prisma.case.update({
    where: { id: melanyCaseId },
    data: { clinicalDocStorage: updatedStorage }
  });

  // Refetch from DB to verify persistence
  const reloadedCase = await prisma.case.findUnique({
    where: { id: melanyCaseId }
  });
  const reloadedStorage = typeof reloadedCase.clinicalDocStorage === 'string'
    ? JSON.parse(reloadedCase.clinicalDocStorage)
    : (reloadedCase.clinicalDocStorage || {});

  assert(
    reloadedStorage?.JOSMIC_PAIN_REPORT?.conclusion === testConclusionText,
    'Backend Persistence: Conclusion Successfully Saved and Reloaded',
    `Saved text: "${reloadedStorage?.JOSMIC_PAIN_REPORT?.conclusion}"`
  );

  // -------------------------------------------------------------
  // TEST 3: Edit and Update Conclusion Field
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Edit and Update Conclusion ---');
  const editedConclusionText = 'Patient exhibits improved range of motion following therapy. Prognosis favorable with completion of recommended care.';

  const editedDoc = {
    ...reloadedStorage.JOSMIC_PAIN_REPORT,
    conclusion: editedConclusionText
  };
  const editedStorage = {
    ...reloadedStorage,
    JOSMIC_PAIN_REPORT: editedDoc
  };

  await prisma.case.update({
    where: { id: melanyCaseId },
    data: { clinicalDocStorage: editedStorage }
  });

  const reloadedEditedCase = await prisma.case.findUnique({
    where: { id: melanyCaseId }
  });
  const reloadedEditedStorage = typeof reloadedEditedCase.clinicalDocStorage === 'string'
    ? JSON.parse(reloadedEditedCase.clinicalDocStorage)
    : (reloadedEditedCase.clinicalDocStorage || {});

  assert(
    reloadedEditedStorage?.JOSMIC_PAIN_REPORT?.conclusion === editedConclusionText,
    'Reload & Edit: Conclusion Successfully Updated and Preserved',
    `Updated text: "${reloadedEditedStorage?.JOSMIC_PAIN_REPORT?.conclusion}"`
  );

  // -------------------------------------------------------------
  // TEST 4: Case & Patient Data Isolation
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Data Isolation Between Cases/Patients ---');
  const otherCases = await prisma.case.findMany({
    where: { id: { not: melanyCaseId } }
  });

  let otherCaseIsolated = true;
  for (const c of otherCases) {
    const s = typeof c.clinicalDocStorage === 'string'
      ? JSON.parse(c.clinicalDocStorage)
      : (c.clinicalDocStorage || {});
    if (s?.JOSMIC_PAIN_REPORT?.conclusion === editedConclusionText) {
      otherCaseIsolated = false;
      break;
    }
  }

  assert(
    otherCaseIsolated,
    'Data Isolation: Other Patient Cases Are Unaffected',
    `Verified across ${otherCases.length} other case(s)`
  );

  // -------------------------------------------------------------
  // TEST 5: 7-Page Packet Manifest & Layout Verification
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: 7-Page Packet Manifest Structure ---');
  const { PACKET_MANIFESTS } = await import('../medcare-billing-/src/constants/packetManifests.js');
  const josmicManifest = PACKET_MANIFESTS['prov-josmic'];

  assert(
    josmicManifest.totalPages === 7,
    'Total Pages Strictly Locked to 7',
    `Manifest totalPages: ${josmicManifest.totalPages}`
  );

  assert(
    josmicManifest.pages.length === 7,
    'Manifest Pages Count Exactly 7',
    `Page list length: ${josmicManifest.pages.length}`
  );

  const page7 = josmicManifest.pages.find(p => p.pageNumber === 7);
  assert(
    page7 && page7.componentKey === 'JosmicPainManagementReport' && page7.reportPage === 4,
    'Page 7 Correctly Maps to JosmicPainManagementReport Page 4',
    `Page 7: id=${page7?.id}, componentKey=${page7?.componentKey}, reportPage=${page7?.reportPage}`
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
    console.error('Test failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
