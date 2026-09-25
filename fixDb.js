import { prisma } from './src/config/db.js';

async function main() {
  console.log('Starting DB fix...');
  
  // 1. Update ServiceModality table
  const modalities = await prisma.serviceModality.findMany();
  for (const mod of modalities) {
    if (mod.cptCode && (mod.cptCode.includes(' (Confirmed)') || mod.cptCode.includes(' (Pending)'))) {
      const newCptCode = mod.cptCode.replace(' (Confirmed)', '').replace(' (Pending)', '');
      await prisma.serviceModality.update({
        where: { id: mod.id },
        data: { cptCode: newCptCode }
      });
      console.log(`Updated ServiceModality ${mod.name}: ${mod.cptCode} -> ${newCptCode}`);
    }
  }

  // 2. Update GeneralSetting default row
  const setting = await prisma.generalSetting.findUnique({ where: { id: 'default' } });
  if (setting && setting.data && setting.data.modalities) {
    let changed = false;
    const newModalities = setting.data.modalities.map(m => {
      if (m.cpt && (m.cpt.includes(' (Confirmed)') || m.cpt.includes(' (Pending)'))) {
        m.cpt = m.cpt.replace(' (Confirmed)', '').replace(' (Pending)', '');
        changed = true;
      }
      return m;
    });
    
    if (changed) {
      await prisma.generalSetting.update({
        where: { id: 'default' },
        data: { data: { ...setting.data, modalities: newModalities } }
      });
      console.log('Updated GeneralSetting default row');
    }
  }

  console.log('Done!');
}

main()
  .catch(e => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
