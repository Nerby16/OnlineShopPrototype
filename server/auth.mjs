import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const derived = await scryptAsync(password, salt, 64);
  return `scrypt$${salt}$${Buffer.from(derived).toString("hex")}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, salt, expectedHex] = String(storedHash).split("$");
  if (
    algorithm !== "scrypt"
    || !/^[a-f0-9]{32}$/i.test(salt ?? "")
    || !/^[a-f0-9]{128}$/i.test(expectedHex ?? "")
  ) return false;

  const expected = Buffer.from(expectedHex, "hex");
  const actual = Buffer.from(await scryptAsync(password, salt, expected.length));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function createSessionToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashSessionToken(token) };
}

export function hashSessionToken(token) {
  return createHash("sha256").update(String(token)).digest("hex");
}

export function readCookie(request, name) {
  const cookies = String(request.headers.cookie ?? "").split(";");
  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");
    if (separator < 0) continue;
    const key = cookie.slice(0, separator).trim();
    if (key === name) {
      try {
        return decodeURIComponent(cookie.slice(separator + 1).trim());
      } catch {
        return null;
      }
    }
  }
  return null;
}

export function sessionCookie(token, maxAgeSeconds, secure = false) {
  return [
    `lumina_session=${encodeURIComponent(token)}`,
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${maxAgeSeconds}`,
    "Priority=High",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}

export function clearSessionCookie(secure = false) {
  return [
    "lumina_session=",
    "HttpOnly",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=0",
    "Priority=High",
    secure ? "Secure" : "",
  ].filter(Boolean).join("; ");
}
