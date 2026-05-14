import { db as prisma } from '../src/lib/db';
const rows: [string,string,number][] = [
  ['Inka Soft','Pranera',366],
  ['Spectra','Pranera',563],
  ['Darwin','Mumtaz',1],
  ['Bubbleknit','Pranera',315],
  ['Melange','Pranera',1],
];
(async () => {
  for (const [name, vendorName, mrp] of rows) {
    const vendor = await prisma.vendor.findFirst({ where: { name: vendorName } });
    if (!vendor) { console.log(`SKIP ${name}: vendor "${vendorName}" not found`); continue; }
    const existing = await prisma.fabricMaster.findUnique({ where: { fabricName: name } });
    if (existing) { console.log(`EXISTS ${name}`); continue; }
    const created = await prisma.fabricMaster.create({
      data: { fabricName: name, vendorId: vendor.id, mrp, genders: [], articleNumbers: [], coloursAvailable: [] },
    });
    console.log(`CREATED ${created.fabricName} | vendor=${vendorName} | mrp=${mrp} | id=${created.id}`);
  }
  await prisma.$disconnect();
})();
