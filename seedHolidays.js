import mysql from 'mysql2/promise';

const US_FEDERAL_HOLIDAYS = [
  { name: "New Year's Day", month: 1, day: 1, type: 'FIXED' },
  { name: 'Martin Luther King Jr. Day', month: 1, nth: 3, dayOfWeek: 1, type: 'FLOATING' },
  { name: "Presidents' Day (Washington's Birthday)", month: 2, nth: 3, dayOfWeek: 1, type: 'FLOATING' },
  { name: 'Memorial Day', month: 5, last: true, dayOfWeek: 1, type: 'FLOATING' },
  { name: 'Juneteenth National Independence Day', month: 6, day: 19, type: 'FIXED' },
  { name: 'Independence Day', month: 7, day: 4, type: 'FIXED' },
  { name: 'Labor Day', month: 9, nth: 1, dayOfWeek: 1, type: 'FLOATING' },
  { name: "Columbus Day / Indigenous Peoples' Day", month: 10, nth: 2, dayOfWeek: 1, type: 'FLOATING' },
  { name: 'Veterans Day', month: 11, day: 11, type: 'FIXED' },
  { name: 'Thanksgiving Day', month: 11, nth: 4, dayOfWeek: 4, type: 'FLOATING' },
  { name: 'Christmas Day', month: 12, day: 25, type: 'FIXED' }
];

async function seed() {
  const connection = await mysql.createConnection('mysql://root:jMaWnTmbvRgwVQyTIMVBFQFWMHehgqpj@altaria.proxy.rlwy.net:37517/railway');
  
  try {
    const [rows] = await connection.execute('SELECT COUNT(*) as count FROM holidays');
    if (rows[0].count > 0) {
      console.log('Holidays already seeded.');
    } else {
      console.log('Seeding Holidays...');
      for (const hol of US_FEDERAL_HOLIDAYS) {
        const day = hol.day !== undefined ? hol.day : null;
        const nth = hol.nth !== undefined ? hol.nth : null;
        const dayOfWeek = hol.dayOfWeek !== undefined ? hol.dayOfWeek : null;
        const last = hol.last !== undefined ? (hol.last ? 1 : 0) : 0;
        
        await connection.execute(
          'INSERT INTO holidays (id, name, type, month, day, nth, day_of_week, last, created_at) VALUES (UUID(), ?, ?, ?, ?, ?, ?, ?, NOW())',
          [hol.name, hol.type, hol.month, day, nth, dayOfWeek, last]
        );
      }
      console.log('Successfully seeded Holidays!');
    }
  } catch (err) {
    console.error('Error seeding data:', err);
  } finally {
    await connection.end();
  }
}

seed();
