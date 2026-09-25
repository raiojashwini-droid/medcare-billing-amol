import { prisma } from './src/config/db.js';
async function check() {
  const p = await prisma.patient.findFirst({ where: { firstName: 'nerraja' } });
  console.log('PATIENT:', p);
}
check();
