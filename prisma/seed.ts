import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Create default user
  const passwordHash = await hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@hyperballik.com" },
    update: {},
    create: {
      name: "Admin",
      email: "admin@hyperballik.com",
      passwordHash,
    },
  });

  // Create vendors
  const vendors = [
    { name: "Pranera", type: "FABRIC_SUPPLIER" as const },
    { name: "Pugazh", type: "FABRIC_SUPPLIER" as const },
    { name: "Ultron", type: "FABRIC_SUPPLIER" as const },
    { name: "Positex", type: "FABRIC_SUPPLIER" as const },
    { name: "Global House", type: "FABRIC_SUPPLIER" as const },
    { name: "Shree Fabrics", type: "FABRIC_SUPPLIER" as const },
    { name: "Garsem", type: "GARMENTING" as const },
    { name: "Mumtaz", type: "GARMENTING" as const },
    { name: "Ashtavinayak", type: "BRAND_TAG" as const },
    { name: "Milan Xerox", type: "OTHER" as const },
  ];

  for (const v of vendors) {
    await prisma.vendor.upsert({
      where: { name: v.name },
      update: {},
      create: v,
    });
  }

  // Create Phase 3
  await prisma.phase.upsert({
    where: { number: 3 },
    update: {},
    create: {
      name: "Phase 3 - Nov Mid 2025",
      number: 3,
      startDate: new Date("2025-11-15"),
      isCurrent: true,
    },
  });

  console.log("Seed completed successfully");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
