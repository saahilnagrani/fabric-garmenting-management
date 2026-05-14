import { db as prisma } from '../src/lib/db';

const list: [string, string][] = [
  ['Tiger', 'Pranera'],
  ['Inka Soft', 'Pranera'],
  ['Mars', 'Pranera'],
  ['Spectra', 'Pranera'],
  ['Zurich', 'Pranera'],
  ['Mirror', 'Pranera'],
  ['Darwin', 'Mumtaz'],
  ['Bubblegum Diamond', 'Ultron'],
  ['Bubblegum Dot', 'Ultron'],
  ['Dryfit', 'Mumtaz'],
  ['Embos', 'Positex'],
  ['Nylon IU', 'Ultron'],
  ['Nylon feel Lycra', 'Ultron'],
  ['Uniqlo Knit', 'Ultron'],
  ['Bubbleknit', 'Pranera'],
  ['NS Poly', 'Pugazh'],
  ['Melange', 'Pranera'],
  ['Nylon Terry', 'Pugazh'],
  ['POS 1281', 'Positex'],
  ['Embose', 'Positex'],
  ['Nylon Feel Lycra', 'Ultron'],
  ['L 3009', 'KS Art'],
  ['Nylon Spandex', 'Global House'],
  ['Poly Spandex', 'Global House'],
];

(async () => {
  const all = await prisma.fabricMaster.findMany({
    include: { vendor: true },
  });
  const byNameLower = new Map(all.map(f => [f.fabricName.toLowerCase(), f]));

  console.log('Expected fabric | Expected vendor | Found? | DB fabricName | DB vendor | Match vendor?');
  console.log('---');
  for (const [name, vendor] of list) {
    const found = byNameLower.get(name.toLowerCase());
    if (!found) {
      // try fuzzy contains
      const fuzzy = all.find(f =>
        f.fabricName.toLowerCase().replace(/\s+/g,'') === name.toLowerCase().replace(/\s+/g,'')
      );
      if (fuzzy) {
        console.log(`${name} | ${vendor} | FUZZY | ${fuzzy.fabricName} | ${fuzzy.vendor.name} | ${fuzzy.vendor.name.toLowerCase()===vendor.toLowerCase()?'yes':'NO'}`);
      } else {
        console.log(`${name} | ${vendor} | MISSING | - | - | -`);
      }
    } else {
      const vendorMatch = found.vendor.name.toLowerCase() === vendor.toLowerCase();
      console.log(`${name} | ${vendor} | yes | ${found.fabricName} | ${found.vendor.name} | ${vendorMatch?'yes':'NO'}`);
    }
  }
  await prisma.$disconnect();
})();
