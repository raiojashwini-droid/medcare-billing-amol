import { PrismaClient } from '@prisma/client'; const prisma = new PrismaClient(); prisma.case.findMany().then(c => { console.log(c.map(x => x.dischargeDate)); prisma.$disconnect(); });
