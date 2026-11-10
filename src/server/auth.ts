import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";

const COOKIE_NAME = "kamiocal_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

const digest = (value: string) => createHash("sha256").update(value).digest();
const safeEqual = (a: string, b: string) =>
  timingSafeEqual(digest(a), digest(b));

export function createAuth(password: string) {
  if (!password.trim()) {
    throw new Error("Password cannot be empty.");
  }

  const sessions = new Map<string, number>(); 

  function isValidSession(token: string | undefined): boolean {
    if (!token) return false;
    const expires = sessions.get(token);
    if (expires === undefined) return false;
    if (expires < Date.now()) {
      sessions.delete(token);
      return false;
    }
    return true;
  }

  function login(c: Context, attempt: string): boolean {
    if (!safeEqual(attempt, password)) return false;

    const token = randomBytes(32).toString("hex");
    sessions.set(token, Date.now() + SESSION_TTL_SECONDS * 1000);

    setCookie(c, COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "Lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
      secure: new URL(c.req.url).protocol === "https:",
    });
    return true;
  }

  function logout(c: Context): void {
    const token = getCookie(c, COOKIE_NAME);
    if (token) sessions.delete(token);
    deleteCookie(c, COOKIE_NAME, { path: "/" });
  }

  const middleware: MiddlewareHandler = async (c, next) => {
    if (isValidSession(getCookie(c, COOKIE_NAME))) {
      return next();
    }
    return c.req.method === "GET"
      ? c.redirect("/login")
      : c.text("Unauthorized", 401);
  };

  return { middleware, login, logout };
}
