import { reserveAiUsage, AiBudgetExceeded } from "../src/lib/release-controls";
import { prisma } from "../src/lib/prisma";
async function main() {
try { await reserveAiUsage(); } catch (error) { if (!(error instanceof AiBudgetExceeded)) console.error(error); process.exitCode = 1; }
finally { await prisma.$disconnect(); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
