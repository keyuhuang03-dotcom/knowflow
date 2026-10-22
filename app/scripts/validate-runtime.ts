import { authConfig } from "../src/lib/auth";
export function validateRuntime() {
  if (!authConfig()) throw new Error("登录配置缺失或APP_ORIGIN无效，请先配置登录账号和实际HTTPS来源");
  const limit = Number(process.env.AI_DAILY_LIMIT || 100);
  if (!Number.isInteger(limit) || limit < 1 || limit > 10000) throw new Error("AI_DAILY_LIMIT必须为1～10000整数");
  if (process.env.MISTAKE_AI_API_KEY && process.env.MISTAKE_AI_MODEL) {
    const url = new URL(process.env.MISTAKE_AI_BASE_URL || "https://api.openai.com/v1");
    if (url.username || url.password) throw new Error("图片AI地址不允许内嵌凭据");
    if (url.protocol !== "https:" && !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname)) throw new Error("图片AI服务必须使用HTTPS地址");
  }
}
if (process.argv[1]?.endsWith("validate-runtime.ts")) {
  try { validateRuntime(); } catch (error) { console.error(error instanceof Error ? error.message : "服务配置无效"); process.exitCode = 1; }
}
