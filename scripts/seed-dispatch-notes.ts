/**
 * Seed a handful of accessory dispatch rows and stamp them with DN numbers
 * so the Dispatch Notes tab has something to show. Idempotent-ish: bails out
 * if there are already DN-stamped rows in the DB so it won't double-seed.
 */
import { db } from "@/lib/db";
import { allocateDispatchNoteNumber } from "@/lib/po-numbering";

async function main() {
  const existingWithDn = await db.accessoryDispatch.count({ where: { dnNumber: { not: null } } });
  if (existingWithDn > 0) {
    console.log(`Skipping seed — ${existingWithDn} dispatch rows already have DNs.`);
    await db.$disconnect();
    return;
  }

  const currentPhase =
    (await db.phase.findFirst({ where: { isCurrent: true }, select: { id: true, number: true, name: true } })) ??
    (await db.phase.findFirst({ orderBy: { number: "desc" }, select: { id: true, number: true, name: true } }));
  if (!currentPhase) throw new Error("No phase found — create a phase first");

  const accessories = await db.accessoryMaster.findMany({
    take: 6,
    select: { id: true, displayName: true, unit: true },
  });
  if (accessories.length < 3) throw new Error("Need at least 3 accessories in AccessoryMaster");

  const garmenters = await db.vendor.findMany({
    where: { type: "GARMENTING" },
    select: { id: true, name: true },
  });
  if (garmenters.length < 2) throw new Error("Need at least 2 garmenting vendors");

  const [g1, g2] = garmenters;

  // Batch 1: 3 lines to garmenter 1, status DISPATCHED
  const batch1Rows = await Promise.all(
    accessories.slice(0, 3).map((a, i) =>
      db.accessoryDispatch.create({
        data: {
          phaseId: currentPhase.id,
          accessoryId: a.id,
          quantity: (i + 1) * 100,
          destinationGarmenter: g1.name,
          dispatchDate: new Date(),
          comments: `Seed batch 1 — line ${i + 1}`,
          status: "DRAFT",
        },
        select: { id: true },
      }),
    ),
  );
  const dn1 = await allocateDispatchNoteNumber();
  await db.accessoryDispatch.updateMany({
    where: { id: { in: batch1Rows.map((r) => r.id) } },
    data: { dnNumber: dn1, status: "DISPATCHED", statusChangedAt: new Date() },
  });
  console.log(`Created ${batch1Rows.length} rows for ${g1.name} under ${dn1} (DISPATCHED)`);

  // Batch 2: 2 lines to garmenter 2, status DRAFT (still open)
  const batch2Rows = await Promise.all(
    accessories.slice(3, 5).map((a, i) =>
      db.accessoryDispatch.create({
        data: {
          phaseId: currentPhase.id,
          accessoryId: a.id,
          quantity: (i + 1) * 50,
          destinationGarmenter: g2.name,
          dispatchDate: new Date(),
          comments: `Seed batch 2 — line ${i + 1}`,
          status: "DRAFT",
        },
        select: { id: true },
      }),
    ),
  );
  const dn2 = await allocateDispatchNoteNumber();
  await db.accessoryDispatch.updateMany({
    where: { id: { in: batch2Rows.map((r) => r.id) } },
    data: { dnNumber: dn2 },
  });
  console.log(`Created ${batch2Rows.length} rows for ${g2.name} under ${dn2} (DRAFT)`);

  // Batch 3: 1 line to garmenter 1, status CANCELLED
  const batch3Row = await db.accessoryDispatch.create({
    data: {
      phaseId: currentPhase.id,
      accessoryId: accessories[5 % accessories.length].id,
      quantity: 42,
      destinationGarmenter: g1.name,
      dispatchDate: new Date(),
      comments: "Seed batch 3 — will be cancelled",
      status: "DRAFT",
    },
    select: { id: true },
  });
  const dn3 = await allocateDispatchNoteNumber();
  await db.accessoryDispatch.update({
    where: { id: batch3Row.id },
    data: { dnNumber: dn3, status: "CANCELLED", statusChangedAt: new Date() },
  });
  console.log(`Created 1 row for ${g1.name} under ${dn3} (CANCELLED)`);

  console.log("\nSeed complete. Visit the Dispatch Notes tab.");
  await db.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
