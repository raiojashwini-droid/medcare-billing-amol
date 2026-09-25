const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const notes = await prisma.clinicalNote.findMany({
    select: {
      id: true,
      patientId: true,
      caseId: true,
      content: true,
    }
  });

  let foundVitals = 0;
  for (const note of notes) {
    if (note.content && typeof note.content === 'object' && note.content.vitals) {
      console.log('Found vitals in note ID:', note.id, 'Case ID:', note.caseId);
      console.log(JSON.stringify(note.content.vitals, null, 2));
      foundVitals++;
    }
  }
  console.log('Total notes with vitals:', foundVitals);
}

main().catch(console.error).finally(() => prisma.$disconnect());
