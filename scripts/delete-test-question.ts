import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

const adapter = new PrismaLibSql({ url: `file:${path.resolve(process.cwd(), "dev.db")}` });
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const d = await prisma.campusQuestion.delete({ where: { id: 2 } });
    console.log("Deleted:", d.text.slice(0, 60));
  } catch { console.log("Q2 already gone or not found"); }
  const count = await prisma.campusQuestion.count();
  console.log("Final count:", count);
}

main().catch(console.error).finally(() => prisma.$disconnect());
