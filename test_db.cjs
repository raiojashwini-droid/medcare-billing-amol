const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const bill = await prisma.bill.findFirst({
    where: { id: 'bill-davs-case-1789970432590' }
  });
  console.log(bill);
}

main().finally(() => prisma.$disconnect());
