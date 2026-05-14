import { db as prisma } from '../src/lib/db';
(async () => {
  const fms = await prisma.fabricMaster.findMany({ where: { fabricName: { in: ['Nylon IU 160','Nylon IU 161','Nylon IU 162'] } }, select: { id: true, fabricName: true } });
  for (const f of fms) {
    const links = await prisma.fabricMasterColour.findMany({ where: { fabricMasterId: f.id } });
    console.log(`${f.fabricName} (id=${f.id}) → ${links.length} colour link(s)`);
    for (const l of links) console.log(`  - colourId=${l.colourId} slot=${l.slot}`);
  }
  await prisma.$disconnect();
})();
