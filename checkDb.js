import { prisma } from './src/config/db.js';

async function main() {
  const c = await prisma.case.findFirst({
    orderBy: { createdAt: 'desc' }
  });
  console.log(JSON.stringify(c, null, 2));
}
main().finally(() => prisma.$disconnect());
