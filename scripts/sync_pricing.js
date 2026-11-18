// medcare-billing-amol/scripts/sync_pricing.js
import { prisma } from '../src/config/db.js';

async function syncPricing() {
  console.log('--- STARTING PRICING SYNCHRONIZATION ---');

  // 1. Update Service Modalities
  console.log('1. Updating service_modalities...');
  
  // Trigger Point Injection: Fix typo $275000 -> $450.00 & CPT 99214 -> 20552
  const tpiModality = await prisma.serviceModality.findFirst({
    where: { name: { contains: 'Trigger Point' } }
  });
  if (tpiModality) {
    await prisma.serviceModality.update({
      where: { id: tpiModality.id },
      data: {
        cptCode: '20552',
        fee: '$450.00',
        status: 'COMPLETE',
        template: 'Trigger Point Injection Procedure'
      }
    });
    console.log(`  Updated Trigger Point Injection (ID: ${tpiModality.id}) -> CPT 20552, Fee: $450.00`);
  }

  // Shockwave Therapy: Fix CPT 99204 -> 0101T & Fee $850 -> $1000.00
  const shockwaveModality = await prisma.serviceModality.findFirst({
    where: { name: { contains: 'Shockwave' } }
  });
  if (shockwaveModality) {
    await prisma.serviceModality.update({
      where: { id: shockwaveModality.id },
      data: {
        cptCode: '0101T',
        fee: '$1000.00',
        status: 'COMPLETE',
        providerId: 'prov-davs',
        template: "DAV'S ESWT Therapy Record"
      }
    });
    console.log(`  Updated Shockwave Therapy (ID: ${shockwaveModality.id}) -> CPT 0101T, Fee: $1000.00`);
  }

  // Laser Therapy: Fix fee $1500 -> $2000.00
  const laserModality = await prisma.serviceModality.findFirst({
    where: { name: { contains: 'Laser' } }
  });
  if (laserModality) {
    await prisma.serviceModality.update({
      where: { id: laserModality.id },
      data: {
        cptCode: '97039',
        fee: '$2000.00',
        status: 'COMPLETE',
        providerId: 'prov-anik',
        template: 'ANIK Laser Procedure Form'
      }
    });
    console.log(`  Updated Laser Therapy (ID: ${laserModality.id}) -> CPT 97039, Fee: $2000.00`);
  }

  // Pain Management: Fix fee $1250 -> $1214.00
  const painModality = await prisma.serviceModality.findFirst({
    where: { name: { contains: 'Pain Management' } }
  });
  if (painModality) {
    await prisma.serviceModality.update({
      where: { id: painModality.id },
      data: {
        cptCode: '99204',
        fee: '$1214.00',
        status: 'COMPLETE',
        template: 'JOSMIC Pain Evaluation'
      }
    });
    console.log(`  Updated Pain Management (ID: ${painModality.id}) -> CPT 99204, Fee: $1214.00`);
  }

  // TECAR Therapy: Fix CPT 97039 -> 97024, Fee $2000 -> $250.00
  const tecarModality = await prisma.serviceModality.findFirst({
    where: { name: { contains: 'TECAR' } }
  });
  if (tecarModality) {
    await prisma.serviceModality.update({
      where: { id: tecarModality.id },
      data: {
        cptCode: '97024',
        fee: '$250.00',
        status: 'COMPLETE',
        template: 'TECAR Procedure Form'
      }
    });
    console.log(`  Updated TECAR Therapy (ID: ${tecarModality.id}) -> CPT 97024, Fee: $250.00`);
  }

  // Clean duplicate Counseling modality
  const duplicateCounseling = await prisma.serviceModality.findUnique({
    where: { id: '58333a47-c1de-4641-af47-c7fcea2a6a32' }
  });
  if (duplicateCounseling) {
    await prisma.serviceModality.delete({
      where: { id: '58333a47-c1de-4641-af47-c7fcea2a6a32' }
    });
    console.log('  Removed duplicate Counseling & Mental Health modality record.');
  }

  // 2. Synchronize CPT Codes table
  console.log('\n2. Updating cpt_codes master table...');
  const cptMaster = [
    { code: '99204', description: 'Office/Outpatient Visit New (Complex) / Pain Consult', fee: '$1214.00', category: 'E&M / Consult', modifiers: '25, 59' },
    { code: '99214', description: 'Office/Outpatient Visit Established (Moderate)', fee: '$275.00', category: 'E&M', modifiers: '25, 59' },
    { code: '97039', description: 'Unlisted Physical Medicine (HILT Laser)', fee: '$2000.00', category: 'Therapy', modifiers: 'GP, RT' },
    { code: '0101T', description: 'Extracorporeal Shock Wave Therapy (ESWT)', fee: '$1000.00', category: 'Therapy', modifiers: 'RT' },
    { code: '20552', description: 'Trigger Point Injections (1-2 muscles)', fee: '$450.00', category: 'Injections', modifiers: '59' },
    { code: '90834', description: 'Psychotherapy, 45 minutes', fee: '$180.00', category: 'Mental Health', modifiers: '95' },
    { code: '90791', description: 'Psychiatric Diagnostic Evaluation', fee: '$350.00', category: 'Evaluation', modifiers: '95' },
    { code: '97024', description: 'Diathermy / TECAR Radiofrequency', fee: '$250.00', category: 'Therapy', modifiers: 'GP' },
    { code: '10001', description: 'Eye protective glasses', fee: '$50.00', category: 'Supplies', modifiers: '' },
    { code: '97124', description: 'Massage Therapy I', fee: '$90.00', category: 'Therapy', modifiers: 'GP' }
  ];

  for (const item of cptMaster) {
    const existing = await prisma.cptCode.findUnique({ where: { code: item.code } });
    if (existing) {
      await prisma.cptCode.update({
        where: { code: item.code },
        data: {
          description: item.description,
          fee: item.fee,
          category: item.category,
          modifiers: item.modifiers
        }
      });
      console.log(`  Updated CPT ${item.code} -> Fee: ${item.fee}`);
    } else {
      await prisma.cptCode.create({
        data: item
      });
      console.log(`  Inserted CPT ${item.code} -> Fee: ${item.fee}`);
    }
  }

  // 3. Update FM DAV'S Anatomy Provider Record
  console.log('\n3. Populating FM DAV\'S Anatomy provider record...');
  const davsProvider = await prisma.provider.findFirst({
    where: { id: 'prov-davs' }
  });

  if (davsProvider) {
    await prisma.provider.update({
      where: { id: 'prov-davs' },
      data: {
        serviceCategory: 'Shockwave Therapy (ESWT)',
        availableServices: [
          { code: '0101T', description: 'Shockwave / ESWT', defaultCharge: 1000.00, category: 'Therapy' },
          { code: '99204', description: 'Initial Visit II', defaultCharge: 250.00, category: 'Evaluation' },
          { code: '10001', description: 'Eye protective glasses', defaultCharge: 50.00, category: 'Supplies' },
          { code: '97124', description: 'Massage Therapy I', defaultCharge: 90.00, category: 'Therapy' }
        ],
        providerServices: [
          {
            providerId: 'prov-davs',
            serviceId: 'srv-shockwave-therapy',
            enabled: true,
            cptCode: '0101T',
            price: 1000.00,
            duration: '30 min',
            billingDescription: 'Shockwave / ESWT Therapy',
            placeOfService: '10',
            clinicalTemplate: "FM Dav's ESWT Therapy Record",
            configurationStatus: 'COMPLETE'
          }
        ]
      }
    });
    console.log('  FM DAV\'S Anatomy services and rates populated successfully.');
  }

  console.log('\n--- PRICING SYNCHRONIZATION COMPLETED SUCCESSFULLY ---');
  process.exit(0);
}

syncPricing().catch(err => {
  console.error('Error during synchronization:', err);
  process.exit(1);
});

