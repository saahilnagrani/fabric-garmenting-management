import { db as prisma } from '../src/lib/db';
const missing = ['Inka Soft','Spectra','Darwin','Embos','Nylon IU','Bubbleknit','Melange','Embose','L 3009','Poly Spandex'];
const expectedVendor: Record<string,string> = {
  'Inka Soft':'Pranera','Spectra':'Pranera','Darwin':'Mumtaz','Embos':'Positex','Nylon IU':'Ultron',
  'Bubbleknit':'Pranera','Melange':'Pranera','Embose':'Positex','L 3009':'KS Art','Poly Spandex':'Global House',
  'Nylon Spandex':'Global House'
};
(async () => {
  const all = await prisma.fabricMaster.findMany({ include: { vendor: true } });
  for (const name of missing) {
    const tokens = name.toLowerCase().split(/\s+/);
    const candidates = all.filter(f => tokens.some(t => f.fabricName.toLowerCase().includes(t)));
    console.log(`\n"${name}" (expected vendor: ${expectedVendor[name]}):`);
    if (candidates.length === 0) console.log('  no candidates');
    for (const c of candidates) console.log(`  -> ${c.fabricName} | vendor=${c.vendor.name}`);
  }
  // Also: list all "Nylon Spandex" entries and all Global House fabrics
  console.log('\nAll Global House fabrics:');
  const gh = all.filter(f => f.vendor.name.toLowerCase()==='global house');
  for (const f of gh) console.log(`  - ${f.fabricName}`);
  console.log('\nAll fabrics named like "Nylon Spandex":');
  for (const f of all.filter(f => f.fabricName.toLowerCase().includes('spandex'))) console.log(`  - ${f.fabricName} | ${f.vendor.name}`);
  await prisma.$disconnect();
})();
