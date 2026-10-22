import assert from "node:assert/strict";
import { prisma } from "../src/lib/prisma";
import { reserveAiUsage, AiBudgetExceeded, budgetDay } from "../src/lib/release-controls";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
async function main() {
const execute = promisify(execFile);
process.env.AI_DAILY_LIMIT = "5";
await prisma.aiUsageDay.deleteMany();
const children = await Promise.allSettled(Array.from({ length: 10 }, () => execute(process.execPath, ["--import", "tsx", "tests/ai-budget-child.ts"], { env: process.env })));
assert.equal(children.filter(v => v.status === "fulfilled").length, 5);
assert.equal((await prisma.aiUsageDay.findUniqueOrThrow({ where: { day: budgetDay() } })).used, 5);
await assert.rejects(reserveAiUsage(), AiBudgetExceeded);
await prisma.$disconnect();
}
main().catch(error => { console.error(error); process.exitCode = 1; });
