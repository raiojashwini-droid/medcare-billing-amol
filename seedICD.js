import mariadb from 'mariadb';

const connectionString = "mysql://root:jMaWnTmbvRgwVQyTIMVBFQFWMHehgqpj@altaria.proxy.rlwy.net:37517/railway";

const COMMON_ICD10_CODES = [
  { code: 'M54.50', description: 'Low back pain, unspecified' },
  { code: 'M54.2', description: 'Cervicalgia (Neck pain)' },
  { code: 'M79.10', description: 'Myalgia, unspecified site' },
  { code: 'M54.12', description: 'Radiculopathy, cervical region' },
  { code: 'M54.16', description: 'Radiculopathy, lumbar region' },
  { code: 'M54.6', description: 'Pain in thoracic spine' },
  { code: 'S13.4XXA', description: 'Sprain of ligaments of cervical spine, initial' },
  { code: 'S39.012A', description: 'Strain of muscle, fascia and tendon of lower back, initial' },
  { code: 'G44.309', description: 'Post-traumatic headache, unspecified, not intractable' },
  { code: 'M25.511', description: 'Pain in right shoulder' },
  { code: 'M25.512', description: 'Pain in left shoulder' },
  { code: 'M25.561', description: 'Pain in right knee' },
  { code: 'M25.562', description: 'Pain in left knee' },
  { code: 'V89.2XXA', description: 'Person injured in unspecified motor-vehicle accident, traffic, initial' }
];

async function main() {
  console.log('Connecting to database...');
  let conn;
  try {
    const parsed = new URL(connectionString);
    conn = await mariadb.createConnection({
      host: parsed.hostname,
      port: parseInt(parsed.port, 10),
      user: parsed.username,
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname.replace(/^\//, ''),
      connectTimeout: 15000 // Give Railway 15 seconds to wake up the proxy
    });
    console.log('Connected!');

    for (const item of COMMON_ICD10_CODES) {
      try {
        const id = crypto.randomUUID();
        await conn.query(
          "INSERT IGNORE INTO icd_codes (id, code, description, created_at) VALUES (?, ?, ?, NOW())",
          [id, item.code, item.description]
        );
        console.log(`Seeded ${item.code}`);
      } catch (err) {
        console.error(`Error inserting ${item.code}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Database connection failed:', err);
  } finally {
    if (conn) {
      await conn.end();
      console.log('Connection closed.');
    }
  }
}

main();
