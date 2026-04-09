import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config({ path: ".env" });
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const db = new PrismaClient({ adapter });
async function main() {
  const r = await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='FabricMaster' AND column_name IN ('styleNumbers', 'articleNumbers', 'deletedArticleNumbers')`);
  console.log("FabricMaster columns:", r);
  const r2 = await db.$queryRawUnsafe(`SELECT column_name FROM information_schema.columns WHERE table_name='FabricOrder' AND column_name IN ('styleNumbers', 'articleNumbers')`);
  console.log("FabricOrder columns:", r2);
}
main().then(() => db.$disconnect());
