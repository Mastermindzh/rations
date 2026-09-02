import { randomBytes } from "node:crypto";
import type { Context } from "hono";
import { deleteCookie, getSignedCookie, setSignedCookie } from "hono/cookie";
import type { AppEnv } from "../env.js";

const COOKIE_NAME = "rations_session";
const MAX_AGE_SECONDS = 60 * 60 * 12;

type Session = { expiresAt: number; csrfToken: string };

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) {
    return secret;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "SESSION_SECRET must be at least 32 characters in production",
    );
  }
  return "development-only-session-secret-change-me";
}

export async function readSession(c: Context<AppEnv>): Promise<Session | null> {
  const value = await getSignedCookie(c, sessionSecret(), COOKIE_NAME);
  if (!value) {
    return null;
  }
  try {
    const session = JSON.parse(
      Buffer.from(value, "base64url").toString("utf8"),
    ) as Session;
    if (
      !session.csrfToken ||
      !Number.isFinite(session.expiresAt) ||
      session.expiresAt <= Date.now()
    ) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export async function createSession(c: Context<AppEnv>): Promise<Session> {
  const session = {
    expiresAt: Date.now() + MAX_AGE_SECONDS * 1000,
    csrfToken: randomBytes(32).toString("base64url"),
  };
  await setSignedCookie(
    c,
    COOKIE_NAME,
    Buffer.from(JSON.stringify(session)).toString("base64url"),
    sessionSecret(),
    {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "Lax",
      path: "/",
      maxAge: MAX_AGE_SECONDS,
    },
  );
  return session;
}

export function clearSession(c: Context<AppEnv>): void {
  deleteCookie(c, COOKIE_NAME, {
    path: "/",
    secure: process.env.NODE_ENV === "production",
  });
}
