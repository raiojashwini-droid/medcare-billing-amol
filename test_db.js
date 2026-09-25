import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log("Fetching bill...");
  const bill = await prisma.bill.findFirst({
    where: { id: 'bill-davs-case-1789970432590' }
  });
  console.log("Bill:", bill ? "Found" : "Not Found");
  if (bill) {
    console.log("Signatures:", bill.cmsSignatures ? "YES" : "NO");
    console.log(bill.cmsSignatures);
  }
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
