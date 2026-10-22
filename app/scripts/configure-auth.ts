import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { randomBytes } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import path from "node:path";
import { hashPassword } from "../src/lib/auth";
async function main() {
  if (!process.stdin.isTTY) throw new Error("请在交互终端运行；密码不会回显或写入命令历史。");
  const target = path.resolve(process.argv[2] || ".env");
  if (![".env", "app.env"].includes(path.basename(target))) throw new Error("配置目标必须是 .env 或 app.env 文件");
  let muted = false;
  const output = new Writable({ write(chunk, _encoding, callback) { if (!muted) process.stdout.write(chunk); callback(); } });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  try {
    const username = (await rl.question("登录账号（默认 learner）：")).trim() || "learner";
    const origin = (await rl.question("网页完整来源（例如 https://study.koayan.cn）：")).trim();
    if (username.length > 100 || /[\s#='"\\]/.test(username) || new URL(origin).origin !== origin) throw new Error("账号或来源格式无效");
    process.stdout.write("登录密码（至少12位，不回显）："); muted = true;
    const password = await rl.question(""); muted = false; process.stdout.write("\n");
    process.stdout.write("再次输入密码："); muted = true;
    const confirm = await rl.question(""); muted = false; process.stdout.write("\n");
    if (password.length < 12 || password.length > 256 || password !== confirm) throw new Error("密码长度需12～256位，两次输入必须一致");
    let existing = ""; try { existing = await readFile(target, "utf8"); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    const retained = existing.split("\n").filter(line => !/^\s*(?:export\s+)?(?:AUTH_USERNAME|AUTH_PASSWORD_HASH|AUTH_SECRET|APP_ORIGIN)\s*=/.test(line)).join("\n").trimEnd();
    const content = `${retained}\nAPP_ORIGIN=${origin}\nAUTH_USERNAME=${username}\nAUTH_PASSWORD_HASH=${await hashPassword(password)}\nAUTH_SECRET=${randomBytes(32).toString("hex")}\n`;
    const temp = `${target}.${randomBytes(8).toString("hex")}.tmp`;
    await writeFile(temp, content, { flag: "wx", mode: 0o600 }); await rename(temp, target);
    console.log(`登录配置已保存到 ${target}。原有AI配置保留；请重启Web。重新配置会使全部旧会话失效。`);
  } finally { muted = false; rl.close(); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "配置失败"); process.exitCode = 1; });
