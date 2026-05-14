import { db as prisma } from '../src/lib/db';
(async () => {
  const ids = ['cmn0436sd00002eu5nnpn1sn9', 'cmmzvbpa7000bclu5sizzhnh8'];
  for (const id of ids) {
    const p = await prisma.phase.findUnique({ where: { id } });
    console.log(`${id}: ${p?.name ?? 'NOT FOUND'}`);
  }
  await prisma.$disconnect();
})();
