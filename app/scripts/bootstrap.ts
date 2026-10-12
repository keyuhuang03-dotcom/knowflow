import { loadEnvConfig } from "@next/env";
import { PrismaClient } from "@prisma/client";
loadEnvConfig(process.cwd());
const prisma = new PrismaClient();
async function main() {
  await prisma.$transaction(async tx => {
    await tx.user.upsert({ where: { id: "default" }, update: {}, create: { id: "default", name: "学习者" } });
    for (const [id, name, color] of [["math", "数学", "#C5E86C"], ["english", "英语", "#F9E6B8"], ["cs", "408", "#F6DFB9"], ["politics", "政治", "#E4DDF8"]]) {
      await tx.subject.upsert({ where: { id }, update: {}, create: { id, name, color } });
    }
  });
  console.log("Default user and subjects available; existing records unchanged.");
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
