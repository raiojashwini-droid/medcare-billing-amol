import { prisma } from './src/config/db.js';

async function main() {
  const result = await prisma.clinicalNote.deleteMany({
    where: {
      OR: [
        { patientId: 'pat-001' },
        { title: { contains: 'Placeholder' } }
      ]
    }
  });
  console.log(`Deleted ${result.count} dummy clinical notes.`);
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
