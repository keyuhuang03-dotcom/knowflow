import { createSession, SESSION_COOKIE } from "../src/lib/auth";
process.env.AUTH_USERNAME = "fixture";
process.env.AUTH_PASSWORD_HASH = "scrypt:" + "a".repeat(32) + ":" + "b".repeat(128);
process.env.AUTH_SECRET = "isolated-auth-test-secret-32-characters";
process.env.APP_ORIGIN = "http://localhost";
export class FixtureRequest extends Request {
  constructor(input: string | URL | Request, init: RequestInit = {}) {
    const headers = new Headers(init.headers); headers.set("cookie", `${SESSION_COOKIE}=${createSession()}`); headers.set("origin", "http://localhost");
    super(input, { ...init, headers });
  }
}
