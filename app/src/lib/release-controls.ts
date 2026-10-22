import { prisma } from "./prisma";
export class AiBudgetExceeded extends Error {}
export function budgetDay(now = new Date()) { return now.toLocaleDateString("sv-SE", { timeZone: "Asia/Shanghai" }); }
export async function reserveAiUsage() {
  const limit = Number(process.env.AI_DAILY_LIMIT || 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new AiBudgetExceeded("AI额度配置无效，原记录仍保留。");
  const day = budgetDay();
  const allowed = await prisma.$executeRaw`INSERT INTO "AiUsageDay" ("day", "used") VALUES (${day}, 1)
    ON CONFLICT("day") DO UPDATE SET "used" = "used" + 1 WHERE "used" < ${limit}`;
  if (!allowed) throw new AiBudgetExceeded("今日AI整理额度已用完，照片和记录仍保留，请明日重试。");
}
type Rule = { count: number; parallel: number };
const rules: Record<string, Rule> = { upload: { count: 20, parallel: 2 }, ai: { count: 10, parallel: 1 }, retry: { count: 20, parallel: 2 } };
const state = new Map<string, { count: number; active: number; reset: number }>();
export function acquireRequest(path: string, method: string, now = Date.now()) {
  const bucket = path === "/api/upload" ? "upload" : path.startsWith("/api/ai/") || path === "/api/daily-review" && method === "POST" || /\/catalog$/.test(path) && method === "POST" || /\/skill(?:\/word)?$/.test(path) ? "ai" : /\/processing$/.test(path) && method === "POST" ? "retry" : null;
  if (!bucket) return () => {};
  const rule = rules[bucket]; const prior = state.get(bucket) || { count: 0, active: 0, reset: now + 60_000 };
  if (prior.reset <= now) { prior.count = 0; prior.reset = now + 60_000; }
  if (prior.count >= rule.count || prior.active >= rule.parallel) return null;
  prior.count++; prior.active++; state.set(bucket, prior);
  let released = false; return () => { if (!released) { prior.active--; released = true; } };
}

// Single Web process: reject concurrent mutations during explicit whole-store restore.
let mutations = 0;
let restoring = false;
export function enterMutation() {
  if (restoring) return null;
  mutations++; let released = false;
  return () => { if (!released) { mutations--; released = true; } };
}
export function pauseForRestore() {
  if (restoring || mutations !== 1) throw new Error("Other write operations are active");
  restoring = true; return () => { restoring = false; };
}
