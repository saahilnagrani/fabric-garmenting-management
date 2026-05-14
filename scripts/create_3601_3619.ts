import { db as prisma } from '../src/lib/db';

type Spec = {
  articleNumber: string;
  productName: string;
  type: string;       // new type
  prevType?: string;  // historical type (Current column)
  gender: 'MENS' | 'WOMENS' | 'KIDS';
  garmentingAt: string;
  fabricName: string;
  fabric2Name?: string;
  rows: Array<{
    newSku: string; oldSku?: string; colour: string; colour2?: string;
    gKg?: number | null; gKg2?: number | null;
  }>;
  costs: Record<string, number>; // shared per article
};

const articles: Spec[] = [
  // ─── KS Art & Craft swimwear (L 3009) ───
  { articleNumber: '3601', productName: 'HydraOne', type: 'Kneesuit', prevType: 'One Piece Knee Length Swimsuit', gender: 'WOMENS', garmentingAt: 'KS Art & Craft', fabricName: 'L 3009', rows: [
    { newSku: 'W SW01 PNK', colour: 'Pink' }, { newSku: 'W SW01 PCH', colour: 'Peach' }, { newSku: 'W SW01 BLU', colour: 'Light Blue' },
  ], costs: { stitchingCost: 730, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 6, inwardShipping: 10, proposedMrp: 2299 } },
  { articleNumber: '3602', productName: 'Serena', type: 'Skort Suit', prevType: 'One Piece Skort Swimsuit', gender: 'WOMENS', garmentingAt: 'KS Art & Craft', fabricName: 'L 3009', rows: [
    { newSku: 'W SW02 PNK', colour: 'Pink' }, { newSku: 'W SW02 SHB', colour: 'Shortbread' }, { newSku: 'W SW02 PCH', colour: 'Peach' },
  ], costs: { stitchingCost: 820, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 6, inwardShipping: 10, proposedMrp: 2399 } },
  { articleNumber: '3603', productName: 'Seabloom', type: 'Skort Suit', prevType: 'One Piece Skort Swimsuit', gender: 'WOMENS', garmentingAt: 'KS Art & Craft', fabricName: 'L 3009', rows: [
    { newSku: 'W SW03 SHB', colour: 'Shortbread' }, { newSku: 'W SW03 PCH', colour: 'Peach' }, { newSku: 'W SW03 PNK', colour: 'Pink' },
  ], costs: { stitchingCost: 890, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 6, inwardShipping: 10, proposedMrp: 2399 } },
  { articleNumber: '3604', productName: 'Marise', type: 'Two Piece Skort Set', gender: 'WOMENS', garmentingAt: 'KS Art & Craft', fabricName: 'L 3009', rows: [
    { newSku: 'W SW04 SHB', colour: 'Shortbread' }, { newSku: 'W SW04 BLU', colour: 'Light Blue' }, { newSku: 'W SW04 PNK', colour: 'Pink' },
  ], costs: { stitchingCost: 910, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 6, inwardShipping: 10, proposedMrp: 2599 } },
  { articleNumber: '3605', productName: 'Aerosea', type: 'Two Piece Skort Set', prevType: 'Two Piece Shorts Set', gender: 'WOMENS', garmentingAt: 'KS Art & Craft', fabricName: 'L 3009', rows: [
    { newSku: 'W SW05 SHB', colour: 'Shortbread' }, { newSku: 'W SW05 PCH', colour: 'Peach' }, { newSku: 'W SW05 PNK', colour: 'Pink' },
  ], costs: { stitchingCost: 785, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 6, inwardShipping: 10, proposedMrp: 2099 } },
  { articleNumber: '3606', productName: 'Velona', type: 'Monokini', prevType: 'Monokini One Piece Swimsuit', gender: 'WOMENS', garmentingAt: 'KS Art & Craft', fabricName: 'L 3009', rows: [
    { newSku: 'W SW06 BLK', colour: 'Black' },
  ], costs: { stitchingCost: 690, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 5, sizeTagCost: 0, packagingCost: 6, inwardShipping: 10, proposedMrp: 1999 } },

  // ─── Mumtaz / Nylon Lycra (Nylon Spandex) ───
  { articleNumber: '3607', productName: 'Marina', type: 'Legsuit', gender: 'WOMENS', garmentingAt: 'Mumtaz', fabricName: 'Nylon Lycra (Nylon Spandex)', rows: [
    { newSku: 'W SW07 BLK', colour: 'Black', gKg: 3.75 },
    { newSku: 'W SW07 PNK', colour: 'Pink', gKg: 3.82 },
  ], costs: { stitchingCost: 213, brandLogoCost: 12, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 40, brandTagCost: 6, sizeTagCost: 2.5, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 1899 } },
  { articleNumber: '3608', productName: 'Aqualine', type: 'Legsuit', prevType: 'Legsuit With Front Zip', gender: 'WOMENS', garmentingAt: 'Mumtaz', fabricName: 'Nylon Lycra (Nylon Spandex)', rows: [
    { newSku: 'W SW08 GRY', colour: 'Grey', gKg: 3.69 },
    { newSku: 'W SW08 TEL', colour: 'Teal', gKg: 3.81 },
  ], costs: { stitchingCost: 220, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 75, brandTagCost: 6, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 1999 } },
  { articleNumber: '3609', productName: 'Nerissa', type: 'Two Piece Skort Set', prevType: 'Two Piece Set With Skort', gender: 'WOMENS', garmentingAt: 'Mumtaz', fabricName: 'Nylon Lycra (Nylon Spandex)', rows: [
    { newSku: 'W SW09 MRN', oldSku: 'W SW09 MAR', colour: 'Maroon', gKg: 3.5 },
    { newSku: 'W SW09 TRQ', colour: 'Turquoise', gKg: 3.43 },
  ], costs: { stitchingCost: 263, brandLogoCost: 12, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 40, brandTagCost: 6, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 2299 } },

  // ─── Mumtaz / Imported Lycra ───
  { articleNumber: '3610', productName: 'Ariala', type: 'Swimdress', prevType: 'Swimdress With Built-in Shorts', gender: 'WOMENS', garmentingAt: 'Mumtaz', fabricName: 'Imported Lycra (Poly Spandex)', fabric2Name: 'Imported Lycra (Poly Spandex)', rows: [
    { newSku: 'W SW10 TRQ', colour: 'Navy', colour2: 'Turquoise', gKg: 3.09 },
    { newSku: 'W SW10 BLU', colour: 'Black', colour2: 'Blue', gKg: 3.09 },
  ], costs: { stitchingCost: 253, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 40, brandTagCost: 5, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 1699 } },
  { articleNumber: '3611', productName: 'Selara', type: 'Legsuit', prevType: 'Half Sleeve Legsuit', gender: 'WOMENS', garmentingAt: 'Mumtaz', fabricName: 'Imported Lycra (Poly Spandex)', rows: [
    { newSku: 'W SW11 BLK', colour: 'Black', gKg: 2.29 },
    { newSku: 'W SW11 NVY', colour: 'Navy', gKg: 2.75 },
  ], costs: { stitchingCost: 220, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 75, brandTagCost: 5, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 1499 } },
  { articleNumber: '3612', productName: 'Serene', type: 'Fullsuit', prevType: 'Full Suit', gender: 'WOMENS', garmentingAt: 'Mumtaz', fabricName: 'Imported Lycra (Poly Spandex)', fabric2Name: 'Imported Lycra (Poly Spandex)', rows: [
    { newSku: 'W SW12 PNK', colour: 'Black', colour2: 'Pink', gKg: 1.07 },
    { newSku: 'W SW12 BLU', colour: 'Navy', colour2: 'Blue', gKg: 0.99 },
  ], costs: { stitchingCost: 260, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 50, brandTagCost: 5, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 2549 } },
  { articleNumber: '3613', productName: 'Marea', type: 'Swimdress', prevType: 'Skort Style Frock Suit', gender: 'WOMENS', garmentingAt: 'Mumtaz', fabricName: 'Imported Lycra (Poly Spandex)', rows: [
    { newSku: 'W SW13 NVY', colour: 'Navy', gKg: 2.67 },
    { newSku: 'W SW13 BLK', colour: 'Black', gKg: 2.67 },
  ], costs: { stitchingCost: 250, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 50, brandTagCost: 5, sizeTagCost: 0, packagingCost: 8.5, inwardShipping: 10, proposedMrp: 2199 } },

  // ─── KS Art & Craft mens (L 3010-3013, per-row fabric) ───
  // 3614 special: each colour uses different fabric
  // 3615 same
  // Will handle these specially below

  // ─── Mumtaz kids ───
  { articleNumber: '3616', productName: 'Splashy', type: 'Legsuit', prevType: 'Kids Swimwear', gender: 'KIDS', garmentingAt: 'Mumtaz', fabricName: 'Imported Lycra (Poly Spandex)', fabric2Name: 'Imported Lycra (Poly Spandex)', rows: [
    { newSku: 'K SW16 PNK', colour: 'Pink', colour2: 'Blue', gKg: 5, gKg2: 5 },
    { newSku: 'K SW16 YLW', colour: 'Yellow', colour2: 'Pista', gKg: 5, gKg2: 5 },
  ], costs: { stitchingCost: 180, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 30, brandTagCost: 7, sizeTagCost: 0, packagingCost: 7, inwardShipping: 10, proposedMrp: 1449 } },
  { articleNumber: '3617', productName: 'Wavy', type: 'Legsuit', prevType: 'Kids Swimwear', gender: 'KIDS', garmentingAt: 'Mumtaz', fabricName: 'Imported Lycra (Poly Spandex)', rows: [
    { newSku: 'K SW17 BLU', colour: 'Navy Blue', gKg: 4.5 },
    { newSku: 'K SW17 TRQ', colour: 'Turquoise', gKg: 4.5 },
    { newSku: 'K SW17 PNK', colour: 'Pink', gKg: 4.5 },
  ], costs: { stitchingCost: 180, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 50, brandTagCost: 7, sizeTagCost: 0, packagingCost: 7, inwardShipping: 10, proposedMrp: 1349 } },
  { articleNumber: '3618', productName: 'Bubbly', type: 'Legsuit', prevType: 'Kids Swimwear', gender: 'KIDS', garmentingAt: 'Mumtaz', fabricName: 'Nylon', rows: [
    { newSku: 'K SW18 MRN', colour: 'Maroon', gKg: 4.5 },
  ], costs: { stitchingCost: 180, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 30, brandTagCost: 7, sizeTagCost: 0, packagingCost: 7, inwardShipping: 10, proposedMrp: 1599 } },
  { articleNumber: '3619', productName: 'Tidy', type: 'Trunks', prevType: 'Kids Swimming Trunks', gender: 'KIDS', garmentingAt: 'Mumtaz', fabricName: 'Imported Lycra (Poly Spandex)', rows: [
    { newSku: 'K SW19 YLW', colour: 'Yellow', gKg: 7 },
    { newSku: 'K SW19 BLU', colour: 'Royal Blue', gKg: 7 },
    { newSku: 'K SW19 PIS', colour: 'Pista', gKg: 7 },
  ], costs: { stitchingCost: 100, brandLogoCost: 5, neckTwillCost: 0, reflectorsCost: 20, fusingCost: 0, accessoriesCost: 0, brandTagCost: 7, sizeTagCost: 0, packagingCost: 7, inwardShipping: 10, proposedMrp: 899 } },
];

// Special: per-row fabric for 3614 and 3615
const articles3614_3615 = [
  { articleNumber: '3614', productName: 'Drift', type: 'Jammer', prevType: 'Mens Swimming Jammer', gender: 'MENS' as const, garmentingAt: 'KS Art & Craft', rows: [
    { newSku: 'M SW14 BLO', colour: 'Black with Orange', fabricName: 'L 3010' },
    { newSku: 'M SW14 BLN', colour: 'Black with Neon', fabricName: 'L 3011' },
  ], costs: { stitchingCost: 525, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 0, sizeTagCost: 0, packagingCost: 0, inwardShipping: 10, proposedMrp: 1119 } },
  { articleNumber: '3615', productName: 'Cloud', type: 'Trunks', prevType: 'Mens Swimming Trunks', gender: 'MENS' as const, garmentingAt: 'KS Art & Craft', rows: [
    { newSku: 'M SW15 BLO', colour: 'Black with Orange', fabricName: 'L 3012' },
    { newSku: 'M SW15 BLN', colour: 'Black with Neon', fabricName: 'L 3013' },
  ], costs: { stitchingCost: 460, brandLogoCost: 0, neckTwillCost: 0, reflectorsCost: 0, fusingCost: 0, accessoriesCost: 0, brandTagCost: 0, sizeTagCost: 0, packagingCost: 0, inwardShipping: 10, proposedMrp: 899 } },
];

(async () => {
  await prisma.$transaction(async (tx) => {
    // ─── Create dummy fabrics L 3009-L 3013 ───
    const ksVendor = await tx.vendor.findFirst({ where: { name: 'KS Art & Craft' } });
    if (!ksVendor) throw new Error('KS Art & Craft vendor not found');
    for (const fn of ['L 3009', 'L 3010', 'L 3011', 'L 3012', 'L 3013']) {
      const existing = await tx.fabricMaster.findUnique({ where: { fabricName: fn } });
      if (existing) { console.log(`Fabric ${fn} already exists`); continue; }
      await tx.fabricMaster.create({
        data: { fabricName: fn, vendorId: ksVendor.id, mrp: null, genders: [], articleNumbers: [], coloursAvailable: [] },
      });
      console.log(`Created fabric ${fn} (no mrp)`);
    }

    // ─── Create ProductTypes ───
    const typeNames = ['Kneesuit','Skort Suit','Two Piece Skort Set','Monokini','Legsuit','Swimdress','Fullsuit','Jammer','Trunks'];
    const typeIds: Record<string, string> = {};
    for (const name of typeNames) {
      let pt = await tx.productType.findFirst({ where: { name } });
      if (!pt) {
        pt = await tx.productType.create({ data: { name, code: 'SW' } });
        console.log(`Created ProductType "${name}" with code=SW`);
      }
      typeIds[name] = pt.id;
    }

    // Helper to look up vendor for a fabric
    const fabricCache = new Map<string, { id: string; vendorId: string; mrp: number | null }>();
    const getFabric = async (name: string) => {
      if (fabricCache.has(name)) return fabricCache.get(name)!;
      const f = await tx.fabricMaster.findUnique({ where: { fabricName: name } });
      if (!f) throw new Error(`FabricMaster "${name}" not found`);
      const info = { id: f.id, vendorId: f.vendorId, mrp: f.mrp ? Number(f.mrp) : null };
      fabricCache.set(name, info);
      return info;
    };

    // ─── Create regular articles (non-3614/3615) ───
    for (const a of articles) {
      const garm = await tx.garmentingLocation.findFirst({ where: { name: a.garmentingAt } });
      if (!garm) throw new Error(`Garmenting "${a.garmentingAt}" not found`);
      const f1 = await getFabric(a.fabricName);
      const f2 = a.fabric2Name ? await getFabric(a.fabric2Name) : null;

      console.log(`\n--- ${a.articleNumber} ${a.productName} (${a.type}, ${a.fabricName}${a.fabric2Name ? ` + ${a.fabric2Name}` : ''}) ---`);

      for (const r of a.rows) {
        const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
        if (existing) { console.log(`SKIP ${r.newSku}: already exists`); continue; }
        const seedPrev = r.oldSku && r.oldSku !== r.newSku ? [r.oldSku] : [];
        const created = await tx.productMaster.create({
          data: {
            articleNumber: a.articleNumber,
            skuCode: r.newSku,
            previousSkuCodes: seedPrev,
            styleNumber: '',
            productName: a.productName,
            type: a.type,
            typeRefId: typeIds[a.type],
            gender: a.gender,
            garmentingAt: a.garmentingAt,
            garmentingAtId: garm.id,
            fabricName: a.fabricName,
            coloursAvailable: [r.colour],
            fabric2Name: a.fabric2Name ?? null,
            colours2Available: r.colour2 ? [r.colour2] : [],
            colours3Available: [],
            colours4Available: [],
            garmentsPerKg: r.gKg ?? null,
            garmentsPerKg2: r.gKg2 ?? null,
            fabricCostPerKg: f1.mrp,
            fabric2CostPerKg: f2?.mrp ?? null,
            ...a.costs,
          },
        });
        console.log(`  ${created.skuCode} | ${r.colour}${r.colour2 ? `/${r.colour2}` : ''} | g/kg=${r.gKg ?? 'null'}${r.gKg2 ? `/${r.gKg2}` : ''} | prev=${JSON.stringify(seedPrev)}`);
      }

      if (a.prevType) {
        const h = await tx.articleHistory.findUnique({ where: { articleNumber: a.articleNumber } });
        const merged = Array.from(new Set([...(h?.previousTypes ?? []), a.prevType]));
        await tx.articleHistory.upsert({
          where: { articleNumber: a.articleNumber },
          create: { articleNumber: a.articleNumber, previousTypes: merged },
          update: { previousTypes: { set: merged } },
        });
        console.log(`  ArticleHistory previousTypes=${JSON.stringify(merged)}`);
      }

      // Link articleNumber into FabricMaster.articleNumbers
      for (const fn of [a.fabricName, ...(a.fabric2Name && a.fabric2Name !== a.fabricName ? [a.fabric2Name] : [])]) {
        const fab = await tx.fabricMaster.findUnique({ where: { fabricName: fn } });
        if (fab && !fab.articleNumbers.includes(a.articleNumber)) {
          await tx.fabricMaster.update({
            where: { fabricName: fn },
            data: { articleNumbers: { set: [...fab.articleNumbers, a.articleNumber] } },
          });
        }
      }
    }

    // ─── 3614 + 3615: per-row fabric ───
    for (const a of articles3614_3615) {
      const garm = await tx.garmentingLocation.findFirst({ where: { name: a.garmentingAt } });
      if (!garm) throw new Error(`Garmenting "${a.garmentingAt}" not found`);

      console.log(`\n--- ${a.articleNumber} ${a.productName} (${a.type}, per-row fabric) ---`);
      for (const r of a.rows) {
        const existing = await tx.productMaster.findUnique({ where: { skuCode: r.newSku } });
        if (existing) { console.log(`SKIP ${r.newSku}: already exists`); continue; }
        const f = await getFabric(r.fabricName);
        const created = await tx.productMaster.create({
          data: {
            articleNumber: a.articleNumber,
            skuCode: r.newSku,
            previousSkuCodes: [],
            styleNumber: '',
            productName: a.productName,
            type: a.type,
            typeRefId: typeIds[a.type],
            gender: a.gender,
            garmentingAt: a.garmentingAt,
            garmentingAtId: garm.id,
            fabricName: r.fabricName,
            coloursAvailable: [r.colour],
            colours2Available: [],
            colours3Available: [],
            colours4Available: [],
            garmentsPerKg: null,
            fabricCostPerKg: f.mrp,
            ...a.costs,
          },
        });
        console.log(`  ${created.skuCode} | ${r.colour} | fabric=${r.fabricName}`);

        const fab = await tx.fabricMaster.findUnique({ where: { fabricName: r.fabricName } });
        if (fab && !fab.articleNumbers.includes(a.articleNumber)) {
          await tx.fabricMaster.update({
            where: { fabricName: r.fabricName },
            data: { articleNumbers: { set: [...fab.articleNumbers, a.articleNumber] } },
          });
        }
      }

      if (a.prevType) {
        const h = await tx.articleHistory.findUnique({ where: { articleNumber: a.articleNumber } });
        const merged = Array.from(new Set([...(h?.previousTypes ?? []), a.prevType]));
        await tx.articleHistory.upsert({
          where: { articleNumber: a.articleNumber },
          create: { articleNumber: a.articleNumber, previousTypes: merged },
          update: { previousTypes: { set: merged } },
        });
        console.log(`  ArticleHistory previousTypes=${JSON.stringify(merged)}`);
      }
    }
  });

  await prisma.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
