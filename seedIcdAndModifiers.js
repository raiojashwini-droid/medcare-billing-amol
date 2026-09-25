import mysql from 'mysql2/promise';

const DEFAULT_ICD_CATALOG = [
  { code: 'M54.50', description: 'Low back pain, unspecified', category: 'Orthopedic' },
  { code: 'M54.2', description: 'Cervicalgia (Neck pain)', category: 'Orthopedic' },
  { code: 'S13.4XXA', description: 'Sprain of ligaments of cervical spine, initial encounter', category: 'Trauma/MVA' },
  { code: 'S39.012A', description: 'Strain of muscle/tendon of lower back, initial encounter', category: 'Trauma/MVA' },
  { code: 'F43.10', description: 'Post-traumatic stress disorder, unspecified', category: 'Mental Health' },
  { code: 'M25.572', description: 'Pain in left ankle and foot', category: 'Extremity' }
];

const DEFAULT_MODIFIER_CATALOG = [
  { code: '25', description: 'Significant, Separately Identifiable E&M Service on Same Day' },
  { code: '59', description: 'Distinct Procedural Service' },
  { code: 'RT', description: 'Right Side' },
  { code: 'LT', description: 'Left Side' },
  { code: 'GP', description: 'Services Delivered Under Physical Therapy Plan of Care' },
  { code: 'TC', description: 'Technical Component' }
];

async function seed() {
  const connection = await mysql.createConnection('mysql://root:jMaWnTmbvRgwVQyTIMVBFQFWMHehgqpj@altaria.proxy.rlwy.net:37517/railway');
  
  try {
    // Seed ICD
    const [icdRows] = await connection.execute('SELECT COUNT(*) as count FROM icd_codes');
    if (icdRows[0].count > 0) {
      console.log('ICD Codes already seeded.');
    } else {
      console.log('Seeding ICD codes...');
      for (const icd of DEFAULT_ICD_CATALOG) {
        await connection.execute(
          'INSERT INTO icd_codes (id, code, description, category, created_at) VALUES (UUID(), ?, ?, ?, NOW())',
          [icd.code, icd.description, icd.category]
        );
      }
      console.log('Successfully seeded ICD Codes!');
    }

    // Seed Modifiers
    const [modRows] = await connection.execute('SELECT COUNT(*) as count FROM modifiers');
    if (modRows[0].count > 0) {
      console.log('Modifiers already seeded.');
    } else {
      console.log('Seeding Modifiers...');
      for (const mod of DEFAULT_MODIFIER_CATALOG) {
        await connection.execute(
          'INSERT INTO modifiers (id, code, description, created_at) VALUES (UUID(), ?, ?, NOW())',
          [mod.code, mod.description]
        );
      }
      console.log('Successfully seeded Modifiers!');
    }

  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await connection.end();
  }
}

seed();
