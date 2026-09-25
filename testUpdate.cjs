const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const cases = await prisma.case.findMany({ take: 1, orderBy: { createdAt: 'desc' } });
  if (!cases.length) return;
  const c = cases[0];
  console.log("Before update:", c.painDescription);
  
  const updated = await prisma.case.update({
    where: { id: c.id },
    data: { painDescription: ["Sharp", "Dull"] }
  });
  console.log("After update:", updated.painDescription);
}
main().catch(console.error).finally(() => prisma.$disconnect());
